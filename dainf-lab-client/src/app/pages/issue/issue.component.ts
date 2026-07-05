import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
import { CategoryService } from '../category/category.service';
import { TreeSelectModule } from 'primeng/treeselect';
import { TreeNode } from 'primeng/api';
import { CategoryTreeNodePipe } from '@/shared/pipes/category-tree-node.pipe';

interface LoanItemWithTemp extends LoanItem {
  tempReturnQty?: number;
  returnedQuantity?: number;
}

interface LoanWithTemp extends Loan {
  items: LoanItemWithTemp[];
}

import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { MessageService } from 'primeng/api';
import { BarcodeScannerComponent } from '@/shared/components/barcode-scanner/barcode-scanner.component';

import { ItemService } from '../item/item.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    PaginatorModule,
    BarcodeScannerComponent,
    TreeSelectModule,
  ],
  providers: [
    LoanService,
    ReturnService,
    DialogService,
    UserService,
    MessageService,
    ItemService,
    CategoryService,
    CategoryTreeNodePipe,
  ],
  selector: 'app-issue',
  templateUrl: './issue.component.html',
})
export class IssueComponent implements OnInit {
  loanService = inject(LoanService);
  returnService = inject(ReturnService);
  dialogService = inject(DialogService);
  userService = inject(UserService);
  messageService = inject(MessageService);

  loans = signal<LoanWithTemp[]>([]);
  loading = signal(false);
  viewMode: 'cards' | 'list' = 'cards';

  categoryService = inject(CategoryService);
  categoryTreeNodePipe = inject(CategoryTreeNodePipe);
  categories = signal<any[]>([]);
  cardItemFilter = signal<string>('ALL');
  filterNodes = signal<TreeNode[]>([]);
  selectedFilterNode = signal<TreeNode | null>(null);

  onFilterChange() {
    const node = this.selectedFilterNode();
    this.cardItemFilter.set(node ? (node.data as string) : 'ALL');

    localStorage.setItem('cardItemFilter', this.cardItemFilter());
  }

  first = 0;
  rows = 10;

  onPage(event: any) {
    this.first = event.first;
    this.rows = event.rows;
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'cards' ? 'list' : 'cards';
  }

  // Filtros
  filterName = '';
  filterDocument = '';
  filterItem = '';
  filterStatus = '';
  filterType = '';
  filterLoanDate = '';
  filterDeadlineDate = '';

