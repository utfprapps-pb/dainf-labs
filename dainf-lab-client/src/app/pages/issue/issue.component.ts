import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoanService } from '../loan/loan.service';
import { Loan, LoanItem } from '../loan/loan';
import { ReturnService } from '../return/return.service';
import { DialogService } from 'primeng/dynamicdialog';
import { Return, ReturnItem } from '../return/return';
import { SearchRequest } from '@/shared/models/search';
import { LoanReturnDialog } from '../loan/return-dialog/return-dialog';
import { UserService } from '../user/user.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';

interface LoanItemWithTemp extends LoanItem {
  tempReturnQty?: number;
  returnedQuantity?: number;
}

interface LoanWithTemp extends Loan {
  items: LoanItemWithTemp[];
}

import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { BarcodeScannerComponent } from '@/shared/components/barcode-scanner/barcode-scanner.component';

import { ItemService } from '../item/item.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, BarcodeScannerComponent],
  providers: [LoanService, ReturnService, DialogService, UserService, MessageService, ItemService],
  selector: 'app-issue',
  templateUrl: './issue.component.html',
})
export class IssueComponent {
  loanService = inject(LoanService);
  returnService = inject(ReturnService);
  dialogService = inject(DialogService);
  userService = inject(UserService);
  messageService = inject(MessageService);

  loans = signal<LoanWithTemp[]>([]);
  loading = signal(false);
  viewMode: 'cards' | 'list' = 'cards';

  toggleViewMode() {
    this.viewMode = this.viewMode === 'cards' ? 'list' : 'cards';
  }

  // Filtros
  filterName = '';
  filterDocument = '';
  filterStatus = '';
  filterType = '';
  filterLoanDate = '';
  filterDeadlineDate = '';

  hasAdvancedPrivileges = toSignal(this.userService.hasAdvancedPrivileges(), {
    initialValue: false,
  });

  constructor() {
    this.loadLoans();
  }

  loadLoans() {
    this.loading.set(true);
    const request: SearchRequest = {
      filters: [],
      sort: { field: 'deadline', type: 'ASC' },
      page: 0,
      rows: 100
    };

    this.loanService.search(request).subscribe({
      next: (page) => {
        const loans = page.content;
        if (loans.length === 0) {
          this.loans.set([]);
          this.loading.set(false);
          return;
        }

        const observables = loans.map((loan: Loan) => 
          this.returnService.findByLoan(loan).pipe(catchError(() => of(null)))
        );

        forkJoin(observables).subscribe((returns: any[]) => {
          const loansWithTemp = loans.map((loan: Loan, idx: number) => {
            const existingReturn = returns[idx];
            return {
              ...loan,
              items: loan.items.map((item: any) => {
                const retItem = existingReturn?.items?.find((r: any) => r.item?.id === item.item?.id);
                return {
                  ...item,
                  returnedQuantity: retItem ? retItem.quantityReturned : 0,
                  tempReturnQty: 0
                };
              })
            };
          });
          this.loans.set(loansWithTemp);
          this.loading.set(false);
        });
      },
      error: () => this.loading.set(false)
    });
  }

  get filteredLoansList() {
    let list = this.loans() || [];
    const name = this.filterName?.toLowerCase() || '';
    const doc = this.filterDocument?.toLowerCase() || '';
    const status = this.filterStatus;
    const type = this.filterType;
    const loanDate = this.filterLoanDate;
    const deadlineDate = this.filterDeadlineDate;

    if (name) {
      list = list.filter(l => l.borrower?.nome?.toLowerCase().includes(name));
    }
    if (doc) {
      list = list.filter(l => l.borrower?.documento?.toLowerCase().includes(doc));
    }
    if (status) {
      let mappedStatus = '';
      if (status === 'Atrasado') mappedStatus = 'OVERDUE';
      else if (status === 'Em dia') mappedStatus = 'ONGOING';
      else if (status === 'Finalizado') mappedStatus = 'COMPLETED';
      
      list = list.filter(l => l.status === mappedStatus);
    } else {
      list = list.filter(l => l.status !== 'COMPLETED');
    }
    if (type) {
      list = list.filter(l => l.items && l.items.some((i: any) => i.item?.category?.description === type));
    }
    if (loanDate) {
      list = list.filter(l => {
        const d = new Date(l.loanDate).toISOString().split('T')[0];
        return d === loanDate;
      });
    }
    if (deadlineDate) {
      list = list.filter(l => {
        const d = new Date(l.deadline).toISOString().split('T')[0];
        return d === deadlineDate;
      });
    }
    return list;
  }

