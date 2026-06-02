import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { SubItemFormComponent } from '@/shared/components/subitem-form/subitem-form.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { DatePickerModule } from 'primeng/datepicker';
import { FieldsetModule } from 'primeng/fieldset';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';

import { ContextStore } from '@/shared/store/context-store.service';
import { ItemService } from '../item/item.service';
import { UserService } from '../user/user.service';
import { Reservation, ReservationItem } from './reservation';
import { ReservationService } from './reservation.service';
import { LoanService } from '../loan/loan.service';
import { CartService } from '@/shared/services/cart.service';
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
    ButtonModule
  ],
  providers: [ReservationService, UserService, ItemService, DatePipe, LoanService],
  selector: 'app-reservation',
  templateUrl: 'reservation.component.html',
  styles: [`
    :host ::ng-deep .hide-crud-toolbar p-toolbar { display: none !important; }
    :host ::ng-deep .hide-crud-list app-crud-table { display: none !important; }
  `]
})
export class ReservationComponent implements OnInit {
  reservationService = inject(ReservationService);
  userService = inject(UserService);
  itemService = inject(ItemService);
  datePipe = inject(DatePipe);
  router = inject(Router);
  context = inject(ContextStore);
  formBuilder = inject(FormBuilder);
  cartService = inject(CartService);
  crud = viewChild(CrudComponent);

  config: CrudConfig<Reservation> = {
    title: 'Reservas',
    dialogWidth: '80vw',
  };

  form: FormGroup = this.formBuilder.group({
    id: [{ value: null, disabled: true }],
    user: [null, Validators.required],
    status: ['PENDENTE'],
    reservationDate: [new Date(), Validators.required],
    withdrawalDate: [null, Validators.required],
    returnDate: [null],
    items: [[]],
  });

  reservationItensForm: FormGroup = this.formBuilder.group({
    id: [null],
    item: [null, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  cols: Column<Reservation>[] = [
    { field: 'id', header: 'Código' },
    { field: 'reservationDate', header: 'Data da Reserva', transform: (row) => this.datePipe.transform(row.reservationDate, 'dd/MM/yyyy') || '' },
    { field: 'withdrawalDate', header: 'Data da Retirada', transform: (row) => this.datePipe.transform(row.withdrawalDate, 'dd/MM/yyyy') || '' },
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
  searchReq: any = { filters: [] };

  filterName = '';
  filterRA = '';
  filterStatus = '';

  // Modal Controlled States
  isModalOpen = false;
  selectedReservation: Reservation | null = null;
  modalStatus: string = 'Pendente';
  modalDatePickup: string = '';
  modalDateReturn: string = '';
  modalDescription: string = '';
  modalObservations: string = '';
  currentUser: any = null;

  toggleViewMode() {
    this.viewMode = this.viewMode === 'cards' ? 'list' : 'cards';
  }

  applyFilters() {
    const filters = [];
    if (this.filterName) {
      filters.push({ field: 'user.nome', value: `%${this.filterName}%`, type: 'ILIKE' });
    }
    if (this.filterRA) {
      filters.push({ field: 'user.documento', value: `%${this.filterRA}%`, type: 'ILIKE' });
    }
    if (this.filterStatus) {
      filters.push({ field: 'status', value: this.filterStatus, type: 'EQUALS' });
    }
    this.searchReq = { filters };
  }

  ngOnInit(): void {
    // Monitora o reset do formulário pelo crud.component e restaura os defaults
    this.form.valueChanges.subscribe(val => {
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
        
        const cartData = this.context.consume('cart');
        if (cartData && Array.isArray(cartData)) {
          const newRes = {
            user: user,
            status: 'PENDENTE',
            reservationDate: new Date(),
            items: cartData
          };
          this.reservationService.create(newRes as any).subscribe({
            next: () => {
              this.cartService.clearCart();
              this.crud()?.loadItems();
            },
            error: (err) => {
              console.error('Erro ao gerar reserva do carrinho', err);
              this.crud()?.loadItems();
            }
          });
        }
      },
      error: (err) => {
        console.error('Erro ao obter usuário atual', err);
      }
    });
  }

  onEntityLoad(reservation: Reservation) {
    this.form.patchValue({
      user: reservation.user ? reservation.user : (!this.hasAdvancedPrivileges() ? this.currentUser : null),
      reservationDate: reservation.reservationDate ? new Date(reservation.reservationDate) : null,
      withdrawalDate: reservation.withdrawalDate ? new Date(reservation.withdrawalDate) : null,
      returnDate: reservation.returnDate ? new Date(reservation.returnDate) : null,
    });
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
    this.form.patchValue({ items: reservation.items ? [...reservation.items] : [] });
    
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedReservation = null;
  }

  handleConfirm(): void {
    if (!this.selectedReservation || !this.isDateValid()) return;

    const formItems = this.form.get('items')?.value || [];

    const updatedReservation: Reservation = {
      ...this.selectedReservation,
      status: this.modalStatus,
      description: this.modalDescription,
      observation: this.modalObservations,
      withdrawalDate: this.modalDatePickup ? new Date(this.modalDatePickup.replace(/-/g, '\/')) : undefined,
      returnDate: this.modalDateReturn ? new Date(this.modalDateReturn.replace(/-/g, '\/')) : undefined,
      items: formItems
    };

    this.reservationService.update(updatedReservation.id, updatedReservation).subscribe({
      next: () => {
        this.crud()?.loadItems();
        this.closeModal();
      },
      error: (err) => {
        console.error('Erro ao atualizar reserva', err);
        this.crud()?.loadItems();
        this.closeModal();
      }
    });
  }

  isDateValid(): boolean {
    if (!this.modalDatePickup || !this.modalDateReturn) return true;
    const pickupD = new Date(this.modalDatePickup.replace(/-/g, '\/'));
    const returnD = new Date(this.modalDateReturn.replace(/-/g, '\/'));
    return returnD >= pickupD;
  }

  loanService = inject(LoanService);
  messageService = inject(MessageService);

  createLoanFromReservation(reservation: Reservation) {
    const loanItems = reservation.items.map((item) => ({
      item: item.item,
      quantity: item.quantity,
      shouldReturn: true,
    }));

    const loanData: any = {
      borrower: reservation.user,
      raSiape: reservation.user.documento,
      items: loanItems,
      loanDate: this.modalDatePickup ? new Date(this.modalDatePickup.replace(/-/g, '\/')).toISOString() : new Date().toISOString(),
      deadline: this.modalDateReturn ? new Date(this.modalDateReturn.replace(/-/g, '\/')).toISOString() : undefined,
      observation: this.modalObservations,
      status: 'ONGOING'
    };

    this.loanService.create(loanData).subscribe({
      next: () => {
        this.messageService.add({severity:'success', summary:'Empréstimo Gerado', detail:'O empréstimo foi gerado e já está disponível nas outras telas!'});
        
        if (reservation.id) {
          this.reservationService.delete(reservation.id).subscribe({
            next: () => {
              this.loadReservations();
            },
            error: (err) => console.error('Erro ao excluir reserva', err)
          });
        }
        
        this.closeModal();
      },
      error: (err) => {
        console.error(err);
        const errorMsg = err.error?.message || err.error?.detail || 'Não foi possível gerar o empréstimo';
        this.messageService.add({severity:'error', summary:'Erro', detail: errorMsg});
      }
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
}
