import { Component, computed, inject, model, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ItemService } from '../item/item.service';
import { CategoryService } from '../category/category.service';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { Item, ItemType } from '../item/item';
import { CrudComponent } from '@/shared/crud/crud.component';
import { SearchFilter, SearchRequest } from '@/shared/models/search';
import { Category } from '../category/category';
import { CategorySelectComponent } from '@/shared/components/category-select/category-select.component';
import { CategoryTreeNodePipe } from '@/shared/pipes/category-tree-node.pipe';
import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { StaticSelectComponent } from '@/shared/components/static-select/static-select.component';
import { LabelValue } from '@/shared/models/label-value';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { LeakageDialogComponent } from './leakage-dialog/leakage-dialog.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CrudComponent,
    InputContainerComponent,
    CategorySelectComponent,
    StaticSelectComponent,
    InputTextModule,
    ButtonModule,
    TooltipModule
  ],
  providers: [
    ItemService,
    CategoryService,
    DialogService,
    CategoryTreeNodePipe
  ],
  selector: 'app-leakage',
  templateUrl: './leakage.component.html',
})
export class LeakageComponent {
  itemService = inject(ItemService);
  dialogService = inject(DialogService);
  
  @ViewChild('crud') crud!: CrudComponent<Item>;
  dialogRef: DynamicDialogRef | undefined;

  config: CrudConfig<Item> = {
    title: 'Registrar Perda / Extravio',
  };

  itemTypeOptions: LabelValue<ItemType>[] = [
    { label: 'Consumível', value: 'CONSUMABLE' },
    { label: 'Durável', value: 'DURABLE' },
  ];

  cols: Column<Item>[] = [
    { field: 'code', header: 'Código' },
    { field: 'name', header: 'Nome' },
    { field: 'category.description', header: 'Categoria' },
    { field: 'quantity', header: 'Qtd. Disponível' },
    { field: 'minimumStock', header: 'Qtd. Total' },
    {
      field: 'assets',
      header: 'Localização',
      transform: (item: Item) =>
        item.type === 'CONSUMABLE'
          ? item.location
          : item.assets?.map((asset) => asset?.location).filter(loc => loc && String(loc).trim() !== '').join(', '),
    },
  ];

  nameFilter = model<string | undefined>();
  typeFilter = model<string | undefined>();
  categoryFilter = model<Category | undefined>();
  siorgFilter = model<string | undefined>();
  locationFilter = model<string | undefined>();

  clearFilters() {
    this.nameFilter.set(undefined);
    this.typeFilter.set(undefined);
    this.categoryFilter.set(undefined);
    this.siorgFilter.set(undefined);
    this.locationFilter.set(undefined);
  }

  get isDurableType(): boolean {
    const val: any = this.typeFilter();
    return val === 'DURABLE' || val?.value === 'DURABLE';
  }

  searchRequest = computed<SearchRequest>(() => {
    const filters: SearchFilter[] = [];
    if (this.nameFilter())
      filters.push({ field: 'name', value: this.nameFilter(), type: 'ILIKE' });
    if (this.typeFilter())
      filters.push({ field: 'type', value: this.typeFilter(), type: 'EQUALS' });
    if (this.categoryFilter())
      filters.push({
        field: 'category.id',
        value: this.categoryFilter()?.id,
        type: 'EQUALS',
      });
    if (this.siorgFilter())
      filters.push({
        field: 'siorg',
        value: this.siorgFilter(),
        type: 'ILIKE',
      });
    if (this.locationFilter())
      filters.push({
        field: this.typeFilter() === 'CONSUMABLE' ? 'location' : 'assets.location',
        value: this.locationFilter(),
        type: 'ILIKE',
      });
    return <SearchRequest>{ filters };
  });

  openLeakageDialog(item: Item): void {
    this.dialogRef = this.dialogService.open(LeakageDialogComponent, {
      header: `Registrar Perda / Extravio`,
      width: '450px',
      modal: true,
      dismissableMask: true,
      data: { item },
    });

    this.dialogRef.onClose.subscribe((success) => {
      if (success && this.crud) {
         this.crud.loadItems(this.crud.lastPagination?.page, this.crud.lastPagination?.rows);
      }
    });
  }
}
