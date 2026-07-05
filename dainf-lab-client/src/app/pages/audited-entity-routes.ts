import { CrudComponent } from '@/shared/crud/crud.component';

/**
 * Maps an audited entity key (mirrors the server's `AuditableEntity` enum) to the route
 * where its records are managed. Entities without a dedicated top-level page are
 * intentionally left out — callers should treat a missing entry as "no link available".
 *
 * Update this alongside `pages.routes.ts` whenever a route for an audited entity is
 * added, renamed or removed, so links to it (e.g. from the audit log) stay correct.
 */
export const AUDITED_ENTITY_ROUTES: Partial<Record<string, string>> = {
  CATEGORY: 'category',
  FORNECEDOR: 'supplier',
  USER: 'user',
  ITEM: 'item',
  PURCHASE: 'purchase',
  LOAN: 'loan',
  ISSUE: 'issue',
  INVENTORY_TRANSACTION: 'inventory-history',
  RESERVATION: 'reservation',
  SOLICITATION: 'purchase-solicitation',
  CONFIGURATION: 'configuration',
};

export interface AuditedEntityLink {
  route: string;
  queryParams: Record<string, unknown>;
}

export function auditedEntityRoute(entityKey: string): string | undefined {
  return AUDITED_ENTITY_ROUTES[entityKey];
}

/**
 * Builds a link to the exact record edited in an audit entry. Pages built on `app-crud`
 * pick up the `openId` query param automatically and open that record's edit dialog —
 * see `CrudComponent.OPEN_ID_QUERY_PARAM`.
 */
export function auditedEntityLink(
  entityKey: string,
  entityId?: number | null,
): AuditedEntityLink | undefined {
  const route = auditedEntityRoute(entityKey);
  if (!route) {
    return undefined;
  }
  return {
    route,
    queryParams:
      entityId != null ? { [CrudComponent.OPEN_ID_QUERY_PARAM]: entityId } : {},
  };
}
