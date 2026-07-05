import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudTableComponent } from '@/shared/crud/table/crud-table.component';
import { Page } from '@/shared/models/search';
import { extractErrorMessage } from '@/shared/utils/error.utils';
import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  model,
  OnInit,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import {
  catchError,
  debounceTime,
  finalize,
  skip,
  take,
  tap,
  throwError,
} from 'rxjs';
import { AuditedEntityLink, auditedEntityLink } from '../audited-entity-routes';
import { User } from '../user/user';
import { UserService } from '../user/user.service';
import {
  AuditEntityOption,
  AuditEntry,
  AuditFieldChange,
  AuditSearchRequest,
} from './audit';
import { AuditService } from './audit.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CrudTableComponent,
    InputContainerComponent,
    DatePickerModule,
    Select,
    ToolbarModule,
    RouterLink,
    SearchSelectComponent,
    ButtonModule,
    DialogModule,
    TooltipModule,
  ],
  selector: 'app-audit',
  templateUrl: 'audit.component.html',
  providers: [AuditService, UserService, DatePipe],
})
export class AuditComponent implements OnInit, AfterViewInit {
  auditService = inject(AuditService);
  userService = inject(UserService);
  messageService = inject(MessageService);
  datePipe = inject(DatePipe);

  descriptionTemplate = viewChild('descriptionTemplate', {
    read: TemplateRef<any>,
  });
  changesTemplate = viewChild('changesTemplate', { read: TemplateRef<any> });

  templateMap: Map<keyof AuditEntry | string, TemplateRef<any>> | undefined;

  changesDialogVisible = signal(false);
  loadingChanges = signal(false);
  changes = signal<AuditFieldChange[]>([]);

  config: CrudConfig<AuditEntry> = {
    title: 'Auditoria',
    allowEditing: false,
    allowDeletion: false,
  };

  cols: Column<AuditEntry>[] = [
    {
      field: 'revisionDate',
      header: 'Data/Hora',
      transform: (row) =>
        this.datePipe.transform(row.revisionDate, 'dd/MM/yyyy HH:mm:ss') || '',
    },
    { field: 'username', header: 'Usuário' },
    { field: 'entityName', header: 'Entidade' },
    { field: 'description', header: 'Registro' },
    {
      field: 'revisionType',
      header: 'Tipo de alteração',
      transform: (row) => this.revisionTypeLabel(row.revisionType),
    },
    { field: 'changes', header: 'Alterações', width: '8rem' },
  ];

  revisionTypeOptions = [
    { label: 'Inclusão', value: 'ADD' },
    { label: 'Alteração', value: 'MOD' },
    { label: 'Exclusão', value: 'DEL' },
  ];

  entityOptions = signal<AuditEntityOption[]>([]);

  entityFilter = model<string | undefined>();
  userFilter = model<User | undefined>();
  revisionTypeFilter = model<string | undefined>();
  dateFromFilter = model<Date | undefined>();
  dateToFilter = model<Date | undefined>();

  items = signal<Page<AuditEntry> | undefined>(undefined);
  loadingItems = signal<boolean>(false);

  lastPagination: { page: number; rows: number } | undefined;

  searchRequest = computed<AuditSearchRequest>(() => ({
    entityKey: this.entityFilter(),
    username: this.userFilter()?.email,
    revisionType: this.revisionTypeFilter(),
    dateFrom: this.toIsoStartOfDay(this.dateFromFilter()),
    dateTo: this.toIsoEndOfDay(this.dateToFilter()),
  }));

  searchRequestChange$ = toObservable(this.searchRequest)
    .pipe(
      skip(1),
      debounceTime(600),
      tap(() => this.loadItems()),
      takeUntilDestroyed(),
    )
    .subscribe();

  ngOnInit(): void {
    this.auditService
      .getEntities()
      .pipe(take(1))
      .subscribe((entities) => {
        this.entityOptions.set(entities);
        if (entities.length) {
          this.entityFilter.set(entities[0].key);
        }
      });
  }

  ngAfterViewInit(): void {
    this.templateMap = new Map([
      ['description', this.descriptionTemplate()!],
      ['changes', this.changesTemplate()!],
    ]);
  }

  entityLink(
    entityKey: string,
    entityId: number,
  ): AuditedEntityLink | undefined {
    return auditedEntityLink(entityKey, entityId);
  }

  viewChanges(row: AuditEntry) {
    this.changes.set([]);
    this.changesDialogVisible.set(true);
    this.loadingChanges.set(true);
    this.auditService
      .getChanges(row.entityKey, row.entityId, row.revisionId)
      .pipe(
        tap((changes) => this.changes.set(changes)),
        catchError((error) => {
          this.messageService.add({
            severity: 'warn',
            summary: 'Atenção!',
            detail: `Falha ao carregar as alterações: ${extractErrorMessage(error)}`,
          });
          return throwError(() => error);
        }),
        finalize(() => this.loadingChanges.set(false)),
        take(1),
      )
      .subscribe();
  }

  loadItems(page?: number, rows?: number) {
    if (!this.entityFilter()) {
      return;
    }
    this.loadingItems.set(true);
    this.lastPagination = { page: page ?? 0, rows: rows ?? 10 };
    const request: AuditSearchRequest = { ...this.searchRequest(), page, rows };
    this.auditService
      .search(request)
      .pipe(
        tap((result) => this.items.set(result)),
        catchError((error) => {
          this.messageService.add({
            severity: 'warn',
            summary: 'Atenção!',
            detail: `Falha ao carregar os registros de auditoria: ${extractErrorMessage(error)}`,
          });
          return throwError(() => error);
        }),
        finalize(() => this.loadingItems.set(false)),
        take(1),
      )
      .subscribe();
  }

  onPage(event: { page: number; size: number }) {
    this.loadItems(event.page, event.size);
  }

  private revisionTypeLabel(type: string): string {
    return (
      this.revisionTypeOptions.find((option) => option.value === type)?.label ??
      type
    );
  }

  private toIsoStartOfDay(date?: Date): string | undefined {
    if (!date) return undefined;
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result.toISOString();
  }

  private toIsoEndOfDay(date?: Date): string | undefined {
    if (!date) return undefined;
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result.toISOString();
  }
}
