import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { User } from '@/pages/user/user';
import { UserService } from '@/pages/user/user.service';
import { LoanItemTracking, PendingItem } from '@/pages/loan/loan';
import { LoanService } from '@/pages/loan/loan.service';
import { ItemLoansDialog } from '@/pages/loan/item-loans-dialog/item-loans-dialog';

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
  dialogService = inject(DialogService);
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

  showItemLoans(item: PendingItem) {
    const borrowerId = this.selectedBorrower?.id;
    if (!borrowerId) return;

    this.loanService.getActiveLoansForItem(item.itemId).subscribe((loans: LoanItemTracking[]) => {
      const filtered = loans.filter((loan) => loan.borrowerId === borrowerId);
      const dialogRef = this.dialogService.open(ItemLoansDialog, {
        header: `Empréstimos: ${item.itemName}`,
        width: '60%',
        contentStyle: { 'max-height': '500px', overflow: 'auto' },
        modal: true,
        baseZIndex: 10000,
        data: { loans: filtered, itemName: item.itemName },
      });

      dialogRef.onClose.subscribe((result: any) => {
        if (result?.action) {
          this.ref.close(result);
        }
      });
    });
  }

  closeDialog() {
    this.ref.close();
  }
}
