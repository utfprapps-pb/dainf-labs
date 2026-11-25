import type { Role } from './roles';

export interface TestUser {
  id: number;
  nome: string;
  email: string;
  role: Role;
  documento: string;
  telefone: string;
  enabled: boolean;
  emailVerificado: boolean;
}

export const makeUser = (role: Role = 'ROLE_ADMIN', over: Partial<TestUser> = {}): TestUser => ({
  id: 1,
  nome: 'Maria da Silva',
  email: 'maria@utfpr.edu.br',
  role,
  documento: '12345678909',
  telefone: '46999998888',
  enabled: true,
  emailVerificado: true,
  ...over,
});

export const pad = (i: number, n = 3) => String(i).padStart(n, '0');

export const makeCategory = (id: number, description = `Categoria ${pad(id)}`, over: Record<string, any> = {}) => ({
  id,
  description,
  icon: 'pi pi-box',
  subcategories: [],
  ...over,
});

export const makeGroup = (id: number, name = `Grupo ${pad(id)}`, over: Record<string, any> = {}) => ({
  id,
  name,
  description: '',
  active: true,
  ...over,
});

export const makeItem = (id: number, over: Record<string, any> = {}) => ({
  id,
  name: `Item ${pad(id)}`,
  description: `Descrição do item ${id}`,
  price: 10,
  type: 'CONSUMABLE',
  active: true,
  restricted: false,
  groups: [],
  category: makeCategory(1, 'Eletrônicos'),
  assets: [],
  images: [],
  siorg: `SIORG-${id}`,
  location: `Armário ${id}`,
  quantity: 20,
  minimumStock: 5,
  ...over,
});

/** Filtros do backend que não são campos diretos do item (stockStatus e groups por id). */
export const itemCustomFilters = {
  stockStatus: (row: any, f: any) => (f.value === 'ZERO' ? row.quantity === 0 : row.quantity > 0),
  groups: (row: any, f: any) => (row.groups ?? []).some((g: any) => g.id === f.value),
};
