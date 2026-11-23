import { CrudService } from '@/shared/crud/crud.service';
import { Injectable } from '@angular/core';
import { Item } from './item';
import { Page, SearchRequest } from '@/shared/models/search';

@Injectable()
export class ItemService extends CrudService<Item> {
  constructor() {
    super('items');
  }

  setActive(id: number, active: boolean) {
    return this._http.put<Item>(`${this._url}/${id}/active`, { active });
  }
}

/** Administrative and historical searches must retain access to inactive items. */
@Injectable()
export class AllItemsService extends ItemService {
  override search(request: SearchRequest) {
    return this._http.post<Page<Item>>(`${this._url}/search/all`, request);
  }
}
