package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.dto.CartItemDTO;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Cart;
import br.edu.utfpr.dainf.model.CartItem;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.CartRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class CartService {

    private final CartRepository repository;
    private final ItemService itemService;
    private final UserService userService;

    public CartService(CartRepository repository, ItemService itemService, UserService userService) {
        this.repository = repository;
        this.itemService = itemService;
        this.userService = userService;
    }

    @Transactional
    public Cart manageCart(List<CartItemDTO> itemsDTO) {
        List<Item> items = itemsDTO == null
                ? List.of()
                : itemsDTO.stream()
                .map(dto -> itemService.findById(dto.getItem().getId())
                        .orElseThrow(() -> new WarnException("Item não encontrado")))
                .toList();
        itemService.validateVisible(items);

        Cart cart = findCart();
        cart.getItems().clear();

        if (itemsDTO != null) {
            List<CartItem> newCartItems = new ArrayList<>();
            for (int index = 0; index < itemsDTO.size(); index++) {
                CartItem cartItem = new CartItem();
                cartItem.setItem(items.get(index));
                cartItem.setQuantity(itemsDTO.get(index).getQuantity());
                cartItem.setCart(cart);
                newCartItems.add(cartItem);
            }

            cart.getItems().addAll(newCartItems);
        }

        return repository.save(cart);
    }


    public Cart findCart() {
        User user = userService.getCurrentUser();
        return repository.findByUser(user)
            .orElseGet(() -> {
                Cart newCart = new Cart();
                newCart.setUser(user);
                return repository.save(newCart);
            });
    }
}
