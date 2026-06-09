import { Identifiable } from '@/shared/crud/crud';

export type InventoryTransactionType = 'PURCHASE' | 'ISSUE' | 'RETURN' | 'LOAN';

export interface InventoryTransaction extends Identifiable {
  itemId: number;
  itemName: string;
  type: InventoryTransactionType;
  quantity: number;
  userName: string;
  date: string;
  currentQuantity: number;
}
