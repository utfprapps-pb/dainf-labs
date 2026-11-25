/**
 * Espelha dainf-lab-server/.../config/MenuConfig.java.
 * Se o menu do backend mudar, atualize aqui (o RoleGuard do front decide acesso por este menu).
 */
export type Role = 'ROLE_ADMIN' | 'ROLE_LAB_TECHNICIAN' | 'ROLE_PROFESSOR' | 'ROLE_STUDENT';

const ALL: Role[] = ['ROLE_ADMIN', 'ROLE_LAB_TECHNICIAN', 'ROLE_STUDENT', 'ROLE_PROFESSOR'];
const STAFF: Role[] = ['ROLE_ADMIN', 'ROLE_LAB_TECHNICIAN'];
const ADMIN: Role[] = ['ROLE_ADMIN'];

interface Entry {
  label: string;
  icon: string;
  routerLink: string;
  roles: Role[];
}

const e = (label: string, icon: string, routerLink: string, roles: Role[]): Entry => ({
  label,
  icon,
  routerLink,
  roles,
});

const GROUPS: { label: string; items: Entry[] }[] = [
  { label: 'Início', items: [e('Dashboard', 'pi pi-home', 'dashboard', ALL)] },
  {
    label: 'Operações',
    items: [
      e('Empréstimo', 'pi pi-clock', 'loan', ALL),
      e('Saída', 'pi pi-sign-out', 'issue', STAFF),
      e('Reserva', 'pi pi-calendar', 'reservation', ALL),
      e('Histórico de Estoque', 'pi pi-history', 'inventory-history', STAFF),
    ],
  },
  {
    label: 'Compras',
    items: [
      e('Nova Compra', 'pi pi-shopping-cart', 'purchase', STAFF),
      e('Solicitar Compra', 'pi pi-receipt', 'purchase-solicitation', STAFF),
    ],
  },
  {
    label: 'Cadastros',
    items: [
      e('Itens', 'pi pi-box', 'item', ALL),
      e('Categorias', 'pi pi-list', 'category', STAFF),
      e('Fornecedores', 'pi pi-truck', 'supplier', STAFF),
      e('Usuários', 'pi pi-users', 'user', STAFF),
      e('Grupos', 'pi pi-sitemap', 'group', STAFF),
    ],
  },
  {
    label: 'Sistema',
    items: [
      e('Configurações', 'pi pi-cog', 'configuration', ADMIN),
      e('Auditoria', 'pi pi-history', 'audit', ADMIN),
      e('Sobre', 'pi pi-info-circle', 'about', STAFF),
    ],
  },
];

export function menuFor(role: Role) {
  const items = GROUPS.map((g) => ({
    label: g.label,
    items: g.items
      .filter((i) => i.roles.includes(role))
      .map(({ roles: _roles, ...rest }) => rest),
  })).filter((g) => g.items.length > 0);
  return { items };
}

export function routesFor(role: Role): string[] {
  return menuFor(role).items.flatMap((g) => g.items.map((i) => i.routerLink));
}

export const ALL_ROUTES = GROUPS.flatMap((g) => g.items.map((i) => i.routerLink));
