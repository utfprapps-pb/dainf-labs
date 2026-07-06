import { CrudService } from '@/shared/crud/crud.service';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Loan } from './loan';
import { ReturnService } from '../return/return.service';
import { SearchRequest, Page } from '@/shared/models/search';

@Injectable()
export class LoanService extends CrudService<Loan> {
  private returnService = inject(ReturnService);

  constructor() {
    super('loans');
  }

  override search(req: SearchRequest): Observable<Page<Loan>> {
    return super.search(req).pipe(
      switchMap((page: Page<Loan>) => {
        if (!page.content || page.content.length === 0) {
          return of(page);
        }

        const loansWithReturns = page.content.filter(
          (l: Loan) => l.status === 'COMPLETED' || (l.items && l.items.some(i => (i.returnedQuantity || 0) > 0))
        );
        if (loansWithReturns.length === 0) {
          return of(page);
        }

        const requests = loansWithReturns.map((loan: Loan) =>
          this.returnService
            .search({
              filters: [{ field: 'loan.id', value: loan.id, type: 'EQUALS' }],
              page: 0,
              rows: 100,
              sort: { field: 'returnDate', type: 'DESC' },
            })
            .pipe(
              map((returnPage: Page<any>) => {
                if (returnPage.content && returnPage.content.length > 0) {
                  (loan as any).actualReturnDate =
                    returnPage.content[0].returnDate;
                    
                  if (loan.items) {
                    loan.items.forEach((loanItem: any) => {
                      if ((loanItem.returnedQuantity || 0) > 0) {
                        const matchingReturn = returnPage.content.find(r => 
                          r.items && r.items.some((ri: any) => ri.item && ri.item.id === loanItem.item.id)
                        );
                        if (matchingReturn) {
                          loanItem.actualReturnDate = matchingReturn.returnDate;
                        }
                      }
                    });
                  }
                }
                return loan;
              }),
            ),
        );

        return forkJoin(requests).pipe(map(() => page));
      }),
    );
  }

  getActiveLoansForItem(itemId: number): Observable<any> {
    return this._http.get(`${this._url}/item/${itemId}/active`);
  }

  getLoanHistoryForItem(itemId: number): Observable<any> {
    return this._http.get(`${this._url}/item/${itemId}/history`);
  }
}
