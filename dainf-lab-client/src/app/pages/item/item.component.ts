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
import { Component, computed, inject, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { extractErrorMessage } from '@/shared/utils/error.utils';
import { ButtonModule } from 'primeng/button';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FieldsetModule } from 'primeng/fieldset';
import { TableModule } from 'primeng/table';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { Category } from '../category/category';
import { CategoryService } from '../category/category.service';
import { LoanService } from '../loan/loan.service';
import { UserService } from '../user/user.service';
import { ActiveLoansDialog } from './active-loans-dialog/active-loans-dialog';
import { Asset, Item, ItemType } from './item';
import { AllItemsService } from './item.service';

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
    MenuModule,
    TooltipModule,
    TableModule
  ],
  providers: [
    AllItemsService,
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
export class ItemComponent {
  userService = inject(UserService);
  itemService = inject(AllItemsService);
  categoryService = inject(CategoryService);
  loanService = inject(LoanService);
  formBuilder = inject(FormBuilder);
  labelValue = inject(LabelValuePipe);
  cartService = inject(CartService);
  dialogService = inject(DialogService);
  confirmationService = inject(ConfirmationService);
  messageService = inject(MessageService);

  dialogRef: DynamicDialogRef | undefined;
  private readonly itemActionCache = new WeakMap<Item, MenuItem[]>();

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
    name: [
      null,
      Validators.compose([Validators.required, Validators.maxLength(100)]),
    ],
    description: [null],
    price: [null, Validators.min(0)],
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
    minimumStock: [null],
  });

  assetForm: FormGroup = this.formBuilder.group({
    id: [null],
    location: [
      null,
      Validators.compose([Validators.required, Validators.maxLength(255)]),
    ],
    serialNumber: [
      null,
      Validators.compose([Validators.required, Validators.maxLength(255)]),
    ],
  });

  itemTypeOptions: LabelValue<ItemType>[] = [
    { label: 'Consumível', value: 'CONSUMABLE' },
    { label: 'Durável', value: 'DURABLE' },
  ];

  cols: Column<Item>[] = [
    { field: 'id', header: 'Código' },
    { field: 'name', header: 'Nome' },
    { field: 'active', header: 'Situação', transform: item => item.active ? 'Ativo' : 'Inativo' },
    { field: 'category.description', header: 'Categoria' },
    { field: 'quantity', header: 'Quantidade' },
    {
      field: 'assets',
      header: 'Localização',
      transform: (item: Item) =>
        item.type === 'CONSUMABLE'
          ? item.location
          : item.assets?.map((asset) => asset?.location)?.join(', '),
    },
  ];

  assetCols: Column<Asset>[] = [
    { field: 'serialNumber', header: 'Patrimônio' },
    { field: 'location', header: 'Localização' },
  ];

  activeFilter = model<string>('active');
  activeOptions = [
    { label: 'Ativos', value: 'active' },
    { label: 'Inativos', value: 'inactive' },
    { label: 'Todos', value: 'all' },
  ];

  stockFilter = model<string>('all');
  stockOptions = [
    { label: 'Todos', value: 'all' },
    { label: 'Saldo zerado', value: 'ZERO' },
    { label: 'Com saldo', value: 'POSITIVE' },
  ];

  nameFilter = model<string | undefined>();
  typeFilter = model<string | undefined>();
  categoryFilter = model<Category | undefined>();
  siorgFilter = model<string | undefined>();
  locationFilter = model<string | undefined>();
  idFilter = model<string | undefined>();

  searchRequest = computed<SearchRequest>(() => {
    const filters: SearchFilter[] = [];
    if (this.activeFilter() === 'active' || this.activeFilter() === 'inactive') {
      filters.push({ field: 'active', value: this.activeFilter() === 'active', type: 'EQUALS' });
    }
    if (this.stockFilter() !== 'all') {
      filters.push({
        field: 'stockStatus',
        value: this.stockFilter(),
        type: 'EQUALS',
      });
    }
    if (this.idFilter())
      filters.push({ field: 'id', value: this.idFilter(), type: 'EQUALS' });
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

  changeActive(item: Item, crud: CrudComponent<Item>): void {
    const active = !item.active;
    this.confirmationService.confirm({
      header: active ? 'Reativar item' : 'Inativar item',
      message: active
        ? `Reativar "${item.name}" para novas operações?`
        : `Inativar “${item.name}”?<br>O histórico será mantido.`,
      acceptLabel: 'Confirmar',
      rejectLabel: 'Cancelar',
      accept: () => this.itemService.setActive(item.id, active).subscribe({
        next: () => {
          crud.loadItems();
          this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: active ? 'Item reativado.' : 'Item inativado.' });
        },
        error: error => this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: extractErrorMessage(error) }),
      }),
    });
  }

  itemActions(item: Item, crud: CrudComponent<Item>): MenuItem[] {
    const cachedActions = this.itemActionCache.get(item);
    if (cachedActions) {
      return cachedActions;
    }

    const actions: MenuItem[] = [
      {
        label: 'Excluir',
        icon: 'pi pi-trash',
        command: () => queueMicrotask(() => crud.deleteOne(item)),
      },
      {
        label: item.active ? 'Inativar' : 'Reativar',
        icon: item.active ? 'pi pi-ban' : 'pi pi-check-circle',
        command: () => queueMicrotask(() => this.changeActive(item, crud)),
      },
    ];
    this.itemActionCache.set(item, actions);
    return actions;
  }

  addToCart(item: Item): void {
    this.cartService.addItem(item);
  }

  showActiveLoans(item: Item): void {
    this.loanService.getActiveLoansForItem(item.id).subscribe((loans) => {
      this.dialogRef = this.dialogService.open(ActiveLoansDialog, {
        header: `Empréstimos Ativos: ${item.name}`,
        width: '60%',
        contentStyle: { 'max-height': '500px', overflow: 'auto' },
        modal: true,
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
        baseZIndex: 10000,
        data: {
          loans: loans,
          itemName: itemName,
        },
      });
    });
  }
}
