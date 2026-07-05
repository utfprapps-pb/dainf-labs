import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { StaticSelectComponent } from '@/shared/components/static-select/static-select.component';
import { SubItemFormComponent } from '@/shared/components/subitem-form/subitem-form.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { LabelValuePipe } from '@/shared/pipes/label-value.pipe';
import { ContextStore } from '@/shared/store/context-store.service';
import { Page, SearchFilter, SearchRequest } from '@/shared/models/search';
import { CommonModule, DatePipe } from '@angular/common';
import { map } from 'rxjs/operators';
import { TreeSelectModule } from 'primeng/treeselect';
import { TreeNode } from 'primeng/api';
import { CategoryTreeNodePipe } from '@/shared/pipes/category-tree-node.pipe';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  model,
  OnInit,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogService } from 'primeng/dynamicdialog';
import { FieldsetModule } from 'primeng/fieldset';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { PaginatorModule } from 'primeng/paginator';
import { CategoryService } from '../category/category.service';
import { ItemService } from '../item/item.service';
import { User } from '../user/user';
import { UserService } from '../user/user.service';
import { Loan, LoanItem, LoanStatus } from './loan';
import { LoanService } from './loan.service';
import { ReturnService } from '../return/return.service';
import { LoanReturnDialog } from './return-dialog/return-dialog';
import { LoanDetailDialog } from './loan-detail/loan-detail.component';
import { BarcodeScannerComponent } from '@/shared/components/barcode-scanner/barcode-scanner.component';

const STATUS_SEVERITY: Record<LoanStatus, 'success' | 'danger' | 'info'> = {
  ONGOING: 'info',
  OVERDUE: 'danger',
  COMPLETED: 'success',
};

const STATUS_ICON: Record<LoanStatus, string> = {
  ONGOING: 'pi pi-clock',
  OVERDUE: 'pi pi-exclamation-triangle',
  COMPLETED: 'pi pi-check-circle',
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputContainerComponent,
    FieldsetModule,
    SubItemFormComponent,
    CrudComponent,
    SearchSelectComponent,
    InputNumberModule,
    DatePickerModule,
    TextareaModule,
    InputGroupModule,
    InputGroupAddonModule,
    ButtonModule,
    StaticSelectComponent,
    BarcodeScannerComponent,
    TagModule,
    PaginatorModule,
    TreeSelectModule,
  ],
  providers: [
    LoanService,
    ReturnService,
    CategoryService,
    LabelValuePipe,
    ItemService,
    UserService,
    DialogService,
    DatePipe,
    CategoryTreeNodePipe,
  ],
  selector: 'app-loan',
  templateUrl: 'loan.component.html',
  styles: [
    `
      :host ::ng-deep .hide-crud-list app-crud-table {
        display: none !important;
      }
      :host ::ng-deep p-toolbar {
        display: none !important;
      }
    `,
  ],
})
export class LoanComponent implements OnInit, AfterViewInit {
  statusTemplate = viewChild('statusTemplate', { read: TemplateRef<any> });

  templateMap: Map<keyof Loan | string, TemplateRef<any>> | undefined;

  loanService = inject(LoanService);
  dialogService = inject(DialogService);
  formBuilder = inject(FormBuilder);
  labelValue = inject(LabelValuePipe);
  itemService = inject(ItemService);
  userService = inject(UserService);
  context = inject(ContextStore);

  itemFilters = [
    { field: 'quantity', type: 'GREATER', value: '0' } as any
  ];

  getItemLabel = (item: any) => {
    return `${item.name} (Estoque: ${item.quantity || 0})`;
  };

  datePipe = inject(DatePipe);
  route = inject(ActivatedRoute);
  categoryTreeNodePipe = inject(CategoryTreeNodePipe);

  hasAdvancedPrivileges = toSignal(this.userService.hasAdvancedPrivileges(), {
    initialValue: false,
  });

  crud = viewChild(CrudComponent);
  subItem = viewChild(SubItemFormComponent);

