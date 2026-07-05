import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  viewChild,
  signal,
} from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, TreeNode } from 'primeng/api';
import { TreeSelectModule } from 'primeng/treeselect';

import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { SubItemFormComponent } from '@/shared/components/subitem-form/subitem-form.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { DatePickerModule } from 'primeng/datepicker';
import { FieldsetModule } from 'primeng/fieldset';
import { InputNumberModule } from 'primeng/inputnumber';
import { BarcodeScannerComponent } from '@/shared/components/barcode-scanner/barcode-scanner.component';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';

import { ContextStore } from '@/shared/store/context-store.service';
import { ItemService } from '../item/item.service';
import { UserService } from '../user/user.service';
import { ReservationService } from './reservation.service';
import { Reservation, ReservationItem } from './reservation';
import { LoanService } from '../loan/loan.service';
import { CategoryService } from '../category/category.service';
import { CartService } from '@/shared/services/cart.service';
import { CategoryTreeNodePipe } from '@/shared/pipes/category-tree-node.pipe';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputContainerComponent,
    SearchSelectComponent,
    SubItemFormComponent,
    CrudComponent,
    DatePickerModule,
    FieldsetModule,
    InputNumberModule,
    ButtonModule,
    BarcodeScannerComponent,
    PaginatorModule,
    TreeSelectModule,
  ],
  providers: [
    ReservationService,
    UserService,
    ItemService,
    DatePipe,
    LoanService,
    CategoryService,
  ],
  selector: 'app-reservation',
  templateUrl: 'reservation.component.html',
  styles: [
    `
      :host ::ng-deep .hide-crud-toolbar p-toolbar {
        display: none !important;
      }
      :host ::ng-deep .hide-crud-list app-crud-table {
        display: none !important;
      }
    `,
  ],
})
export class ReservationComponent implements OnInit, OnDestroy {
  reservationService = inject(ReservationService);
  userService = inject(UserService);
  itemService = inject(ItemService);

  itemClientFilter = (item: any) => {
    return (item.quantity || 0) > 0;
  };

  getItemLabel = (item: any) => {
    return `${item.name} (Estoque: ${item.quantity || 0})`;
  };

  datePipe = inject(DatePipe);
  router = inject(Router);
  route = inject(ActivatedRoute);
  context = inject(ContextStore);
  formBuilder = inject(FormBuilder);
  cartService = inject(CartService);
  categoryService = inject(CategoryService);

  categoryTreeNodePipe = new CategoryTreeNodePipe();
  crud = viewChild(CrudComponent);

  categories = signal<any[]>([]);
  cardItemFilter = signal<string>('ALL');
  filterNodes = signal<TreeNode[]>([]);
  selectedFilterNode = signal<TreeNode | null>(null);

  onFilterChange() {
    const node = this.selectedFilterNode();
    this.cardItemFilter.set(node ? (node.data as string) : 'ALL');

    localStorage.setItem('cardItemFilter', this.cardItemFilter());
  }

  private refreshSubscription?: Subscription;

  config: CrudConfig<Reservation> = {
    title: 'Reservas',
    dialogWidth: '80vw',
  };

  form: FormGroup = this.formBuilder.group(
    {
      id: [{ value: null, disabled: true }],
      user: [null, Validators.required],
      status: ['PENDENTE'],
      reservationDate: [new Date(), Validators.required],
      withdrawalDate: [null, Validators.required],
      returnDate: [null],
      items: [[], [Validators.required, Validators.minLength(1)]],
    },
    { validators: this.dateComparisonValidator },
  );

