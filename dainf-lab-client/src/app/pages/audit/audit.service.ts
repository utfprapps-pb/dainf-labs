import { Page } from '@/shared/models/search';
import { BaseService } from '@/shared/services/base.service';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { AuditEntityOption, AuditEntry, AuditFieldChange, AuditSearchRequest } from './audit';

@Injectable()
export class AuditService extends BaseService {
  private readonly _url = `${this.apiUrl}/audit`;

  search(request: AuditSearchRequest): Observable<Page<AuditEntry>> {
    return this._http.post<Page<Omit<AuditEntry, 'id'>>>(`${this._url}/search`, request).pipe(
      map((page) => ({
        ...page,
        content: page.content.map((entry) => ({ ...entry, id: entry.revisionId })),
      })),
    );
  }

  getEntities(): Observable<AuditEntityOption[]> {
    return this._http.get<AuditEntityOption[]>(`${this._url}/entities`);
  }

  getChanges(entityKey: string, entityId: number, revisionId: number): Observable<AuditFieldChange[]> {
    return this._http.get<AuditFieldChange[]>(`${this._url}/${entityKey}/${entityId}/${revisionId}/changes`);
  }
}
