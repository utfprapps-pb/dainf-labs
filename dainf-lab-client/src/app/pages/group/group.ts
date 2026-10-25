import { Identifiable } from '@/shared/crud/crud';

export interface Group extends Identifiable {
  id: number;
  name?: string;
  description?: string;
  active?: boolean;
}
