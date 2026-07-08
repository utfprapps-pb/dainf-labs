import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { User } from '@/pages/user/user';
import { UserService } from '@/pages/user/user.service';
import { PendingItem } from '@/pages/loan/loan';
import { LoanService } from '@/pages/loan/loan.service';

@Component({
  selector: 'app-pending-items-dialog',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputContainerComponent,
    SearchSelectComponent,
  ],
  templateUrl: './pending-items-dialog.html',
})
export class PendingItemsDialog {
  ref = inject(DynamicDialogRef);
  loanService = inject(LoanService);
  userService = inject(UserService);

  selectedBorrower: User | undefined;
  pendingItems: PendingItem[] = [];
  searched = false;
  loading = false;

  onBorrowerChange(borrower: User | undefined) {
    this.selectedBorrower = borrower;
    this.pendingItems = [];
    this.searched = false;

    if (!borrower) return;

    this.loading = true;
    this.loanService.getPendingItemsForBorrower(borrower.id).subscribe((items) => {
      this.pendingItems = items;
      this.searched = true;
      this.loading = false;
    });
  }

  closeDialog() {
    this.ref.close();
  }
}
