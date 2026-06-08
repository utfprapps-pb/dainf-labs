import { CrudService } from '@/shared/crud/crud.service';
import { Injectable } from '@angular/core';
import { InventoryTransaction } from './inventory-history';

@Injectable()
export class InventoryHistoryService extends CrudService<InventoryTransaction> {
  constructor() {
    super('inventory-transactions');
  }
}
