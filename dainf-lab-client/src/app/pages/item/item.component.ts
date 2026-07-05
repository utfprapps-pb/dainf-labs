import { CategorySelectComponent } from '@/shared/components/category-select/category-select.component';
import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { PhotoAttachmentComponent } from '@/shared/components/photo-attachment/photo-attachment.component';
import { StaticSelectComponent } from '@/shared/components/static-select/static-select.component';
import { SubItemFormComponent } from '@/shared/components/subitem-form/subitem-form.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { LabelValue } from '@/shared/models/label-value';
import { SearchFilter, SearchRequest } from '@/shared/models/search';
import { CategoryTreeNodePipe } from '@/shared/pipes/category-tree-node.pipe';
import { LabelValuePipe } from '@/shared/pipes/label-value.pipe';
import { CartService } from '@/shared/services/cart.service';
import { StorageImplService } from '@/shared/storage/storage-impl.service';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Component, computed, inject, model, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FieldsetModule } from 'primeng/fieldset';
import { TableModule } from 'primeng/table';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { Category } from '../category/category';
import { CategoryService } from '../category/category.service';
import { LoanService } from '../loan/loan.service';
import { UserService } from '../user/user.service';
import { ActiveLoansDialog } from './active-loans-dialog/active-loans-dialog';
import { Asset, Item, ItemType } from './item';
import { ItemService } from './item.service';
import { MessageService } from 'primeng/api';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputContainerComponent,
    CrudComponent,
    CategorySelectComponent,
    FieldsetModule,
    SubItemFormComponent,
    InputNumberModule,
    StaticSelectComponent,
    PhotoAttachmentComponent,
    ButtonModule,
    TooltipModule,
    TableModule,
  ],
  providers: [
    ItemService,
    CategoryService,
    UserService,
    LabelValuePipe,
    CategoryTreeNodePipe,
    LoanService,
    DialogService,
  ],
  selector: 'app-item',
  templateUrl: 'item.component.html',
})
export class ItemComponent implements OnInit {
  userService = inject(UserService);
  itemService = inject(ItemService);
  categoryService = inject(CategoryService);
  loanService = inject(LoanService);
  formBuilder = inject(FormBuilder);
  labelValue = inject(LabelValuePipe);
  cartService = inject(CartService);
  dialogService = inject(DialogService);
  messageService = inject(MessageService);

  dialogRef: DynamicDialogRef | undefined;

  userHasAdvancedPrivileges = toSignal(
    this.userService.hasAdvancedPrivileges(),
    { initialValue: false },
  );

  storageService = new StorageImplService(
    `${this.itemService._url}/storage`,
    'item',
  );

  config: CrudConfig<Item> = {
    title: 'Itens',
  };

  form: FormGroup = this.formBuilder.group({
    id: [{ value: null, disabled: true }],
    code: [null],
    name: [
      null,
      Validators.compose([Validators.required, Validators.maxLength(50)]),
    ],
    description: [null],
    price: [null],
    category: [null, Validators.required],
    assets: [null],
    images: [null],
    siorg: [null],
    location: [null, Validators.compose([Validators.maxLength(255)])],
    type: [null, Validators.required],
    quantity: [
      { value: null, disabled: true },
      Validators.compose([Validators.required]),
    ],
    minimumStock: [
      { value: null, disabled: true },
      (control: any) => {
        if (!this.form) return null;
        const qty = this.form.get('quantity')?.value;
        const minStock = control.value;
        if (qty !== null && minStock !== null && minStock < qty) {
          return { invalidQuantity: true };
        }
        return null;
      },
    ],
  });

  assetForm: FormGroup = this.formBuilder.group({
    id: [null],
    location: [null, Validators.compose([Validators.maxLength(255)])],
    serialNumber: [null, Validators.compose([Validators.maxLength(255)])],
  });

  itemTypeOptions: LabelValue<ItemType>[] = [
    { label: 'Consumível', value: 'CONSUMABLE' },
    { label: 'Durável', value: 'DURABLE' },
  ];

  cols: Column<Item>[] = [
    { field: 'code', header: 'Código' },
    { field: 'name', header: 'Nome' },
    { field: 'category.description', header: 'Categoria' },
    { field: 'quantity', header: 'Quantidade' },
    {
      field: 'assets',
      header: 'Localização',
      transform: (item: Item) =>
        item.type === 'CONSUMABLE'
          ? item.location?.toUpperCase()
          : Array.from(
              new Set(
                item.assets
                  ?.map((asset) => asset?.location)
                  .filter((loc) => loc && String(loc).trim() !== '')
                  .map((loc) => String(loc).trim().toUpperCase())
              )
            ).join(', '),
    },
  ];

  assetCols: Column<Asset>[] = [
    { field: 'serialNumber', header: 'Patrimônio' },
    { field: 'location', header: 'Localização' },
  ];

  ngOnInit() {}

  onEntityLoad(item: Item) {
    if (item && item.assets) {
      // Sort assets by location (alphabetically/numerically), then empty locations to the end.
      const sortedAssets = [...item.assets].sort((a, b) => {
        const locA = (a.location || '').trim();
        const locB = (b.location || '').trim();
        
        if (!locA && locB) return 1;
        if (locA && !locB) return -1;
        
        const locCmp = locA.localeCompare(locB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        if (locCmp !== 0) return locCmp;
        
        const serA = (a.serialNumber || '').trim();
        const serB = (b.serialNumber || '').trim();
        return serA.localeCompare(serB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
      
      this.form.patchValue({ assets: sortedAssets });
    }
  }

  get hasUneditedNewAssets(): boolean {
    const assets = this.form.get('assets')?.value;
    return assets ? assets.some((a: any) => a._needsEdit) : false;
  }

  selectInputText(event: any) {
    const target = event.originalEvent?.target || event.target;
    if (target && target.select) {
      target.select();
    }
  }

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
        field:
          this.typeFilter() === 'CONSUMABLE' ? 'location' : 'assets.location',
        value: this.locationFilter(),
        type: 'ILIKE',
      });
    return <SearchRequest>{ filters };
  });

  addToCart(item: Item): void {
    this.cartService.addItem(item);
  }

  showActiveLoans(item: Item): void {
    this.loanService.getActiveLoansForItem(item.id).subscribe((loans) => {
      this.dialogRef = this.dialogService.open(ActiveLoansDialog, {
        header: `Empréstimos Ativos: ${item.name}`,
        width: '75vw',
        modal: true,
        dismissableMask: true,
        contentStyle: { 'max-height': '500px', overflow: 'auto' },
        baseZIndex: 10000,
        data: {
          loans: loans,
          itemName: item.name,
        },
      });
    });
  }

  showAllLoans(): void {
    const itemId = this.form.get('id')?.value;
    const itemName = this.form.get('name')?.value;

    if (!itemId || !itemName) {
      console.error('ID ou Nome do Item não encontrado no formulário.');
      return;
    }

    this.loanService.getActiveLoansForItem(itemId).subscribe((loans) => {
      this.dialogRef = this.dialogService.open(ActiveLoansDialog, {
        header: `Empréstimos Ativos: ${itemName}`,
        width: '60%',
        contentStyle: { 'max-height': '500px', overflow: 'auto' },
        modal: true,
        dismissableMask: true,
        baseZIndex: 10000,
        data: {
          loans: loans,
          itemName: itemName,
        },
      });
    });
  }
}
