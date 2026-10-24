package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.AssetDTO;
import br.edu.utfpr.dainf.dto.CategoryDTO;
import br.edu.utfpr.dainf.dto.GroupDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.enums.ItemType;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.GroupRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ItemControllerTest extends CrudControllerTest<ItemDTO> {

    @Inject
    CategoryController categoryController;

    @Inject
    GroupRepository groupRepository;

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

    @Test
    void searchAppliesGroupVisibilityWithoutDuplicatesOrWrongPaginationTotal() throws Exception {
        String prefix = "GROUP-VIS-" + UUID.randomUUID();
        Group robotinic = createGroup("Robotinic " + prefix, true);
        Group aerodesign = createGroup("Aerodesign " + prefix, true);

        Long publicItem = createItem(prefix + " Público", Set.of());
        Long robotinicItem = createItem(prefix + " Robotinic", Set.of(robotinic, aerodesign));
        Long aerodesignItem = createItem(prefix + " Aerodesign", Set.of(aerodesign));

        SearchRequest request = SearchRequest.builder()
                .filters(List.of(new SearchFilter("name", prefix, SearchFilter.Type.ILIKE)))
                .rows(10)
                .build();

        var noGroupResult = searchAs(request, userWithRole(UserRole.ROLE_STUDENT));
        assertEquals(Set.of(publicItem), contentIds(noGroupResult));
        assertEquals(1, noGroupResult.path("page").path("totalElements").asInt());

        User robotinicMember = userWithRole(UserRole.ROLE_STUDENT);
        robotinicMember.setGroups(Set.of(robotinic));
        var robotinicResult = searchAs(request, robotinicMember);
        assertEquals(Set.of(publicItem, robotinicItem), contentIds(robotinicResult));
        assertEquals(2, robotinicResult.path("page").path("totalElements").asInt());

        SearchRequest pagedRequest = SearchRequest.builder()
                .filters(request.getFilters())
                .rows(1)
                .build();
        var pagedResult = searchAs(pagedRequest, robotinicMember);
        assertEquals(1, pagedResult.path("content").size());
        assertEquals(2, pagedResult.path("page").path("totalElements").asInt());

        var staffResult = searchAs(request, userWithRole(UserRole.ROLE_LAB_TECHNICIAN));
        assertEquals(Set.of(publicItem, robotinicItem, aerodesignItem), contentIds(staffResult));
        assertEquals(3, staffResult.path("page").path("totalElements").asInt());
    }

    @Test
    void searchHidesItemsBelongingOnlyToInactiveGroup() throws Exception {
        String prefix = "INACTIVE-GROUP-" + UUID.randomUUID();
        Group inactiveGroup = createGroup("Inativo " + prefix, false);
        createItem(prefix, Set.of(inactiveGroup));
        User member = userWithRole(UserRole.ROLE_STUDENT);
        member.setGroups(Set.of(inactiveGroup));
        SearchRequest request = SearchRequest.builder()
                .filters(List.of(new SearchFilter("name", prefix, SearchFilter.Type.ILIKE)))
                .build();

        var result = searchAs(request, member);

        assertEquals(0, result.path("page").path("totalElements").asInt());
    }

    @Test
    void staffCanFilterItemsByGroupWithoutDuplicates() throws Exception {
        String prefix = "GROUP-FILTER-" + UUID.randomUUID();
        Group robotinic = createGroup("Robotinic " + prefix, true);
        Group secondary = createGroup("Secundário " + prefix, true);
        Long itemId = createItem(prefix, Set.of(robotinic, secondary));
        SearchRequest request = SearchRequest.builder()
                .filters(List.of(
                        new SearchFilter("name", prefix, SearchFilter.Type.ILIKE),
                        new SearchFilter("groups", robotinic.getId(), SearchFilter.Type.EQUALS)
                ))
                .build();

        var result = searchAs(request, userWithRole(UserRole.ROLE_ADMIN));

        assertEquals(Set.of(itemId), contentIds(result));
        assertEquals(1, result.path("page").path("totalElements").asInt());
    }

    private Group createGroup(String name, boolean active) {
        Group group = new Group();
        group.setName(name);
        group.setActive(active);
        return groupRepository.save(group);
    }

    private Long createItem(String name, Set<Group> groups) throws Exception {
        Set<GroupDTO> groupDTOs = groups.stream()
                .map(group -> GroupDTO.builder()
                        .id(group.getId())
                        .name(group.getName())
                        .description(group.getDescription())
                        .active(group.isActive())
                        .build())
                .collect(Collectors.toSet());
        ItemDTO item = ItemDTO.builder()
                .name(name)
                .category(category)
                .type(ItemType.CONSUMABLE)
                .restricted(false)
                .groups(groupDTOs)
                .build();
        return extractId(performCreate(item).andExpect(status().isCreated()).andReturn());
    }

    private com.fasterxml.jackson.databind.JsonNode searchAs(SearchRequest request, User user) throws Exception {
        MvcResult result = mockMvc.perform(post("/items/search")
                        .with(user(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(request)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private Set<Long> contentIds(com.fasterxml.jackson.databind.JsonNode result) {
        return StreamSupport.stream(result.path("content").spliterator(), false)
                .map(node -> node.path("id").asLong())
                .collect(Collectors.toSet());
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