  status = [
    { label: 'Em aberto', value: 'ONGOING' },
    { label: 'Atrasado', value: 'OVERDUE' },
    { label: 'Finalizado', value: 'COMPLETED' },
  ];

  disabled = signal(false);
  viewMode = signal<'list' | 'cards'>('cards');
  categories = signal<any[]>([]);
  cardItemFilter = signal<string>('ALL');
  filterNodes = signal<TreeNode[]>([]);
  selectedFilterNode = signal<TreeNode | null>(null);

  onFilterChange() {
    const node = this.selectedFilterNode();
    this.cardItemFilter.set(node ? node.data : 'ALL');
  }

  activeBorrowerService = {
    search: (req: SearchRequest) => {
      const newFilters = req.filters ? [...req.filters] : [];
      newFilters.push({
        field: 'status',
        value: ['ONGOING', 'OVERDUE'],
        type: 'IN',
      });
      const nameFilter = newFilters.find((f) => f.field === 'nome');
      if (nameFilter) nameFilter.field = 'borrower.nome';

      return this.loanService.search({ ...req, filters: newFilters }).pipe(
        map((loanPage) => {
          const users = loanPage.content.map((l) => l.borrower);
          const uniqueUsers = Array.from(
            new Map(users.map((u) => [u.id, u])).values(),
          );
          return {
            content: uniqueUsers,
            page: loanPage.page,
          } as Page<User>;
        }),
      );
    },
  } as any;

  config: CrudConfig<Loan> = {
    title: 'Empréstimos',
    dialogWidth: '80vw',
  };

  form: FormGroup = this.formBuilder.group({
    id: [{ value: null, disabled: true }],
    borrower: [null, Validators.required],
    loanDate: [new Date(), Validators.required],
    deadline: [null, Validators.required],
    observation: [null],
    items: [[], [Validators.required, Validators.minLength(1)]],
  });

