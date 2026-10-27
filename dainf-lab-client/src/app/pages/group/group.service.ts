import { CrudService } from '@/shared/crud/crud.service';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '../user/user';
import { Group } from './group';

@Injectable()
export class GroupService extends CrudService<Group> {
  constructor() {
    super('groups');
  }

  getUsers(groupId: number): Observable<User[]> {
    return this._http.get<User[]>(`${this._url}/${groupId}/users`);
  }

  setUsers(groupId: number, userIds: number[]): Observable<User[]> {
    return this._http.put<User[]>(`${this._url}/${groupId}/users`, userIds);
  }
}
