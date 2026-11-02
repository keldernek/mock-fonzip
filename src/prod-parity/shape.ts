import { deref, isJsonObject, type Json } from "../spec/json";
import { specRuntime } from "../spec/runtime";

// Everything this module returns is safe to print: property paths, JSON
// kinds, and placeholders. No response value ever leaves it, except numbers
// and booleans that `revealEnumMiss` is asked to show.

export type Kind =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "null"
  | "object"
  | "array";

export type Shape = ReadonlyMap<string, ReadonlySet<Kind>>;

export const ROOT = "(body)";
export const MAP_KEY = "{*}";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const UDV_PREFIX = "user_defined_values__";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function kindOf(value: unknown): Kind {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  return "object";
}

let mapNames: ReadonlySet<string> | undefined;

// Property names the spec documents as free-form objects. Their keys are
// organisation-defined (user-defined value names, locales), so they print as
// `{*}` rather than as names.
export function freeFormPropertyNames(): ReadonlySet<string> {
  if (mapNames) return mapNames;
  const { spec } = specRuntime();
  const names = new Set<string>();
  const isFreeForm = (node: Json | undefined): boolean => {
    const resolved = deref(spec, node);
    if (!isJsonObject(resolved)) return false;
    if (resolved.type === "object" && !isJsonObject(resolved.properties)) {
      return true;
    }
    for (const key of ["anyOf", "oneOf", "allOf"]) {
      const branches = resolved[key];
      if (Array.isArray(branches) && branches.some(isFreeForm)) return true;
    }
    return false;
  };
  const walk = (node: Json | undefined): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isJsonObject(node)) return;
    if (isJsonObject(node.properties)) {
      for (const [name, property] of Object.entries(node.properties)) {
        if (isFreeForm(property)) names.add(name);
      }
    }
    for (const child of Object.values(node)) walk(child);
  };
  walk(spec);
  mapNames = names;
  return names;
}

// A key prints as itself only when it reads like a field name and does not
// sit inside a free-form map.
export function safeKey(key: string, insideMap: boolean): string {
  if (insideMap) return MAP_KEY;
  if (key.startsWith(UDV_PREFIX)) return `${UDV_PREFIX}${MAP_KEY}`;
  return IDENTIFIER.test(key) ? key : MAP_KEY;
}

function join(prefix: string, key: string): string {
  return prefix === "" ? key : `${prefix}.${key}`;
}

export function displayPath(path: string): string {
  return path === "" ? ROOT : path;
}

export function shapeOf(value: unknown): Shape {
  const maps = freeFormPropertyNames();
  const shape = new Map<string, Set<Kind>>();
  const walk = (node: unknown, path: string, insideMap: boolean): void => {
    const kinds = shape.get(path) ?? new Set<Kind>();
    kinds.add(kindOf(node));
    shape.set(path, kinds);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, `${path}[]`, insideMap);
      return;
    }
    if (!isRecord(node)) return;
    for (const [key, item] of Object.entries(node)) {
      // Below a free-form map every level is free-form, so the flag sticks.
      walk(
        item,
        join(path, safeKey(key, insideMap)),
        insideMap || maps.has(key),
      );
    }
  };
  walk(value, "", false);
  return shape;
}

export interface Located {
  readonly path: string;
  readonly value: unknown;
  readonly insideMap: boolean;
}

// Follows a JSON pointer (as ajv reports it) and returns the redacted path
// to it, with array indexes folded to `[]`.
export function locate(body: unknown, pointer: string): Located {
  const maps = freeFormPropertyNames();
  let node = body;
  let path = "";
  let insideMap = false;
  if (pointer === "") return { path, value: node, insideMap };
  for (const raw of pointer.slice(1).split("/")) {
    const segment = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(node)) {
      node = node[Number(segment)];
      path = `${path}[]`;
      continue;
    }
    node = isRecord(node) ? node[segment] : undefined;
    path = join(path, safeKey(segment, insideMap));
    insideMap = insideMap || maps.has(segment);
  }
  return { path, value: node, insideMap };
}

function fold(kind: Kind): Kind {
  return kind === "integer" ? "number" : kind;
}

