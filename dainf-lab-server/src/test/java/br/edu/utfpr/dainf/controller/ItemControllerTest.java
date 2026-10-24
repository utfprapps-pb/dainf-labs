package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.AssetDTO;
import br.edu.utfpr.dainf.dto.CategoryDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.enums.ItemType;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
                .restricted(true)
                .name("Teste")
                .description("Descrição")
                .price(BigDecimal.TEN)
                .category(category)
                .type(ItemType.DURABLE)
                .assets(List.of(
                        AssetDTO.builder().serialNumber("12345").location("Lab 1").build(),
                        AssetDTO.builder().serialNumber("67890").location("Lab 2").build()
                ))
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

    @Test
    void createWithNullName_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .category(category)
                .type(ItemType.CONSUMABLE)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullCategory_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("Teste sem Categoria")
                .type(ItemType.CONSUMABLE)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullType_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("Teste sem Tipo")
                .category(category)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithBlankName_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("")
                .category(category)
                .type(ItemType.CONSUMABLE)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNameExceedingMaxLength_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("A".repeat(101))
                .category(category)
                .type(ItemType.CONSUMABLE)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithAssetMissingSerialNumber_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("Teste")
                .category(category)
                .type(ItemType.DURABLE)
                .assets(List.of(AssetDTO.builder().location("Lab 1").build()))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithAssetMissingLocation_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("Teste")
                .category(category)
                .type(ItemType.DURABLE)
                .assets(List.of(AssetDTO.builder().serialNumber("12345").build()))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNegativePrice_returns400() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("Teste Preço Negativo")
                .price(new BigDecimal("-50"))
                .category(category)
                .type(ItemType.CONSUMABLE)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithZeroPrice_isAccepted() throws Exception {
        ItemDTO dto = ItemDTO.builder()
                .name("Teste Preço Zero")
                .price(BigDecimal.ZERO)
                .category(category)
                .type(ItemType.CONSUMABLE)
                .build();
        performCreate(dto).andExpect(status().isCreated());
    }

    @Test
    void searchHidesRestrictedItemFromStudent() throws Exception {
        Long itemId = createResource();
        SearchRequest request = SearchRequest.builder()
                .filters(List.of(new SearchFilter("id", itemId, SearchFilter.Type.EQUALS)))
                .build();

        mockMvc.perform(post("/items/search")
                        .with(user(userWithRole(UserRole.ROLE_STUDENT)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void searchShowsRestrictedItemToStaff() throws Exception {
        Long itemId = createResource();
        SearchRequest request = SearchRequest.builder()
                .filters(List.of(new SearchFilter("id", itemId, SearchFilter.Type.EQUALS)))
                .build();

        mockMvc.perform(post("/items/search")
                        .with(user(userWithRole(UserRole.ROLE_LAB_TECHNICIAN)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(itemId))
                .andExpect(jsonPath("$.content[0].restricted").value(true));
    }

    private User userWithRole(UserRole role) {
        User user = new User();
        user.setEmail(role.name().toLowerCase() + "@utfpr.edu.br");
        user.setPassword("Teste123456!");
        user.setRole(role);
        user.setEnabled(true);
        return user;
    }
}
