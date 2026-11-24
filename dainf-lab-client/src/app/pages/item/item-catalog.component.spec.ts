import { CartService } from '@/shared/services/cart.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Item } from './item';
import { ItemCatalogComponent } from './item-catalog.component';
import { ItemService } from './item.service';

describe('ItemCatalogComponent (detalhes do item)', () => {
  let component: ItemCatalogComponent;
  let cartService: jasmine.SpyObj<CartService>;

  const item = {
    id: 1,
    name: 'Arduino',
    description: 'Tensão: 5V\nCorrente máx.: 2A\nInterface: I2C',
    quantity: 3,
  } as Item;

  beforeEach(async () => {
    cartService = jasmine.createSpyObj<CartService>('CartService', ['addItem']);
    const itemService = {
      _url: 'items',
      search: () => of({ content: [], page: { totalElements: 0 } }),
    };

    await TestBed.configureTestingModule({
      imports: [ItemCatalogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: CartService, useValue: cartService }],
    })
      // Testa apenas a lógica do componente; o template completo não é necessário aqui.
      .overrideComponent(ItemCatalogComponent, {
        set: {
          template: '',
          imports: [],
          providers: [{ provide: ItemService, useValue: itemService }],
        },
      })
      .compileComponents();

    component = TestBed.createComponent(ItemCatalogComponent).componentInstance;
  });

  it('starts with the details dialog closed', () => {
    expect(component.detailsVisible()).toBeFalse();
    expect(component.selectedItem()).toBeNull();
  });

  it('opens the details dialog with the selected item and its multiline description', () => {
    component.openDetails(item);

    expect(component.detailsVisible()).toBeTrue();
    expect(component.selectedItem()).toBe(item);
    expect(component.selectedItem()!.description.split('\n').length).toBe(3);
  });

  it('closes the details dialog', () => {
    component.openDetails(item);
    component.closeDetails();

    expect(component.detailsVisible()).toBeFalse();
  });

  it('adds the selected item to the cart from the dialog and closes it', () => {
    component.openDetails(item);
    component.addSelectedToCart();

    expect(cartService.addItem).toHaveBeenCalledOnceWith(item);
    expect(component.detailsVisible()).toBeFalse();
  });

  it('does nothing when adding to cart without a selected item', () => {
    component.addSelectedToCart();

    expect(cartService.addItem).not.toHaveBeenCalled();
  });
});
