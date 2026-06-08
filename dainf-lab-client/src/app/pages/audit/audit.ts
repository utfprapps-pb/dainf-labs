import { Identifiable } from '@/shared/crud/crud';

export interface AuditEntry extends Identifiable<number> {
  id: number;
  revisionId: number;
  revisionDate: string;
  username: string;
  revisionType: 'ADD' | 'MOD' | 'DEL';
  entityKey: string;
  entityName: string;
  entityId: number;
  description: string;
}

export interface AuditEntityOption {
  key: string;
  label: string;
}

export interface AuditFieldChange {
  field: string;
  oldValue?: string;
  newValue?: string;
}

export interface AuditSearchRequest {
  entityKey?: string;
  username?: string;
  revisionType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  rows?: number;
}
