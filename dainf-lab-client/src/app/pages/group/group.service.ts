import { CrudService } from '@/shared/crud/crud.service';
import { Injectable } from '@angular/core';
import { Group } from './group';

@Injectable()
export class GroupService extends CrudService<Group> {
  constructor() {
    super('groups');
  }
}
