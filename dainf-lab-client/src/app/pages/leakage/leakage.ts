import { Identifiable } from '@/shared/crud/crud';
import { Item } from '../item/item';
import { User } from '../user/user';
import { Loan } from '../loan/loan';

export interface LeakageItem extends Identifiable {
  quantity: number;
  item: Item;
}

export interface Leakage extends Identifiable {
  date: Date;
  user: User;
  items: LeakageItem[];
  observation?: string;
  loan?: Loan;
}
