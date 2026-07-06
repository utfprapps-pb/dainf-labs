import { Return, ReturnItem } from '@/pages/return/return';
import { ReturnService } from '@/pages/return/return.service';
import { UserService } from '@/pages/user/user.service';
import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { Observable } from 'rxjs';
import { Loan } from '../loan';
import { LoanService } from '../loan.service';

@Component({
  standalone: true,
  selector: 'app-loan-return-dialog',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    TableModule,
    ChipModule,
  ],
  templateUrl: './return-dialog.html',
  providers: [ReturnService],
})
export class LoanReturnDialog implements OnInit {
  config = inject(DynamicDialogConfig);
  ref = inject(DynamicDialogRef);
  fb = inject(FormBuilder);

  loanService = inject(LoanService);
  userService = inject(UserService);
  returnService = inject(ReturnService);
  messageService = inject(MessageService);

  form!: FormGroup;
  loan!: Loan;
  savedReturn: Return | null = null;
  items: any[] = [];

  ngOnInit(): void {
    this.loan = this.config.data?.loan;
    this.items = this.loan.items.map((item) => ({
      ...item,
      tempReturnQty: 0,
    }));

    this._searchReturnByLoan(this.loan).subscribe((res) => {
      this.savedReturn = res;
      if (this.savedReturn && this.loan.status === 'COMPLETED') {
        const returnDate = this.savedReturn.returnDate;
        this.form.patchValue({
          returnDate: returnDate
            ? new Date(returnDate).toISOString().split('T')[0]
            : '',
          observation: this.savedReturn.observation || '',
        });
        this.form.get('returnDate')?.disable();
        this.form.get('observation')?.disable();
      }
      this.items.forEach((item: any) => {
        if (this.loan.status === 'COMPLETED') {
          item.returnedQuantity = item.quantity;
        } else if (this.savedReturn) {
          const savedItem = this.savedReturn?.items?.find(
            (ri: any) => ri.item.id === item.item.id,
          );
          if (savedItem) {
            item.returnedQuantity = savedItem.quantityReturned; // Fix field name
            item.quantityIssued = savedItem.quantityIssued;
          }
        }
      });
    });
    this._initForm();
  }

  getGroupedItems() {
    const groups: { [key: string]: any[] } = {};
    if (this.items && this.items.length > 0) {
      this.items.forEach((item) => {
        let groupName = item.item?.category?.description || 'Outros';
        if (groupName.toLowerCase().includes('ferramenta'))
          groupName = 'Ferramentas emprestadas';
        else groupName = 'Componentes emprestados';

        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(item);
      });
    }
    return Object.entries(groups).map(([name, items]) => ({ name, items }));
  }

  incrementQty(item: any) {
    const max = item.quantity - (item.returnedQuantity || 0);
    if ((item.tempReturnQty || 0) < max) {
      item.tempReturnQty = (item.tempReturnQty || 0) + 1;
    }
  }

  decrementQty(item: any) {
    if ((item.tempReturnQty || 0) > 0) {
      item.tempReturnQty = (item.tempReturnQty || 0) - 1;
    }
  }

  markAllReturned() {
    this.items.forEach((item) => {
      item.tempReturnQty = item.quantity - (item.returnedQuantity || 0);
    });
  }

  isReturnDateInvalid(): boolean {
    const returnDateStr = this.form.get('returnDate')?.value;
    if (!returnDateStr) return false; // Let the form validators handle required if any

    const returnDate = new Date(returnDateStr.replace(/-/g, '\/'));
    const loanDate = new Date(this.loan.loanDate);

    // Reset time components for accurate date-only comparison
    returnDate.setHours(0, 0, 0, 0);
    loanDate.setHours(0, 0, 0, 0);

    return returnDate < loanDate;
  }

  isValidReturn(): boolean {
    if (this.loan.status === 'COMPLETED') return false;

    // Check if at least one item has tempReturnQty > 0
    const hasItemsToReturn = this.items.some(
      (item) => (item.tempReturnQty || 0) > 0,
    );
    if (!hasItemsToReturn) return false;

    // Check if returnDate is >= loanDate
    const returnDateStr = this.form.get('returnDate')?.value;
    if (!returnDateStr) return false;

    const returnDate = new Date(returnDateStr.replace(/-/g, '\/'));
    const loanDate = new Date(this.loan.loanDate);

    // Reset time components for accurate date-only comparison
    returnDate.setHours(0, 0, 0, 0);
    loanDate.setHours(0, 0, 0, 0);

    return returnDate >= loanDate;
  }

  save() {
    if (!this.isValidReturn()) {
      const hasItemsToReturn = this.items.some(
        (item) => (item.tempReturnQty || 0) > 0,
      );
      const isDateInvalid = this.isReturnDateInvalid();

      if (!hasItemsToReturn && isDateInvalid) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Atenção',
          detail: 'Não é possível confirmar a devolução. Selecione ao menos um item e informe uma data válida.',
        });
        return;
      }

      if (isDateInvalid) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Atenção',
          detail:
            'Não é possível confirmar a devolução. A data não pode ser anterior ao empréstimo.',
        });
        return;
      }

      if (!hasItemsToReturn) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Atenção',
          detail: 'Não é possível confirmar a devolução. Selecione ao menos um item.',
        });
        return;
      }
      return;
    }

    const payload = this._createPayload();
    this._save(payload as Return).subscribe((res) => {
      this.ref.close({ success: true, data: res });
    });
  }

  cancel() {
    this.ref.close({ success: false });
  }

  private _initForm() {
    this.form = this.fb.group({
      loanId: [{ value: this.loan.id, disabled: true }, Validators.required],
      borrower: [
        { value: this.loan.borrower, disabled: true },
        Validators.required,
      ],
      loanDate: [
        { value: new Date(this.loan.loanDate), disabled: true },
        Validators.required,
      ],
      deadline: [
        { value: new Date(this.loan.deadline), disabled: true },
        Validators.required,
      ],
      returnDate: [new Date().toISOString().split('T')[0], Validators.required],
      observation: [null],
    });
  }

  private _searchReturnByLoan(loan: Loan): Observable<Return | null> {
    return this.returnService.findByLoan(loan);
  }

  private _createPayload(): Return {
    const formValue = this.form.getRawValue();
    return {
      id: this.savedReturn?.id,
      loan: this.loan,
      returnDate: formValue.returnDate
        ? new Date(formValue.returnDate.replace(/-/g, '\/')).toISOString()
        : new Date().toISOString(),
      observation: formValue.observation,
      items: this._createItemsPayload(),
    } as Return;
  }

  private _createItemsPayload(): ReturnItem[] {
    return this.items.map((item: any) => {
      return {
        item: item.item,
        quantityIssued: item.quantityIssued || 0,
        quantityReturned:
          (item.returnedQuantity || 0) + (item.tempReturnQty || 0),
      } as ReturnItem;
    });
  }

  private _save(item: Return): Observable<any> {
    const isUpdate = !!item.id;
    return isUpdate
      ? this.returnService.update(item.id, item)
      : this.returnService.create(item);
  }
}