  loanItensForm: FormGroup = this.formBuilder.group({
    id: [null],
    item: [null, Validators.required],
    shouldReturn: [false],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  cols: Column<Loan>[] = [
    { field: 'id', header: 'Código' },
    { field: 'borrower.nome', header: 'Mutuário' },
    {
      field: 'loanDate',
      header: 'Data do empréstimo',
      transform: (row) =>
        this.datePipe.transform(row.loanDate, 'dd/MM/yyyy') || '',
    },
    {
      field: 'deadline',
      header: 'Prazo / Devolução',
      transform: (row) => {
        if (row.status === 'COMPLETED' && (row as any).actualReturnDate) {
          return (
            this.datePipe.transform(
              (row as any).actualReturnDate,
              'dd/MM/yyyy',
            ) || ''
          );
        }
        return this.datePipe.transform(row.deadline, 'dd/MM/yyyy') || '';
      },
    },
    {
      field: 'status',
      header: 'Status',
      transform: (row) => this.labelValue.transform(row.status, this.status),
    },
  ];

  itensCols: Column<LoanItem>[] = [
    { field: 'item.name', header: 'Nome' },
    { field: 'quantity', header: 'Quantidade' },
  ];

  loanDateFilter = model<string | Date | undefined>();
  borrowerFilter = model<User | undefined>();
  raSiapeFilter = model<string | undefined>();
  statusFilter = model<string | undefined>();
  searchRequest = computed<SearchRequest>(() => {
    const filters: SearchFilter[] = [];

    if (this.loanDateFilter()) {
      const dateValue = this.loanDateFilter();
      const date =
        dateValue instanceof Date ? dateValue : new Date(dateValue as string);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filters.push({
        field: 'loanDate',
        value: [startOfDay.toISOString(), endOfDay.toISOString()],
        type: 'BETWEEN',
      });
    }
    if (this.hasAdvancedPrivileges() && this.borrowerFilter()) {
      filters.push({
        field: 'borrower.id',
        value: this.borrowerFilter()?.id,
        type: 'EQUALS',
      });
    }
    if (this.raSiapeFilter()) {
      filters.push({
        field: 'borrower.documento',
        value: this.raSiapeFilter(),
        type: 'ILIKE',
      });
    }
    if (this.statusFilter()) {
      filters.push({
        field: 'status',
        value: this.statusFilter(),
        type: 'EQUALS',
      });
    } else {
      filters.push({
        field: 'status',
        value: ['ONGOING', 'OVERDUE'],
        type: 'IN',
      });
    }
    return <SearchRequest>{ filters, sort: { field: 'id', type: 'DESC' } };
  });

  categoryService = inject(CategoryService);

  ngOnInit(): void {
    this.categoryService
      .search({
        page: 0,
        rows: 1000,
        filters: [{ field: 'parent', type: 'IS_NULL' }],
      })
      .subscribe((page: any) => {
        const categoryNodes = this.categoryTreeNodePipe.transform(page.content);

        const mapNode = (node: TreeNode<any>): TreeNode => {
          return {
            label: node.label,
            key: 'CAT:' + node.data!.id,
            data: 'CAT:' + node.data!.id,
            children: node.children?.map((c) => mapNode(c)),
            leaf: node.leaf,
            icon: node.icon,
          };
        };

        const categoryChildren = categoryNodes.map((n) => mapNode(n));
        const allNode: TreeNode = {
          label: 'Todos os itens',
          data: 'ALL',
          key: 'ALL',
          icon: 'pi pi-list',
        };

        this.filterNodes.set([
          allNode,
          {
            label: 'Consumíveis',
            data: 'TYPE:CONSUMABLE',
            key: 'TYPE:CONSUMABLE',
            icon: 'pi pi-box',
          },
          {
            label: 'Duráveis',
            data: 'TYPE:DURABLE',
            key: 'TYPE:DURABLE',
            icon: 'pi pi-server',
            children: categoryChildren,
          },
        ]);
        this.selectedFilterNode.set(allNode);
      });

    const data = this.context.consume('reservation');
    if (data) {
      setTimeout(() => {
        this.crud()?.openNew();
        this.form.patchValue({ items: data.items, borrower: data.borrower });
      });
    }

    this.form.get('borrower')?.valueChanges.subscribe((user) => {
      // Only do this if we are not already editing an existing loan (id is null)
      if (user && user.id && !this.form.get('id')?.value && !this.disabled()) {
        const req: SearchRequest = {
          filters: [
            { field: 'borrower.id', value: user.id, type: 'EQUALS' },
            { field: 'status', value: ['ONGOING', 'OVERDUE'], type: 'IN' },
          ],
          sort: { field: 'id', type: 'ASC' },
          page: 0,
          rows: 1,
        };
        this.loanService.search(req).subscribe((page) => {
          if (page.content.length > 0) {
            const activeLoan = page.content[0];
            this.form.patchValue({
              id: activeLoan.id,
              loanDate: new Date(activeLoan.loanDate),
              deadline: new Date(activeLoan.deadline),
              observation: activeLoan.observation,
              items: activeLoan.items,
            });
            const messageService = this.crud()?.messageService;
            if (messageService) {
              messageService.add({
                severity: 'info',
                summary: 'Aviso',
                detail:
                  'Mutuário com empréstimo ativo! Os dados foram carregados para que novos itens sejam adicionados à mesma ficha.',
              });
            }
          }
        });
      }
    });

    this.route.queryParams.subscribe((params) => {
      if (params['id']) {
        const id = +params['id'];
        this.loanService.get(id).subscribe({
          next: (res) => {
            if (res) {
              this.openEdit(res);
            }
          },
          error: (err) =>
            console.error('Erro ao buscar empréstimo da URL', err),
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.templateMap = new Map([['status', this.statusTemplate()!]]);
  }

  statusSeverity(status: LoanStatus): 'success' | 'danger' | 'info' {
    return STATUS_SEVERITY[status];
  }

  statusIcon(status: LoanStatus): string {
    return STATUS_ICON[status];
  }

  clearFilters() {
    this.loanDateFilter.set(undefined);
    this.borrowerFilter.set(undefined);
    this.raSiapeFilter.set(undefined);
    this.statusFilter.set(undefined);
    this.crud()?.loadItems();
    this.crud()?.drawerVisible.set(false);
  }

  onEntityLoad(loan: Loan) {
    this.form.patchValue({
      loanDate: new Date(loan.loanDate),
      deadline: new Date(loan.deadline),
    });

    setTimeout(() => {
      this.loanItensForm.disable();
      this.form.get('borrower')?.disable();

      this.loanItensForm.updateValueAndValidity();
      this.form.get('borrower')?.updateValueAndValidity();

      this.disabled.set(true);
    }, 100);
  }

  onUserScanned(user: any) {
    if (this.hasAdvancedPrivileges()) {
      this.form.get('borrower')?.setValue(user);
    }
  }

  onItemScanned(item: any) {
    const currentItems = this.form.get('items')?.value || [];
    const existingIndex = currentItems.findIndex(
      (i: any) => i.item.id === item.id,
    );
    if (existingIndex > -1) {
      currentItems[existingIndex].quantity += 1;
    } else {
      currentItems.push({ item: item, quantity: 1, shouldReturn: false });
    }
    this.form.get('items')?.setValue([...currentItems]);
  }

  onCancel() {
    this.loanItensForm.enable();
    this.form.get('borrower')?.enable();

    this.loanItensForm.updateValueAndValidity();
    this.form.get('borrower')?.updateValueAndValidity();

    this.disabled.set(false);
  }

  openReturnDialog(loan: Loan) {
    const ref = this.dialogService.open(LoanReturnDialog, {
      header: `Devolução de empréstimo`,
      width: '90vw',
      style: { maxWidth: '1200px' },
      modal: true,
      dismissableMask: true,
      data: { loan },
      styleClass: 'return-ficha-modal',
    });

    ref.onClose.subscribe((result: any) => {
      if (result?.success) {
        this.crud()?.loadItems();
      }
    });
  }

  openEdit(loan: Loan) {
    const ref = this.dialogService.open(LoanDetailDialog, {
      header: 'Ficha de Empréstimo',
      width: '90vw',
      style: { maxWidth: '1200px' },
      modal: true,
      dismissableMask: true,
      data: { loan, showHistory: true },
      styleClass: 'return-ficha-modal',
    });

    ref.onClose.subscribe((updatedLoan: Loan) => {
      if (updatedLoan) {
        this.crud()?.loadItems();
      }
    });
  }

  toggleView() {
    this.viewMode.update((v) => (v === 'list' ? 'cards' : 'list'));
  }

  getFilteredItems(items: any[]) {
    const filter = this.cardItemFilter();
    if (!items) return [];
    
    // Por padrao, mostra apenas itens GRANDES (DURABLE) para nǜo poluir o card com componentes.
    if (filter === 'ALL') return items.filter((i) => i.item?.type === 'DURABLE');
    
    if (filter.startsWith('TYPE:')) {
      const type = filter.split(':')[1];
      return items.filter((i) => i.item?.type === type);
    }
    if (filter.startsWith('CAT:')) {
      const catId = Number(filter.split(':')[1]);
      return items.filter((i) => i.item?.category?.id === catId);
    }
    return items;
  }

  get groupedUserLoans(): any[] {
    const content = this.crud()?.items()?.content;
    if (!content) return [];

    const userMap = new Map<number, any>();
    for (const loanItem of content) {
      const loan = loanItem as any;
      const borrowerId = loan.borrower.id;
      if (!userMap.has(borrowerId)) {
        userMap.set(borrowerId, {
          ...loan,
          allLoans: [loan],
          allItems: [...loan.items],
        });
      } else {
        const existing = userMap.get(borrowerId);
        existing.allLoans.push(loan);
        existing.allItems.push(...loan.items);
      }
    }
    return Array.from(userMap.values());
  }
}
