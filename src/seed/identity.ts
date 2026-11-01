import type { Rng } from "../core/rng";

export function tcKimlikNo(rng: Rng): string {
  const digits = [
    rng.int(1, 9),
    ...Array.from({ length: 8 }, () => rng.int(0, 9)),
  ];
  const odd =
    (digits[0] ?? 0) +
    (digits[2] ?? 0) +
    (digits[4] ?? 0) +
    (digits[6] ?? 0) +
    (digits[8] ?? 0);
  const even =
    (digits[1] ?? 0) + (digits[3] ?? 0) + (digits[5] ?? 0) + (digits[7] ?? 0);
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = (digits.reduce((sum, digit) => sum + digit, 0) + tenth) % 10;
  return [...digits, tenth, eleventh].join("");
}

export function isValidTcKimlikNo(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const at = (index: number): number => d[index] ?? 0;
  const odd = at(0) + at(2) + at(4) + at(6) + at(8);
  const even = at(1) + at(3) + at(5) + at(7);
  if ((((odd * 7 - even) % 10) + 10) % 10 !== at(9)) return false;
  return d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10 === at(10);
}

const ASCII: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  I: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

export function slugify(text: string): string {
  return text
    .split("")
    .map((char) => ASCII[char] ?? char.toLowerCase())
    .join("")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

export function mobilePhone(rng: Rng): string {
  return `+905${rng.pick(["32", "33", "35", "42", "44", "53", "55", "05", "06"])}${rng.digits(7)}`;
}

export function iban(rng: Rng): string {
  return `TR${rng.digits(2)}000${rng.digits(2)}${rng.digits(17)}`;
}
