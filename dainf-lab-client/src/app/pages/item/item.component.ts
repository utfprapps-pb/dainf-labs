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
import { AfterViewInit, Component, computed, inject, model, TemplateRef, viewChild } from '@angular/core';
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
import { MultiSelectModule } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, map, of, switchMap } from 'rxjs';
import { Category } from '../category/category';
import { CategoryService } from '../category/category.service';
import { Group } from '../group/group';
import { GroupService } from '../group/group.service';
import { LoanService } from '../loan/loan.service';
import { UserService } from '../user/user.service';
import { ActiveLoansDialog } from './active-loans-dialog/active-loans-dialog';
import { Asset, Item, ItemType } from './item';
import { ItemService } from './item.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    MultiSelectModule,
    Select,
    InputContainerComponent,
    CrudComponent,
    CategorySelectComponent,
    FieldsetModule,
    SubItemFormComponent,
    InputNumberModule,
    StaticSelectComponent,
    PhotoAttachmentComponent,
    ButtonModule,
    TagModule,
    ToggleSwitchModule,
    TooltipModule,
    TableModule
  ],
  providers: [
    ItemService,
    CategoryService,
    GroupService,
    UserService,
    LabelValuePipe,
    CategoryTreeNodePipe,
    LoanService,
    DialogService,
  ],
  selector: 'app-item',
  templateUrl: 'item.component.html',
})
export class ItemComponent implements AfterViewInit {
  restrictedTemplate = viewChild<TemplateRef<any>>('restrictedTemplate');
  groupsTemplate = viewChild<TemplateRef<any>>('groupsTemplate');

  templateMap: Map<keyof Item | string, TemplateRef<any>> | undefined;
  userService = inject(UserService);
  itemService = inject(ItemService);
  categoryService = inject(CategoryService);
  groupService = inject(GroupService);
  loanService = inject(LoanService);
  formBuilder = inject(FormBuilder);
  labelValue = inject(LabelValuePipe);
  cartService = inject(CartService);
  dialogService = inject(DialogService);

  dialogRef: DynamicDialogRef | undefined;

  userHasAdvancedPrivileges = toSignal(this.userService.hasAdvancedPrivileges(), { initialValue: false });

  groups = toSignal(
    this.userService.hasAdvancedPrivileges().pipe(
      switchMap((hasPrivileges) =>
        hasPrivileges
          ? this.groupService.search({ rows: 1000, filters: [] })
          : of({ content: [] }),
      ),
      map((page) => page.content),
      catchError(() => of([] as Group[])),
    ),
    { initialValue: [] as Group[] },
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
    restricted: [false],
    groups: [[]],
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
    { field: 'restricted', header: 'Uso' },
    { field: 'groups', header: 'Grupos' },
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

  restrictedOptions: LabelValue<boolean | null>[] = [
    { label: 'Todos', value: null },
    { label: 'Sim', value: true },
    { label: 'Não', value: false },
  ];

  nameFilter = model<string | undefined>();
  typeFilter = model<string | undefined>();
  categoryFilter = model<Category | undefined>();
  siorgFilter = model<string | undefined>();
  locationFilter = model<string | undefined>();
  idFilter = model<string | undefined>();
  restrictedFilter = model<boolean | null>(null);
  groupFilter = model<Group | null>(null);

  searchRequest = computed<SearchRequest>(() => {
    const filters: SearchFilter[] = [];
    if (this.idFilter())
      filters.push({ field: 'id', value: this.idFilter(), type: 'EQUALS' });
    if (this.restrictedFilter() !== null)
      filters.push({
        field: 'restricted',
        value: this.restrictedFilter(),
        type: 'EQUALS',
      });
    if (this.groupFilter())
      filters.push({
        field: 'groups',
        value: this.groupFilter()?.id,
        type: 'EQUALS',
      });
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

  ngAfterViewInit(): void {
    this.templateMap = new Map([
      ['restricted', this.restrictedTemplate()!],
      ['groups', this.groupsTemplate()!],
    ]);
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
