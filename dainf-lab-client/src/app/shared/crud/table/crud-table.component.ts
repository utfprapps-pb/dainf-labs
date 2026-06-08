import { Page } from '@/shared/models/search';
import { DeepValuePipe } from '@/shared/pipes/deep-value.pipe';
import { CommonModule } from '@angular/common';
import {
  Component,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { Table, TableModule } from 'primeng/table';
import { Column, CrudConfig, Identifiable } from '../crud';

@Component({
  selector: 'app-crud-table',
  templateUrl: 'crud-table.component.html',
  imports: [
    CommonModule,
    TableModule,
    Button,
    Paginator,
    DeepValuePipe,
    SkeletonModule,
  ],
})
export class CrudTableComponent<T extends Identifiable> implements OnChanges {
  table = viewChild(Table);

  columns = input<Column<T>[]>([]);
  config = input<CrudConfig<T>>();
  globalFilterFields = input<string[]>([]);
  actionsTemplate = input<TemplateRef<any>>();
  items = input<Page<T> | undefined>(undefined);
  loading = input<boolean>(false);
  loadingEntity = input<boolean>(false);
  templateMap = input<Map<keyof T | string, TemplateRef<any>> | undefined>(new Map());

  skeletonRows = Array(8).fill(0);
  first = signal(0);
  rows = signal(10);

  editClick = output<T>();
  deleteOneClick = output<T>();
  pageChange = output<{ page: number; size: number }>();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items']) {
      const page = this.items()?.page;
      if (page) {
        this.first.set(page.number * page.size);
        this.rows.set(page.size);
      }
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  onPage(event: PaginatorState) {
    this.first.set(event.first!);
    this.rows.set(event.rows!);
    this.pageChange.emit({
      page: event.first! / event.rows!,
      size: event.rows!,
    });
  }

  showActionsColumn(): boolean {
    if (this.actionsTemplate()) {
      return true;
    }
    const config = this.config();
    return config?.allowEditing !== false || config?.allowDeletion !== false;
  }

  edit(row: T) {
    this.editClick.emit(row);
  }

  deleteOne(row: T) {
    this.deleteOneClick.emit(row);
  }

  export() {
    this.table()!.exportCSV();
  }
}