  dateComparisonValidator(g: FormGroup) {
    const reservationDate = g.get('reservationDate');
    const withdrawalDate = g.get('withdrawalDate');
    const returnDate = g.get('returnDate');

    if (reservationDate?.errors?.['pastDate']) {
      const { pastDate, ...rest } = reservationDate.errors as Record<
        string,
        unknown
      >;
      reservationDate.setErrors(Object.keys(rest).length ? rest : null);
    }
    if (withdrawalDate?.errors?.['invalidWithdrawal']) {
      const { invalidWithdrawal, ...rest } = withdrawalDate.errors as Record<
        string,
        unknown
      >;
      withdrawalDate.setErrors(Object.keys(rest).length ? rest : null);
    }
    if (returnDate?.errors?.['invalidDates']) {
      const { invalidDates, ...rest } = returnDate.errors as Record<
        string,
        unknown
      >;
      returnDate.setErrors(Object.keys(rest).length ? rest : null);
    }

    let hasError = false;

    if (reservationDate?.value) {
      const resDate = new Date(reservationDate.value);
      resDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (resDate < today) {
        reservationDate.setErrors({
          ...reservationDate.errors,
          pastDate: true,
        });
        hasError = true;
      }
    }

    if (reservationDate?.value && withdrawalDate?.value) {
      const resDate = new Date(reservationDate.value);
      resDate.setHours(0, 0, 0, 0);
      const withDate = new Date(withdrawalDate.value);
      withDate.setHours(0, 0, 0, 0);
      if (withDate < resDate) {
        withdrawalDate.setErrors({
          ...withdrawalDate.errors,
          invalidWithdrawal: true,
        });
        hasError = true;
      }
    }

    if (withdrawalDate?.value && returnDate?.value) {
      const withDate = new Date(withdrawalDate.value);
      withDate.setHours(0, 0, 0, 0);
      const retDate = new Date(returnDate.value);
      retDate.setHours(0, 0, 0, 0);
      if (retDate < withDate) {
        returnDate.setErrors({ ...returnDate.errors, invalidDates: true });
        hasError = true;
      }
    }

    return hasError ? { invalidDates: true } : null;
  }

