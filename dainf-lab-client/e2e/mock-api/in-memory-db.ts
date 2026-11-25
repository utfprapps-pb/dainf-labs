export type Row = Record<string, any> & { id: number };

export interface SearchFilter {
  field: string;
  value?: any;
  type: string;
}

export interface SearchRequest {
  filters?: SearchFilter[];
  sort?: { field: string; type: 'ASC' | 'DESC' };
  page?: number;
  rows?: number;
}

const getPath = (obj: any, path: string) =>
  path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

const norm = (v: any) => String(v ?? '').toLowerCase();

export type CustomFilter = (row: Row, filter: SearchFilter) => boolean;

function matches(row: Row, f: SearchFilter, custom?: Record<string, CustomFilter>): boolean {
  if (custom?.[f.field]) return custom[f.field](row, f);
  const actual = getPath(row, f.field);
  switch (f.type) {
    case 'EQUALS':
      return actual == f.value;
    case 'NOT_EQUALS':
      return actual != f.value;
    case 'LIKE':
    case 'ILIKE':
      return norm(actual).includes(norm(f.value));
    case 'NOT_LIKE':
      return !norm(actual).includes(norm(f.value));
    case 'GREATER':
      return actual > f.value;
    case 'LESS':
      return actual < f.value;
    case 'GREATER_EQUALS':
      return actual >= f.value;
    case 'LESS_EQUALS':
      return actual <= f.value;
    case 'IN':
      return Array.isArray(f.value) && f.value.some((v: any) => v == actual);
    case 'NOT_IN':
      return Array.isArray(f.value) && !f.value.some((v: any) => v == actual);
    case 'IS_NULL':
      return actual == null;
    case 'IS_NOT_NULL':
      return actual != null;
    case 'BETWEEN':
      return Array.isArray(f.value) && actual >= f.value[0] && actual <= f.value[1];
    default:
      return true;
  }
}

/**
 * Banco em memória (um por teste). Reproduz o contrato do CrudService do front:
 * POST /{col}/search, GET/PUT/DELETE /{col}/{id}, POST /{col}.
 */
export class InMemoryDb {
  private data = new Map<string, Row[]>();
  private seq = new Map<string, number>();
  private custom = new Map<string, Record<string, CustomFilter>>();

  /** Filtros que não são campos diretos do registro (ex.: stockStatus, groups por id). */
  customFilters(collection: string, filters: Record<string, CustomFilter>): this {
    this.custom.set(collection, filters);
    return this;
  }

  private defs = new Map<string, Record<string, any>>();

  /** Valores padrão aplicados no create (o backend preenche, ex.: active=true). */
  defaults(collection: string, values: Record<string, any>): this {
    this.defs.set(collection, values);
    return this;
  }

  seed(collection: string, rows: Row[]): this {
    this.data.set(collection, rows.map((r) => structuredClone(r)));
    this.seq.set(collection, Math.max(0, ...rows.map((r) => r.id)));
    return this;
  }

  all(collection: string): Row[] {
    return this.data.get(collection) ?? [];
  }

  find(collection: string, id: number): Row | undefined {
    return this.all(collection).find((r) => r.id === id);
  }

  create(collection: string, body: Record<string, any>): Row {
    const id = (this.seq.get(collection) ?? 0) + 1;
    this.seq.set(collection, id);
    const row = { ...structuredClone(this.defs.get(collection) ?? {}), ...structuredClone(body), id } as Row;
    this.data.set(collection, [...this.all(collection), row]);
    return row;
  }

  update(collection: string, id: number, body: Record<string, any>): Row | undefined {
    const rows = this.all(collection);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return undefined;
    rows[idx] = { ...rows[idx], ...structuredClone(body), id };
    return rows[idx];
  }

  remove(collection: string, id: number): boolean {
    const rows = this.all(collection);
    const next = rows.filter((r) => r.id !== id);
    this.data.set(collection, next);
    return next.length !== rows.length;
  }

  search(collection: string, req: SearchRequest = {}) {
    let rows = this.all(collection).filter((r) => (req.filters ?? []).every((f) => matches(r, f, this.custom.get(collection))));

    if (req.sort?.field) {
      const dir = req.sort.type === 'DESC' ? -1 : 1;
      const field = req.sort.field;
      rows = [...rows].sort((a, b) => {
        const x = getPath(a, field);
        const y = getPath(b, field);
        return x == y ? 0 : x > y ? dir : -dir;
      });
    }

    const size = req.rows ?? 10;
    const number = req.page ?? 0;
    return {
      content: rows.slice(number * size, number * size + size),
      page: {
        size,
        number,
        totalElements: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / size)),
      },
    };
  }
}
