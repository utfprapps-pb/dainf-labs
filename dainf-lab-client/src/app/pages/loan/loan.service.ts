import { CrudService } from '@/shared/crud/crud.service';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Loan, PendingItem } from './loan';

@Injectable()
export class LoanService extends CrudService<Loan> {
  constructor() {
    super('loans');
  }

  getActiveLoansForItem(itemId: number): Observable<any> {
    return this._http.get(`${this._url}/item/${itemId}/active`);
  }

  getLoanHistoryForItem(itemId: number): Observable<any> {
    return this._http.get(`${this._url}/item/${itemId}/history`);
  }

  getPendingItemsForBorrower(borrowerId: number): Observable<PendingItem[]> {
    return this._http.get<PendingItem[]>(`${this._url}/borrower/${borrowerId}/pending`);
  }
}
