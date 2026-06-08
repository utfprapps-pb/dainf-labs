import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { StaticSelectComponent } from '@/shared/components/static-select/static-select.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { SearchFilter, SearchRequest } from '@/shared/models/search';
import { LabelValuePipe } from '@/shared/pipes/label-value.pipe';
import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  model,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { Item } from '../item/item';
import { ItemService } from '../item/item.service';
import { InventoryTransaction, InventoryTransactionType } from './inventory-history';
import { InventoryHistoryService } from './inventory-history.service';

const ADDITION_TYPES: InventoryTransactionType[] = ['PURCHASE', 'RETURN'];

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputContainerComponent,
    SearchSelectComponent,
    StaticSelectComponent,
    DatePickerModule,
    TagModule,
    CrudComponent,
  ],
  providers: [InventoryHistoryService, ItemService, LabelValuePipe, DatePipe],
  selector: 'app-inventory-history',
  templateUrl: 'inventory-history.component.html',
})
export class InventoryHistoryComponent implements AfterViewInit {
  typeTemplate = viewChild('typeTemplate', { read: TemplateRef<any> });

  inventoryHistoryService = inject(InventoryHistoryService);
  itemService = inject(ItemService);
  labelValue = inject(LabelValuePipe);
  datePipe = inject(DatePipe);

  templateMap: Map<keyof InventoryTransaction | string, TemplateRef<any>> | undefined;

  config: CrudConfig<InventoryTransaction> = {
    title: 'Histórico de Estoque',
    allowDeletion: false,
    allowUpdate: false,
    allowEditing: false,
  };

  types = [
    { label: 'Compra', value: 'PURCHASE' },
    { label: 'Empréstimo', value: 'LOAN' },
    { label: 'Saída', value: 'ISSUE' },
    { label: 'Devolução', value: 'RETURN' },
  ];

  cols: Column<InventoryTransaction>[] = [
    { field: 'itemName', header: 'Item' },
    {
      field: 'type',
      header: 'Tipo',
      transform: (row) => this.labelValue.transform(row.type, this.types),
    },
    { field: 'quantity', header: 'Quantidade' },
    {
      field: 'date',
      header: 'Data',
      transform: (row) => this.datePipe.transform(row.date, 'dd/MM/yyyy HH:mm') || '',
    },
    { field: 'currentQuantity', header: 'Quantidade atual do item' },
  ];

  itemFilter = model<Item | undefined>();
  typeFilter = model<InventoryTransactionType | undefined>();
  dateRangeFilter = model<Date[]>([]);

  selectedItemQuantity = signal<number | undefined>(undefined);

  searchRequest = computed<SearchRequest>(() => {
    const filters: SearchFilter[] = [];

    if (this.itemFilter()) {
      filters.push({
        field: 'inventory.item.id',
        value: this.itemFilter()?.id,
        type: 'EQUALS',
      });
    }

    if (this.typeFilter()) {
      filters.push({
        field: 'type',
        value: this.typeFilter(),
        type: 'EQUALS',
      });
    }

    const range = this.dateRangeFilter();
    if (range && range.length === 2 && range[0] && range[1]) {
      const start = new Date(range[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(range[1]);
      end.setHours(23, 59, 59, 999);
      filters.push({
        field: 'date',
        value: [start.toISOString(), end.toISOString()],
        type: 'BETWEEN',
      });
    }

    return <SearchRequest>{ filters, sort: { field: 'date', type: 'DESC' } };
  });

  ngAfterViewInit(): void {
    this.templateMap = new Map([['type', this.typeTemplate()!]]);
  }

  isAdditionType(type: InventoryTransactionType): boolean {
    return ADDITION_TYPES.includes(type);
  }

  typeSeverity(type: InventoryTransactionType): 'success' | 'danger' {
    return this.isAdditionType(type) ? 'success' : 'danger';
  }

  typeIcon(type: InventoryTransactionType): string {
    return this.isAdditionType(type) ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  }

  onItemFilterChange(item: Item | undefined) {
    this.itemFilter.set(item);
    this.selectedItemQuantity.set(item ? Number(item.quantity ?? 0) : undefined);
  }

  clearFilters() {
    this.itemFilter.set(undefined);
    this.typeFilter.set(undefined);
    this.dateRangeFilter.set([]);
    this.selectedItemQuantity.set(undefined);
  }
}
