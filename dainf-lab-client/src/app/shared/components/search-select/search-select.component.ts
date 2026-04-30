import { Identifiable } from '@/shared/crud/crud';
import { CrudService } from '@/shared/crud/crud.service';
import { Page, SearchFilter } from '@/shared/models/search';
import { CommonModule } from '@angular/common';
import { Component, computed, forwardRef, input, signal } from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  AutoCompleteCompleteEvent,
  AutoCompleteLazyLoadEvent,
  AutoCompleteModule,
} from 'primeng/autocomplete';
import { Observable, take, tap } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-search-select',
  imports: [CommonModule, AutoCompleteModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectComponent),
      multi: true,
    },
  ],
  template: `
    <p-autocomplete
      class="w-full"
      [(ngModel)]="value"
      [virtualScroll]="true"
      [lazy]="true"
      [suggestions]="suggestions()"
      [virtualScrollItemSize]="34"
      (completeMethod)="complete($event)"
      (onLazyLoad)="onLazyLoad($event)"
      [dropdown]="true"
      dropdownMode="current"
      [optionLabel]="resolvedOptionLabel()"
      [placeholder]="placeholder()"
      (onSelect)="handleChange($event)"
      appendTo="body"
      [disabled]="disabled"
      styleClass="w-full"
    />
  `,
})
export class SearchSelectComponent<T extends Identifiable>
  implements ControlValueAccessor
{
  placeholder = input<string>();

  optionLabel = input.required<string>();

  service = input.required<CrudService<T>>();
  filters = input<SearchFilter[]>();

  itemLabel = input<(item: T) => string>();

  value?: T;
  disabled = false;
  suggestions = signal<any[]>([]);

  resolvedOptionLabel = computed(() => this.itemLabel() ? '_customLabel' : this.optionLabel());

  private _currentPage = 0;
  private _hasMore = true;
  private _loading = false;
  private _lastQuery = '';

  complete(event: AutoCompleteCompleteEvent) {
    this._lastQuery = event.query;
    this._currentPage = 0;
    this._hasMore = true;
    this.suggestions.set([]);
    this._fetchPage(event.query, 0);
  }

  onLazyLoad(event: AutoCompleteLazyLoadEvent) {
    if (!this._hasMore || this._loading) return;
    const loaded = this.suggestions().length;
    if (event.last >= loaded - 3) {
      this._fetchPage(this._lastQuery, ++this._currentPage, true);
    }
  }

  onChange: (value: T | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: T | string | null): void {
    if (!value) {
      this.value = undefined;
      return;
    }

    if (typeof value !== 'string') {
      if (this.itemLabel()) {
        (value as any)['_customLabel'] = this.itemLabel()!(value);
      }
      this.value = value;
      return;
    }

    this._fetchPage(value, 0);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  handleChange(event: any) {
    const val = event.value as T;
    this.value = val;
    this.onChange(val);
    this.onTouched();
  }

  private _fetchPage(query: string, page: number, append = false) {
    if (this._loading) return;
    this._loading = true;

    const filters = this._mapFilters(query);
    this._search(filters, page)
      .pipe(
        tap((res) => {
          const content = res.content;
          const labelFn = this.itemLabel();
          if (labelFn) {
            content.forEach((item: any) => {
              item['_customLabel'] = labelFn(item);
            });
          }
          if (append) {
            this.suggestions.update(prev => [...prev, ...content]);
          } else {
            this.suggestions.set(content);
          }
          this._hasMore = res.page.number < res.page.totalPages - 1;
          this._loading = false;
        }),
        take(1),
      )
      .subscribe();
  }

  private _search(filters: SearchFilter[], page: number = 0): Observable<Page<T>> {
    return this.service()!.search({
      page,
      rows: 10,
      filters: filters || [],
    });
  }

  private _mapFilters(query: string): SearchFilter[] {
    return [
      ...(this.filters() ?? []),
      {
        field: this.optionLabel(),
        type: this.optionLabel()?.includes('id') ? 'IS_NOT_NULL' : 'ILIKE',
        value: query,
      },
    ];
  }
}