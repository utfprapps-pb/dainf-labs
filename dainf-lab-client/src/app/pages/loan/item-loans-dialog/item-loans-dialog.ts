import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { LoanItemTracking } from '@/pages/loan/loan';

@Component({
  selector: 'app-item-loans-dialog',
  imports: [CommonModule, TableModule, ButtonModule],
  templateUrl: './item-loans-dialog.html',
})
export class ItemLoansDialog {
  config = inject(DynamicDialogConfig);
  ref = inject(DynamicDialogRef);

  loans: LoanItemTracking[] = [];
  itemName: string = '';

  ngOnInit() {
    this.loans = this.config.data.loans;
    this.itemName = this.config.data.itemName;
  }

  edit(loan: LoanItemTracking) {
    this.ref.close({ action: 'edit', loanId: loan.loanId });
  }

  returnLoan(loan: LoanItemTracking) {
    this.ref.close({ action: 'return', loanId: loan.loanId });
  }

  closeDialog() {
    this.ref.close();
  }
}