  reservationItensForm: FormGroup = this.formBuilder.group({
    id: [null],
    item: [null, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  cols: Column<Reservation>[] = [
    { field: 'id', header: 'Código' },
    {
      field: 'reservationDate',
      header: 'Data da Reserva',
      transform: (row) =>
        this.datePipe.transform(row.reservationDate, 'dd/MM/yyyy') || '',
    },
    {
      field: 'withdrawalDate',
      header: 'Data da Retirada',
      transform: (row) =>
        this.datePipe.transform(row.withdrawalDate, 'dd/MM/yyyy') || '',
    },
    { field: 'user.nome', header: 'Usuário' },
  ];

  reservationItemCols: Column<ReservationItem>[] = [
    { field: 'item.name', header: 'Item' },
    { field: 'quantity', header: 'Quantidade' },
  ];

  hasAdvancedPrivileges = toSignal(this.userService.hasAdvancedPrivileges(), {
    initialValue: false,
  });

  viewMode: 'cards' | 'list' = 'cards';
  searchReq: any = { filters: [], sort: { field: 'id', type: 'DESC' } };

  filterName = '';
  filterRA = '';
  filterStatus = '';

  // Modal Controlled States
  isModalOpen = false;
  selectedReservation: Reservation | null = null;

  clearFilters() {
    this.filterName = '';
    this.filterRA = '';
    this.filterStatus = '';
    this.applyFilters();
    this.crud()?.drawerVisible.set(false);
  }

  modalStatus: string = 'Pendente';
  modalDatePickup: string = '';
  modalDateReturn: string = '';
  modalDescription: string = '';
  modalObservations: string = '';
  currentUser: any = null;

  toggleViewMode() {
    this.viewMode = this.viewMode === 'cards' ? 'list' : 'cards';
  }

  onPageChange(event: any) {
    this.crud()?.onPage({ page: event.page, size: event.rows });
  }

  applyFilters() {
    const filters = [];
    if (this.filterName) {
      filters.push({
        field: 'user.nome',
        value: `%${this.filterName}%`,
        type: 'ILIKE',
      });
    }
    if (this.filterRA) {
      filters.push({
        field: 'user.documento',
        value: `%${this.filterRA}%`,
        type: 'ILIKE',
      });
    }
    if (this.filterStatus) {
      filters.push({
        field: 'status',
        value: this.filterStatus,
        type: 'EQUALS',
      });
    }
    this.searchReq = { filters, sort: { field: 'id', type: 'DESC' } };
  }

  ngOnInit(): void {
    this.categoryService
      .search({
        page: 0,
        rows: 1000,
        filters: [{ field: 'parent', type: 'IS_NULL' }],
      })
      .subscribe((page: any) => {
        this.categories.set(page.content);
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

        const savedFilter = localStorage.getItem('cardItemFilter');
        if (savedFilter) {
          const findNode = (nodes: TreeNode[]): TreeNode | null => {
            for (const n of nodes) {
              if (n.data === savedFilter) return n;
              if (n.children) {
                const found = findNode(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          const foundNode = findNode(this.filterNodes());
          if (foundNode) {
            this.selectedFilterNode.set(foundNode);
            this.cardItemFilter.set(foundNode.data as string);
          }
        }
      });

    // Monitora o reset do formulário pelo crud.component e restaura os defaults
    this.form.valueChanges.subscribe((val) => {
      let needsPatch = false;
      const patch: any = {};

      if (!this.hasAdvancedPrivileges() && !val.user && this.currentUser) {
        patch.user = this.currentUser;
        needsPatch = true;
      }
      if (!val.status) {
        patch.status = 'PENDENTE';
        needsPatch = true;
      }
      if (!val.reservationDate) {
        patch.reservationDate = new Date();
        needsPatch = true;
      }
      if (!val.items) {
        patch.items = [];
        needsPatch = true;
      }

      if (needsPatch) {
        this.form.patchValue(patch, { emitEvent: false });
      }
    });

    this.userService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        // Se for criação de nova reserva para Aluno, já preenche o usuário
        if (!this.hasAdvancedPrivileges()) {
          this.form.get('user')?.setValue(user);
        }

        // Listener para redirecionamento automático
        this.form.get('user')?.valueChanges.subscribe((selectedUser) => {
          if (
            selectedUser &&
            !this.selectedReservation &&
            this.crud()?.dialogVisible()
          ) {
            // Salvar os itens do form atual ANTES de fazer a busca e cancelar o dialog
            const currentItems = this.form.get('items')?.value
              ? [...this.form.get('items')?.value]
              : [];

            // Caso o usuário tenha preenchido um item mas esqueceu de clicar em adicionar
            if (
              this.reservationItensForm.valid &&
              this.reservationItensForm.get('item')?.value
            ) {
              currentItems.push(this.reservationItensForm.getRawValue());
              this.reservationItensForm.reset({ quantity: 1 });
            }

            this.reservationService
              .search({
                filters: [
                  { field: 'user.id', value: selectedUser.id, type: 'EQUALS' },
                  {
                    field: 'status',
                    value: ['PENDENTE', 'EM_SEPARACAO', 'PRONTO_RETIRADA'],
                    type: 'IN',
                  },
                ],
                sort: { field: 'id', type: 'DESC' },
              })
              .subscribe((res) => {
                if (res.content && res.content.length > 0) {
                  this.messageService.add({
                    severity: 'info',
                    summary: 'Aviso',
                    detail:
                      'Usuário já possui reserva ativa. Os itens foram mesclados na ficha existente.',
                  });

                  // Busca a reserva completa para garantir que os itens estão preenchidos
                  this.reservationService
                    .get(res.content[0].id)
                    .subscribe((existingRes) => {
                      const existingItems = existingRes.items
                        ? [...existingRes.items]
                        : [];

                      // Mesclar itens selecionados no form com os da reserva existente
                      currentItems.forEach((newItem: any) => {
                        if (newItem && newItem.item) {
                          const existingIndex = existingItems.findIndex(
                            (i) => i.item.id === newItem.item.id,
                          );
                          if (existingIndex > -1) {
                            existingItems[existingIndex] = {
                              ...existingItems[existingIndex],
                              quantity:
                                Number(existingItems[existingIndex].quantity) +
                                Number(newItem.quantity),
                            };
                          } else {
                            const itemToPush = { ...newItem };
                            delete itemToPush.id;
                            existingItems.push(itemToPush);
                          }
                        }
                      });
                      existingRes.items = existingItems;

                      this.crud()?.cancel();
                      setTimeout(() => {
                        this.openModal(existingRes);
                      }, 300);
                    });
                }
              });
          }
        });

        const cartData = this.context.consume('cart');
        if (cartData && Array.isArray(cartData)) {
          this.cartService.clearCart();

          this.reservationService
            .search({
              filters: [
                { field: 'user.id', value: user.id, type: 'EQUALS' },
                {
                  field: 'status',
                  value: ['PENDENTE', 'EM_SEPARACAO', 'PRONTO_RETIRADA'],
                  type: 'IN',
                },
              ],
              sort: { field: 'id', type: 'DESC' },
            })
            .subscribe((res) => {
              if (res.content && res.content.length > 0) {
                // Busca a reserva completa para garantir que os itens estão carregados
                this.reservationService
                  .get(res.content[0].id)
                  .subscribe((existingRes) => {
                    const existingItems = existingRes.items
                      ? [...existingRes.items]
                      : [];
                    cartData.forEach((newItem: any) => {
                      const existingIndex = existingItems.findIndex(
                        (i) => i.item.id === newItem.item.id,
                      );
                      if (existingIndex > -1) {
                        existingItems[existingIndex] = {
                          ...existingItems[existingIndex],
                          quantity:
                            Number(existingItems[existingIndex].quantity) +
                            Number(newItem.quantity),
                        };
                      } else {
                        const itemToPush = { ...newItem };
                        delete itemToPush.id;
                        existingItems.push(itemToPush);
                      }
                    });
                    existingRes.items = existingItems;
                    this.openModal(existingRes);
                    this.messageService.add({
                      severity: 'info',
                      summary: 'Aviso',
                      detail:
                        'Você já possui uma reserva ativa. Os itens do carrinho foram adicionados à sua ficha.',
                    });
                  });
              } else {
                const newRes = {
                  id: null,
                  user: user,
                  status: 'PENDENTE',
                  reservationDate: new Date().toISOString(),
                  items: cartData.map((c) => {
                    const copy = { ...c };
                    delete copy.id;
                    return copy;
                  }),
                };
                this.openModal(newRes as any);
              }
            });
        }
      },
      error: (err) => {
        console.error('Erro ao obter usuário atual', err);
      },
    });

    this.refreshSubscription = interval(5000).subscribe(() => {
      this.pollReservations();
    });

    this.route.queryParams.subscribe((params) => {
      if (params['id']) {
        const id = +params['id'];
        this.reservationService.get(id).subscribe({
          next: (res) => {
            if (res) {
              this.openModal(res);
            }
          },
          error: (err) => console.error('Erro ao buscar reserva da URL', err),
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  pollReservations() {
    const crudInst = this.crud();
    if (!crudInst || this.isModalOpen) return;

    const page = crudInst.lastPagination?.page ?? 0;
    const rows = crudInst.lastPagination?.rows ?? 10;
    const request = { ...this.searchReq, page, rows };

    this.reservationService.search(request).subscribe({
      next: (result) => {
        crudInst.items.set(result);
      },
      error: (err) => {
        console.error('Erro ao recarregar reservas silenciosamente', err);
      },
    });
  }

  onEntityLoad(reservation: Reservation) {
    this.form.patchValue({
      user: reservation.user
        ? reservation.user
        : !this.hasAdvancedPrivileges()
          ? this.currentUser
          : null,
      reservationDate: reservation.reservationDate
        ? new Date(reservation.reservationDate)
        : null,
      withdrawalDate: reservation.withdrawalDate
        ? new Date(reservation.withdrawalDate)
        : null,
      returnDate: reservation.returnDate
        ? new Date(reservation.returnDate)
        : null,
    });
  }

  onUserScanned(user: any) {
    if (this.hasAdvancedPrivileges()) {
      this.form.get('user')?.setValue(user);
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
      currentItems.push({ item: item, quantity: 1 });
    }
    this.form.get('items')?.setValue([...currentItems]);
  }

  loadReservations(): void {
    this.crud()?.loadItems();
  }

  openModal(reservation: Reservation): void {
    this.selectedReservation = reservation;
    this.modalStatus = reservation.status || 'Pendente';

    this.modalDatePickup = this.formatDateForInput(reservation.withdrawalDate);
    this.modalDateReturn = this.formatDateForInput(reservation.returnDate);

    this.modalDescription = reservation.description || '';
    this.modalObservations = reservation.observation || '';

    // Injetando os itens no formGroup para que o app-subitem-form possa gerenciá-los
    this.form.patchValue({
      items: reservation.items ? [...reservation.items] : [],
    });

    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedReservation = null;
    this.form.reset();
  }

  handleConfirm(): void {
    if (
      !this.selectedReservation ||
      !this.isDateValid() ||
      this.form.get('items')?.invalid
    )
      return;

    const formItems = this.form.get('items')?.value || [];

    const updatedReservation: any = {
      ...this.selectedReservation,
      status: this.modalStatus,
      description: this.modalDescription,
      observation: this.modalObservations,
      withdrawalDate: this.modalDatePickup
        ? new Date(this.modalDatePickup.replace(/-/g, '\/')).toISOString()
        : undefined,
      returnDate: this.modalDateReturn
        ? new Date(this.modalDateReturn.replace(/-/g, '\/')).toISOString()
        : undefined,
      items: formItems,
    };

    if (updatedReservation.id) {
      this.reservationService
        .update(updatedReservation.id, updatedReservation)
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Sucesso',
              detail: 'Reserva atualizada com sucesso.',
            });
            this.crud()?.loadItems();
            this.closeModal();
          },
          error: (err) => {
            console.error('Erro ao atualizar reserva', err);
            const errorMsg =
              err.error?.message ||
              err.error?.detail ||
              err.error?.errors?.[0]?.defaultMessage ||
              'Erro ao atualizar reserva. Verifique os campos.';
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: errorMsg,
            });
            this.crud()?.loadItems();
          },
        });
    } else {
      this.reservationService.create(updatedReservation).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso',
            detail: 'Reserva solicitada com sucesso.',
          });
          this.crud()?.loadItems();
          this.closeModal();
        },
        error: (err) => {
          console.error('Erro ao criar reserva', err);
          const errorMsg =
            err.error?.message ||
            err.error?.detail ||
            err.error?.errors?.[0]?.defaultMessage ||
            'Erro ao criar reserva. Verifique os campos.';
          this.messageService.add({
            severity: 'error',
            summary: 'Erro',
            detail: errorMsg,
          });
          this.crud()?.loadItems();
        },
      });
    }
  }

  isDateValid(): boolean {
    if (!this.modalDatePickup) return false;
    if (!this.modalDateReturn) return true;
    const pickupD = new Date(this.modalDatePickup.replace(/-/g, '\/'));
    const returnD = new Date(this.modalDateReturn.replace(/-/g, '\/'));
    return returnD >= pickupD;
  }

  loanService = inject(LoanService);
  messageService = inject(MessageService);

  createLoanFromReservation(reservation: Reservation) {
    const loanItems = reservation.items.map((item: any) => ({
      item: item.item,
      quantity: item.quantity,
      shouldReturn: true,
    }));

    const loanData: any = {
      borrower: reservation.user,
      raSiape: reservation.user.documento,
      items: loanItems,
      loanDate: this.modalDatePickup
        ? new Date(this.modalDatePickup.replace(/-/g, '\/')).toISOString()
        : new Date().toISOString(),
      deadline: this.modalDateReturn
        ? new Date(this.modalDateReturn.replace(/-/g, '\/')).toISOString()
        : undefined,
      observation: this.modalObservations,
      status: 'ONGOING',
    };

    this.loanService.create(loanData).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Empréstimo Gerado',
          detail:
            'O empréstimo foi gerado e já está disponível nas outras telas!',
        });

        if (reservation.id) {
          this.reservationService.delete(reservation.id).subscribe({
            next: () => {
              this.loadReservations();
            },
            error: (err) => console.error('Erro ao excluir reserva', err),
          });
        }

        this.closeModal();
      },
      error: (err) => {
        console.error(err);
        const errorMsg =
          err.error?.message ||
          err.error?.detail ||
          'Não foi possível gerar o empréstimo';
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: errorMsg,
        });
      },
    });
  }

  getBadgeClasses(status?: string): string {
    const s = status || 'Pendente';
    switch (s) {
      case 'Pendente':
      case 'PENDENTE':
        return 'border border-yellow-300 text-yellow-600 bg-yellow-50 text-xs font-bold px-2 py-1 rounded-md';
      case 'Em separação':
      case 'EM_SEPARACAO':
        return 'border border-purple-300 text-purple-600 bg-purple-50 text-xs font-bold px-2 py-1 rounded-md';
      case 'Pronto para Retirada':
      case 'PRONTO_RETIRADA':
        return 'border border-green-300 text-green-600 bg-green-50 text-xs font-bold px-2 py-1 rounded-md';
      default:
        return 'border border-gray-300 text-gray-600 bg-gray-50 text-xs font-bold px-2 py-1 rounded-md';
    }
  }

  getDisplayStatus(status?: string): string {
    const s = status || 'Pendente';
    if (s === 'PENDENTE') return 'Pendente';
    if (s === 'EM_SEPARACAO') return 'Em separação';
    if (s === 'PRONTO_RETIRADA') return 'Pronto para Retirada';
    return s;
  }

  formatDateToBR(date: any): string {
    if (!date) return '';
    return this.datePipe.transform(date, 'dd/MM/yyyy') || '';
  }

  formatDateForInput(date: any): string {
    if (!date) return '';
    return this.datePipe.transform(date, 'yyyy-MM-dd') || '';
  }

  getFilteredItems(items: any[]) {
    if (!items) return [];
    const filter = this.cardItemFilter();
    if (filter === 'ALL') return items;
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
}
