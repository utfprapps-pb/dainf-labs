package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.dto.CartItemDTO;
import br.edu.utfpr.dainf.model.Cart;
import br.edu.utfpr.dainf.model.CartItem;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.CartRepository;
import br.edu.utfpr.dainf.repository.ItemRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CartService {

    private final CartRepository repository;
    private final ItemLifecycleService lifecycle;
    private final ItemRepository itemRepository;
    private final UserService userService;

    public CartService(CartRepository repository, ItemRepository itemRepository, UserService userService, ItemLifecycleService lifecycle) {
        this.repository = repository;
        this.lifecycle = lifecycle;
        this.itemRepository = itemRepository;
        this.userService = userService;
    }

    @Transactional
    public Cart manageCart(List<CartItemDTO> itemsDTO) {
        if (itemsDTO != null) itemsDTO.stream().map(dto -> dto.getItem().getId()).distinct().sorted().forEach(lifecycle::requireActive);
        Cart cart = findCart();
        cart.getItems().clear();

        if (itemsDTO != null) {
            List<CartItem> newCartItems = itemsDTO.stream()
                    .map(dto -> {
                        Item item = itemRepository.findById(dto.getItem().getId())
                                .orElseThrow(() -> new EntityNotFoundException("Item não encontrado com ID: " + dto.getItem().getId()));

                        CartItem cartItem = new CartItem();
                        cartItem.setItem(item);
                        cartItem.setQuantity(dto.getQuantity());
                        cartItem.setCart(cart);

                        return cartItem;
                    })
                    .toList();

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
