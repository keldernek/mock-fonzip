import type { OrgSlug } from "../auth/tenancy";

export type Row<R extends { id: number }> = Omit<R, "id"> & { id: number };

export interface OrgCollection<R extends { id: number }> {
  insert(data: Omit<R, "id">): Row<R>;
  get(id: number): Row<R> | undefined;
  update(id: number, patch: Partial<Omit<R, "id">>): Row<R> | undefined;
  remove(id: number): Row<R> | undefined;
  list(predicate?: (row: Row<R>) => boolean): Row<R>[];
  find(predicate: (row: Row<R>) => boolean): Row<R> | undefined;
  count(predicate?: (row: Row<R>) => boolean): number;
}

export class Collection<R extends { id: number }> {
  private nextId: number;
  private readonly rows = new Map<OrgSlug, Map<number, Row<R>>>();

  constructor(
    readonly name: string,
    readonly firstId: number,
  ) {
    this.nextId = firstId;
  }

  private table(org: OrgSlug): Map<number, Row<R>> {
    let table = this.rows.get(org);
    if (!table) {
      table = new Map();
      this.rows.set(org, table);
    }
    return table;
  }

  for(org: OrgSlug): OrgCollection<R> {
    const table = this.table(org);
    const list = (predicate?: (row: Row<R>) => boolean): Row<R>[] => {
      const rows = [...table.values()];
      return predicate ? rows.filter(predicate) : rows;
    };
    return {
      insert: (data) => {
        const row: Row<R> = { ...data, id: this.nextId };
        this.nextId += 1;
        table.set(row.id, row);
        return row;
      },
      get: (id) => table.get(id),
      update: (id, patch) => {
        const existing = table.get(id);
        if (!existing) return undefined;
        const row: Row<R> = { ...existing, ...patch, id };
        table.set(id, row);
        return row;
      },
      remove: (id) => {
        const existing = table.get(id);
        table.delete(id);
        return existing;
      },
      list,
      find: (predicate) => list().find(predicate),
      count: (predicate) => list(predicate).length,
    };
  }
}