function foldAll(kinds: ReadonlySet<Kind>): Set<Kind> {
  return new Set([...kinds].map(fold));
}

export function kindsText(kinds: Iterable<Kind>): string {
  return [...kinds].sort().join("|");
}

function parentOf(path: string): string | null {
  if (path === "") return null;
  if (path.endsWith("[]")) return path.slice(0, -2);
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(0, dot);
}

export interface ShapeDiff {
  // Paths only production sent: the mock never produces them.
  readonly prodOnly: readonly string[];
  // Paths only the mock sent. Production may simply have had no such data.
  readonly mockOnly: readonly string[];
  // Production sent a JSON kind at this path that the mock never does.
  readonly prodKinds: readonly string[];
  // The mock sent a kind production did not, which may depend on data.
  readonly mockKinds: readonly string[];
}

// Compares two shapes. Integer and number count as one kind here: the spec
// check reports integer-versus-number precisely.
export function diffShapes(prod: Shape, mock: Shape): ShapeDiff {
  const onlyIn = (a: Shape, b: Shape): string[] =>
    [...a.keys()]
      .filter((path) => !b.has(path))
      .filter((path) => {
        const parent = parentOf(path);
        return parent === null || b.has(parent);
      })
      .map((path) => {
        const nested = [...a.keys()].filter(
          (other) =>
            other !== path &&
            (other.startsWith(`${path}.`) || other.startsWith(`${path}[]`)),
        ).length;
        const kinds = kindsText(foldAll(a.get(path) ?? new Set()));
        return `${displayPath(path)} (${kinds}${nested > 0 ? `, ${nested} nested` : ""})`;
      })
      .sort();
  const prodKinds: string[] = [];
  const mockKinds: string[] = [];
  for (const [path, rawProd] of prod) {
    const rawMock = mock.get(path);
    if (!rawMock) continue;
    const p = foldAll(rawProd);
    const m = foldAll(rawMock);
    const line = `${displayPath(path)} prod ${kindsText(p)}, mock ${kindsText(m)}`;
    if ([...p].some((kind) => !m.has(kind))) prodKinds.push(line);
    else if ([...m].some((kind) => !p.has(kind))) mockKinds.push(line);
  }
  return {
    prodOnly: onlyIn(prod, mock),
    mockOnly: onlyIn(mock, prod),
    prodKinds: prodKinds.sort(),
    mockKinds: mockKinds.sort(),
  };
}

// Production enum misses show numbers and booleans, which are codes. Strings
// may be names or addresses, so they show only as their kind.
export function revealEnumMiss(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) return "null";
  return `a ${kindOf(value)}`;
}

const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+/g;
// Four or more digits, even when spaces, dashes, dots, slashes or brackets
// split them into groups, as in `0532 843 86 58` or `2026-10-31`.
const DIGITS = /\d(?:[\s().\-/]*\d){3,}/g;
const MAX_TEXT = 160;

// Characters a terminal acts on rather than shows: C0 and C1 controls, DEL,
// the line and paragraph separators, and the bidirectional overrides.
function actsOnTerminal(code: number): boolean {
  return (
    code < 32 ||
    (code >= 127 && code <= 159) ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

// Error texts from production may echo a request value back. Emails and long
// digit runs are masked, and the text is cut short.
export function sanitizeErrorText(text: string): string {
  let printable = "";
  for (let index = 0; index < text.length; index += 1) {
    printable += actsOnTerminal(text.charCodeAt(index))
      ? " "
      : text.charAt(index);
  }
  const cleaned = printable
    .replaceAll(EMAIL, "<email>")
    .replaceAll(DIGITS, "<digits>")
    .trim();
  return cleaned.length > MAX_TEXT ? `${cleaned.slice(0, MAX_TEXT)}…` : cleaned;
}

// Reads the `error` and `error_description` strings of an error body.
export function errorTextOf(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const parts = [body.error, body.error_description].filter(
    (part): part is string => typeof part === "string" && part !== "",
  );
  return parts.length === 0 ? null : sanitizeErrorText(parts.join(": "));
}
