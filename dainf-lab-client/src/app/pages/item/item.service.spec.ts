import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentService } from '@/shared/services/config.service';
import { AllItemsService, ItemService } from './item.service';

describe('Item lifecycle HTTP contracts', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), ItemService, AllItemsService,
        { provide: EnvironmentService, useValue: { apiUrl: '/api' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the active-only search for operational selectors', () => {
    TestBed.inject(ItemService).search({ page: 0, rows: 10 }).subscribe();
    const request = http.expectOne('/api/items/search');
    expect(request.request.method).toBe('POST');
    request.flush({ content: [], page: { number: 0, totalPages: 0 } });
  });

  it('keeps inactive items searchable by administration and history', () => {
    const filters = [{ field: 'active', type: 'EQUALS' as const, value: false }];
    TestBed.inject(AllItemsService).search({ filters }).subscribe();
    const request = http.expectOne('/api/items/search/all');
    expect(request.request.body.filters).toEqual(filters);
    request.flush({ content: [], page: { number: 0, totalPages: 0 } });
  });

  it('changes status through the dedicated endpoint without resending the item', () => {
    TestBed.inject(ItemService).setActive(42, false).subscribe();
    const request = http.expectOne('/api/items/42/active');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ active: false });
    request.flush({ id: 42, active: false });
  });
});