  hasAdvancedPrivileges = toSignal(this.userService.hasAdvancedPrivileges(), {
    initialValue: false,
  });

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
    this.loadLoans();
  }

  loadLoans() {
    this.loading.set(true);
    const request: SearchRequest = {
      filters: [],
      sort: { field: 'id', type: 'DESC' },
      page: 0,
      rows: 100,
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
          this.returnService.findByLoan(loan).pipe(catchError(() => of(null))),
        );

        forkJoin(observables).subscribe((returns: any[]) => {
          const loansWithTemp = loans.map((loan: Loan, idx: number) => {
            const existingReturn = returns[idx];
            return {
              ...loan,
              actualReturnDate: existingReturn?.returnDate,
              items: loan.items.map((item: any) => {
                const retItem = existingReturn?.items?.find(
                  (r: any) => r.item?.id === item.item?.id,
                );
                return {
                  ...item,
                  returnedQuantity: retItem ? retItem.quantityReturned : 0,
                  tempReturnQty: 0,
                };
              }),
            };
          });
          this.loans.set(loansWithTemp);
          this.loading.set(false);
        });
      },
      error: () => this.loading.set(false),
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
      list = list.filter((l) => l.borrower?.nome?.toLowerCase().includes(name));
    }
    if (doc) {
      list = list.filter((l) =>
        l.borrower?.documento?.toLowerCase().includes(doc),
      );
    }
    const itemSearch = this.filterItem?.toLowerCase() || '';
    if (itemSearch) {
      list = list.filter(
        (l) =>
          l.items &&
          l.items.some((i: any) => {
            const itemObj = i.item;
            if (!itemObj) return false;
            if (itemObj.name?.toLowerCase().includes(itemSearch)) return true;
            if (itemObj.code?.toLowerCase().includes(itemSearch)) return true;
            if (
              itemObj.assets &&
              itemObj.assets.some((a: any) =>
                a.serialNumber?.toLowerCase().includes(itemSearch),
              )
            )
              return true;
            return false;
          }),
      );
    }
    if (status) {
      let mappedStatus = '';
      if (status === 'Atrasado') mappedStatus = 'OVERDUE';
      else if (status === 'Em dia') mappedStatus = 'ONGOING';
      else if (status === 'Finalizado') mappedStatus = 'COMPLETED';

      list = list.filter((l) => l.status === mappedStatus);
    } else {
      list = list.filter((l) => l.status !== 'COMPLETED');
    }
    if (type) {
      list = list.filter(
        (l) =>
          l.items &&
          l.items.some((i: any) => i.item?.category?.description === type),
      );
    }
    if (loanDate) {
      list = list.filter((l) => {
        const d = new Date(l.loanDate).toISOString().split('T')[0];
        return d === loanDate;
      });
    }
    if (deadlineDate) {
      list = list.filter((l) => {
        const targetDate = (l as any).actualReturnDate || l.deadline;
        const d = new Date(targetDate).toISOString().split('T')[0];
        return d === deadlineDate;
      });
    }
    return list;
  }

  get groupedLoansForCards() {
    const list = this.filteredLoansList;
    if (this.filterStatus === 'Finalizado') {
      const userMap = new Map<number, any>();
      for (const loan of list) {
        const borrowerId = loan.borrower.id;
        if (!userMap.has(borrowerId)) {
          userMap.set(borrowerId, {
            ...loan,
            isGroupedHistory: true,
            items: [...loan.items],
          });
        } else {
          const existing = userMap.get(borrowerId);
          existing.items.push(...loan.items);
        }
      }
      return Array.from(userMap.values());
    }
    return list;
  }

  get totalCardsLength() {
    return this.viewMode === 'cards'
      ? this.groupedLoansForCards.length
      : this.filteredLoansList.length;
  }
  get paginatedLoansList() {
    const listToSlice =
      this.viewMode === 'cards'
        ? this.groupedLoansForCards
        : this.filteredLoansList;
    return listToSlice.slice(this.first, this.first + this.rows);
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
    const itemsToReturn = loan.items.filter(
      (item: any) => item.tempReturnQty > 0,
    );
    if (itemsToReturn.length === 0) return;

    // Buscar se jÃ¡ existe um return para esse loan
    this.returnService
      .findByLoan(loan)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (existingReturn) => {
          const payload: Return = {
            id: existingReturn?.id,
            loan: loan,
            returnDate: new Date().toISOString(),
            items: loan.items.map((item: any) => {
              const oldReturnItem = existingReturn?.items?.find(
                (r: any) => r.item?.id === item.item?.id,
              );
              return {
                item: item.item,
                quantityIssued: oldReturnItem?.quantityIssued || 0,
                quantityReturned:
                  (item.returnedQuantity || 0) + (item.tempReturnQty || 0),
              };
            }),
          } as Return;

          const obs = existingReturn?.id
            ? this.returnService.update(existingReturn.id, payload)
            : this.returnService.create(payload);

          obs.subscribe({
            next: () => {
              this.loadLoans();
            },
          });
        },
      });
  }

  openReturnDialog(loan: any) {
    const ref = this.dialogService.open(LoanReturnDialog, {
      header: `Ficha de Empréstimo`,
      width: '90vw',
      modal: true,
      dismissableMask: true,
      data: { loan },
      styleClass: 'return-ficha-modal',
    });

    ref.onClose.subscribe((result: any) => {
      if (result?.success) {
        this.loadLoans();
      }
    });
  }

  getGroupedItems(loan: any) {
    if (!loan || !loan.items) return [];
    const filter = this.cardItemFilter();
    let filteredItems = loan.items;

    if (filter !== 'ALL') {
      if (filter.startsWith('TYPE:')) {
        const type = filter.split(':')[1];
        filteredItems = filteredItems.filter((i: any) => i.item?.type === type);
      } else if (filter.startsWith('CAT:')) {
        const catId = Number(filter.split(':')[1]);
        filteredItems = filteredItems.filter(
          (i: any) => i.item?.category?.id === catId,
        );
      }
    }

    const groups: { [key: string]: any[] } = {};
    filteredItems.forEach((item: any) => {
      let groupName = item.item?.category?.description || 'Outros';
      if (groupName.toLowerCase().includes('ferramenta'))
        groupName = 'Ferramentas emprestadas';
      else groupName = 'Componentes emprestados';

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });
    return Object.entries(groups).map(([name, items]) => ({ name, items }));
  }

  confirmQuickReturn(loan: Loan) {
    this.openReturnDialog(loan);
  }

  clearFilters() {
    this.filterName = '';
    this.filterDocument = '';
    this.filterItem = '';
    this.filterStatus = '';
    this.filterType = '';
    this.filterLoanDate = '';
    this.filterDeadlineDate = '';
    this.first = 0;
  }

  onUserScanned(user: any) {
    this.filterDocument = user.documento;
    const filtered = this.filteredLoansList;
    if (filtered.length === 1) {
      this.openReturnDialog(filtered[0]);
    }
  }

  onItemScanned(item: any) {
    const loansWithItem = this.filteredLoansList.filter((l) =>
      l.items.some((i: any) => i.item.id === item.id),
    );
    if (loansWithItem.length === 1) {
      this.openReturnDialog(loansWithItem[0]);
    } else if (loansWithItem.length > 1) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Este item aparece em mais de um empréstimo na lista atual.',
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Não Encontrado',
        detail: 'Não há empréstimos pendentes contendo este item.',
      });
    }
  }
}
