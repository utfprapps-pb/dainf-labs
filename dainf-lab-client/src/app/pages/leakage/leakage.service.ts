import { CrudService } from '@/shared/crud/crud.service';
import { Injectable } from '@angular/core';
import { Leakage } from './leakage';

@Injectable()
export class LeakageService extends CrudService<Leakage> {
  constructor() {
    super('leakages');
  }
}
