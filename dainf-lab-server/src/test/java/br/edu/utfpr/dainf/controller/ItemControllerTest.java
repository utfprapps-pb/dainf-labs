package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.AssetDTO;
import br.edu.utfpr.dainf.dto.CategoryDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;

class ItemControllerTest extends CrudControllerTest<ItemDTO> {

    @Inject
    CategoryController categoryController;

    private CategoryDTO category;

    @BeforeEach
    protected void setUp() {
        ResponseEntity<Long> response = categoryController.create(new CategoryDTO(null, "Categoria Teste", "icon", List.of()));
        category = new CategoryDTO();
        category.setId(response.getBody());
        category.setDescription("Categoria Teste");
    }

    @Override
    protected String getURL() {
        return "/items";
    }

    @Override
    protected ItemDTO createValidObject() {
        return ItemDTO.builder()
                .name("Teste")
                .description("Descrição")
                .price(BigDecimal.TEN)
                .category(category)
                .assets(List.of(AssetDTO.builder().serialNumber("12345").build(), AssetDTO.builder().serialNumber("12345").build()))
                .build();
    }

    @Override
    protected ItemDTO createInvalidObject() {
        return new ItemDTO();
    }

    @Override
    protected void onBeforeUpdate(ItemDTO dto) {
        dto.setName("Teste Alterado");
    }
}
