package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.dto.CartItemDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Cart;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.CartRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock CartRepository repository;
    @Mock ItemService itemService;
    @Mock UserService userService;
    @InjectMocks CartService cartService;

    @Test
    void manageCartRejectsItemWithoutVisibility() {
        Item item = item(1L, true);
        when(itemService.findById(1L)).thenReturn(Optional.of(item));
        doThrow(new WarnException("Item não encontrado"))
                .when(itemService).validateVisible(List.of(item));

        assertThrows(WarnException.class, () -> cartService.manageCart(List.of(cartItem(1L))));

        verify(repository, never()).save(any());
    }

    @Test
    void manageCartAcceptsRestrictedItemWhenVisibilityAllowsIt() {
        Item item = item(1L, true);
        User staff = new User();
        Cart cart = new Cart();
        cart.setItems(new java.util.ArrayList<>());
        when(itemService.findById(1L)).thenReturn(Optional.of(item));
        when(userService.getCurrentUser()).thenReturn(staff);
        when(repository.findByUser(staff)).thenReturn(Optional.of(cart));
        when(repository.save(cart)).thenReturn(cart);

        Cart saved = cartService.manageCart(List.of(cartItem(1L)));

        assertEquals(1, saved.getItems().size());
        assertEquals(item, saved.getItems().getFirst().getItem());
        verify(itemService).validateVisible(List.of(item));
    }

    private Item item(Long id, boolean restricted) {
        Item item = new Item();
        item.setId(id);
        item.setRestricted(restricted);
        return item;
    }

    private CartItemDTO cartItem(Long itemId) {
        ItemDTO item = new ItemDTO();
        item.setId(itemId);
        CartItemDTO cartItem = new CartItemDTO();
        cartItem.setItem(item);
        cartItem.setQuantity(BigDecimal.ONE);
        return cartItem;
    }
}
