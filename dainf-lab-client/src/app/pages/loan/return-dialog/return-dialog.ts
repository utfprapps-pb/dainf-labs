import { Return, ReturnItem } from '@/pages/return/return';
import { ReturnService } from '@/pages/return/return.service';
import { UserService } from '@/pages/user/user.service';
import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { extractErrorMessage } from '@/shared/utils/error.utils';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { catchError, Observable, take, tap, throwError } from 'rxjs';
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
    InputContainerComponent,
    SearchSelectComponent,
    TableModule,
    InputNumber,
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
  loadError = false;

  ngOnInit(): void {
    this.loan = this.config.data?.loan;
    this._searchReturnByLoan(this.loan)
      .pipe(
        tap((res) => {
          this.savedReturn = res;
          if (this.savedReturn) {
            this.savedReturn.items?.forEach((item: any) => {
              item.quantity = this.loan.items.find(
                (loanItem: any) => loanItem.item.id === item.item.id,
              )?.quantity;
            });
          }
        }),
        catchError((error) => {
          this.loadError = true;
          this._showWarn(`Falha ao carregar o registro: ${extractErrorMessage(error)}`);
          return throwError(() => error);
        }),
        take(1),
      )
      .subscribe();
    this._initForm();
  }

  save() {
    if (this.loadError) {
      this._showWarn(
        'Não foi possível verificar se já existe uma devolução para este empréstimo. Feche e reabra o formulário para tentar novamente.',
      );
      return;
    }
    if (this.form.invalid) {
      this._showWarn('Por favor, verifique os campos do formulário.');
      this.form.markAllAsTouched();
      return;
    }
    const payload = this._createPayload();
    this._save(payload as Return)
      .pipe(
        tap((res) => {
          this._showSuccess('Registro salvo com sucesso.');
          this.ref.close({ success: true, data: res });
        }),
        catchError((error) => {
          this._showWarn(extractErrorMessage(error));
          return throwError(() => error);
        }),
        take(1),
      )
      .subscribe();
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
      returnDate: [new Date(), Validators.required],
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
      returnDate: formValue.returnDate,
      observation: formValue.observation,
      items: this._createItemsPayload(),
    } as Return;
  }

  private _createItemsPayload(): ReturnItem[] {
    if (this.savedReturn?.items) {
      return this._createItemsFromReturn(this.savedReturn);
    }
    return this._createItemsFromLoan(this.loan);
  }

  private _createItemsFromReturn(obj: Return): ReturnItem[] {
    return obj.items!.map((item) => {
      return {
        id: item.id,
        item: item.item,
        quantityIssued: item.quantityIssued || 0,
        quantityReturned: item.quantityReturned || 0,
      } as ReturnItem;
    });
  }

  private _createItemsFromLoan(loan: Loan): ReturnItem[] {
    return loan.items.map((loanItem: any) => {
      return {
        item: loanItem.item,
        quantityIssued: loanItem.quantityIssued || 0,
        quantityReturned: loanItem.quantityReturned || 0,
      } as ReturnItem;
    });
  }

  private _save(item: Return): Observable<any> {
    const isUpdate = !!item.id;
    return isUpdate
      ? this.returnService.update(item.id, item)
      : this.returnService.create(item);
  }

  private _showSuccess(detail: string) {
    this.messageService.add({ severity: 'success', summary: 'Sucesso!', detail });
  }

  private _showWarn(detail: string) {
    this.messageService.add({ severity: 'warn', summary: 'Atenção!', detail });
  }
}
