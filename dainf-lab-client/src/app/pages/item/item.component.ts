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
    TableModule
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

  userHasAdvancedPrivileges = toSignal(this.userService.hasAdvancedPrivileges(), { initialValue: false });

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
      null,
      Validators.compose([Validators.required]),
    ],
    minimumStock: [
      null,
      (control: any) => {
        if (!this.form) return null;
        const qty = this.form.get('quantity')?.value;
        const minStock = control.value;
        if (qty !== null && minStock !== null && minStock < qty) {
          return { invalidQuantity: true };
        }
        return null;
      }
    ],
  });

  assetForm: FormGroup = this.formBuilder.group({
    id: [null],
    location: [
      null,
      Validators.compose([Validators.maxLength(255)]),
    ],
    serialNumber: [
      null,
      Validators.compose([Validators.maxLength(255)]),
    ],
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
          ? item.location
          : item.assets?.map((asset) => asset?.location).filter(loc => loc && String(loc).trim() !== '').join(', '),
    },
  ];

  assetCols: Column<Asset>[] = [
    { field: 'serialNumber', header: 'Patrimônio' },
    { field: 'location', header: 'Localização' },
  ];

  ngOnInit() {
    const syncAssetsToQuantity = () => {
      const type = this.form.get('type')?.value;
      const qtyControl = this.form.get('minimumStock');
      const qty = qtyControl?.value;
      
      if (type === 'DURABLE' && qty != null && qty >= 0) {
        const currentAssets = this.form.get('assets')?.value || [];
        if (currentAssets.length !== qty) {
          if (qty < currentAssets.length) {
            const filledAssetsCount = currentAssets.filter((a: any) => 
               (a.serialNumber && String(a.serialNumber).trim() !== '') || 
               (a.location && String(a.location).trim() !== '')
            ).length;
            
            if (qty < filledAssetsCount) {
              this.messageService.add({
                severity: 'error',
                summary: 'Ação Inválida',
                detail: 'Não é possível diminuir a quantidade abaixo dos itens já preenchidos. Remova itens pela lixeira primeiro.'
              });
              qtyControl?.setValue(currentAssets.length, { emitEvent: false });
              return;
            }

            const amountToRemove = currentAssets.length - qty;
            let removedCount = 0;
            const newAssets = currentAssets.filter((a: any) => {
              const isEmpty = (!a.serialNumber || String(a.serialNumber).trim() === '') && (!a.location || String(a.location).trim() === '');
              if (removedCount < amountToRemove && isEmpty) {
                removedCount++;
                return false;
              }
              return true;
            });
            this.form.get('assets')?.setValue(newAssets, { emitEvent: false });
            return;
          }

          const newAssets = [...currentAssets];
          for (let i = currentAssets.length; i < qty; i++) {
            newAssets.push({ _isNew: true, _needsEdit: true });
          }
          this.form.get('assets')?.setValue(newAssets, { emitEvent: false });
          
          setTimeout(() => {
             const updated = this.form.get('assets')?.value || [];
             updated.forEach((a: any) => delete a._isNew);
             this.form.get('assets')?.setValue([...updated], { emitEvent: false });
          }, 2000);
        }
      }
    };

    this.form.get('minimumStock')?.valueChanges.pipe(
      debounceTime(800),
      distinctUntilChanged()
    ).subscribe(() => syncAssetsToQuantity());

    this.form.get('quantity')?.valueChanges.pipe(
      debounceTime(800),
      distinctUntilChanged()
    ).subscribe(() => {
      this.form.get('minimumStock')?.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('type')?.valueChanges.subscribe(() => syncAssetsToQuantity());

    this.form.get('assets')?.valueChanges.subscribe((assets: any[]) => {
      const type = this.form.get('type')?.value;
      if (type === 'DURABLE') {
        const qty = this.form.get('minimumStock')?.value;
        if (assets && assets.length !== qty) {
          this.form.get('minimumStock')?.setValue(assets.length, { emitEvent: false });
        }
      }
    });
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
