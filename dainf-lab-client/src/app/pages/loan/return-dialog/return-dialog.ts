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

  form!: FormGroup;
  loan!: Loan;
  savedReturn: Return | null = null;
  items: any[] = [];

  ngOnInit(): void {
    this.loan = this.config.data?.loan;
    this.items = this.loan.items.map(item => ({
      ...item,
      tempReturnQty: 0
    }));
    
    this._searchReturnByLoan(this.loan).subscribe((res) => {
      this.savedReturn = res;
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
      this.items.forEach(item => {
        let groupName = item.item?.category?.description || 'Outros';
        if (groupName.toLowerCase().includes('ferramenta')) groupName = 'Ferramentas emprestadas';
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
    this.items.forEach(item => {
      item.tempReturnQty = item.quantity - (item.returnedQuantity || 0);
    });
  }

  save() {
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
      returnDate: formValue.returnDate ? new Date(formValue.returnDate.replace(/-/g, '\/')).toISOString() : new Date().toISOString(),
      observation: formValue.observation,
      items: this._createItemsPayload(),
    } as Return;
  }

  private _createItemsPayload(): ReturnItem[] {
    return this.items.map((item: any) => {
      return {
        item: item.item,
        quantityIssued: item.quantityIssued || 0,
        quantityReturned: (item.returnedQuantity || 0) + (item.tempReturnQty || 0),
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