  hasItemsToReturn(loan: any): boolean {
    return loan.items.some((item: any) => (item.tempReturnQty || 0) > 0);
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

  toggleAllItems(loan: any) {
    const allSelected = loan.items.every((item: any) => {
      const pendente = item.quantity - (item.returnedQuantity || 0);
      return item.tempReturnQty === pendente;
    });

    loan.items.forEach((item: any) => {
      if (allSelected) {
        item.tempReturnQty = 0;
      } else {
        item.tempReturnQty = item.quantity - (item.returnedQuantity || 0);
      }
    });
  }

  confirmReturn(loan: any) {
    const itemsToReturn = loan.items.filter((item: any) => item.tempReturnQty > 0);
    if (itemsToReturn.length === 0) return;

    // Buscar se jÃ¡ existe um return para esse loan
    this.returnService.findByLoan(loan).pipe(
      catchError(() => of(null))
    ).subscribe({
      next: (existingReturn) => {
        const payload: Return = {
          id: existingReturn?.id,
          loan: loan,
          returnDate: new Date().toISOString(),
          items: loan.items.map((item: any) => {
            const oldReturnItem = existingReturn?.items?.find((r: any) => r.item?.id === item.item?.id);
            return {
              item: item.item,
              quantityIssued: oldReturnItem?.quantityIssued || 0,
              quantityReturned: (item.returnedQuantity || 0) + (item.tempReturnQty || 0)
            };
          })
        } as Return;

        const obs = existingReturn?.id 
          ? this.returnService.update(existingReturn.id, payload)
          : this.returnService.create(payload);

        obs.subscribe({
          next: () => {
            this.loadLoans();
          }
        });
      }
    });
  }

  openReturnDialog(loan: any) {
    const ref = this.dialogService.open(LoanReturnDialog, {
      header: `Ficha de Empréstimo`,
      width: '90vw',
      modal: true,
      data: { loan },
      styleClass: 'return-ficha-modal'
    });

    ref.onClose.subscribe((result: any) => {
      if (result?.success) {
        this.loadLoans();
      }
    });
  }

  getGroupedItems(loan: any) {
    const groups: { [key: string]: any[] } = {};
    if (loan && loan.items) {
      loan.items.forEach((item: any) => {
        let groupName = item.item?.category?.description || 'Outros';
        if (groupName.toLowerCase().includes('ferramenta')) groupName = 'Ferramentas emprestadas';
        else groupName = 'Componentes emprestados';
        
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(item);
      });
    }
    return Object.entries(groups).map(([name, items]) => ({ name, items }));
  }

  confirmQuickReturn(loan: Loan) {
    this.openReturnDialog(loan);
  }

  clearFilters() {
    this.filterName = '';
    this.filterDocument = '';
    this.filterStatus = '';
    this.filterType = '';
    this.filterLoanDate = '';
    this.filterDeadlineDate = '';
  }

  onUserScanned(user: any) {
    this.filterDocument = user.documento;
    const filtered = this.filteredLoansList;
    if (filtered.length === 1) {
       this.openReturnDialog(filtered[0]);
    }
  }

  onItemScanned(item: any) {
    const loansWithItem = this.filteredLoansList.filter(l => l.items.some((i: any) => i.item.id === item.id));
    if (loansWithItem.length === 1) {
       this.openReturnDialog(loansWithItem[0]);
    } else if (loansWithItem.length > 1) {
       this.messageService.add({severity: 'warn', summary: 'Atenção', detail: 'Este item aparece em mais de um empréstimo na lista atual.'});
    } else {
       this.messageService.add({severity: 'error', summary: 'Não Encontrado', detail: 'Não há empréstimos pendentes contendo este item.'});
    }
  }
}
