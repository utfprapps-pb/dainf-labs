package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ItemServiceTest {

    @Mock ItemRepository repository;
    @Mock StorageService storageService;
    @Mock UserService userService;
    @InjectMocks ItemService itemService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(itemService, "repository", repository);
        lenient().when(repository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(Page.empty());
    }

    @Test
    void searchAddsRestrictedFilterForOrdinaryUser() {
        SearchRequest request = new SearchRequest();
        when(userService.hasPrivilegedAcess()).thenReturn(false);

        itemService.search(request);

        assertEquals(1, request.getFilters().size());
        SearchFilter filter = request.getFilters().getFirst();
        assertEquals("restricted", filter.getField());
        assertEquals(false, filter.getValue());
        assertEquals(SearchFilter.Type.EQUALS, filter.getType());
    }

    @Test
    void searchDoesNotAddRestrictedFilterForStaff() {
        SearchRequest request = new SearchRequest();
        when(userService.hasPrivilegedAcess()).thenReturn(true);

        itemService.search(request);

        assertTrue(request.getFilters().isEmpty());
    }

    @Test
    void validateVisibleRejectsRestrictedItemForStudent() {
        Item item = new Item();
        item.setRestricted(true);
        User student = user(UserRole.ROLE_STUDENT);
        when(userService.getCurrentUser()).thenReturn(student);

        WarnException exception = assertThrows(WarnException.class,
                () -> itemService.validateVisible(List.of(item)));

        assertEquals("Item não encontrado", exception.getMessage());
    }

    @Test
    void validateVisibleAcceptsRestrictedItemForStaff() {
        Item item = new Item();
        item.setRestricted(true);
        when(userService.getCurrentUser()).thenReturn(user(UserRole.ROLE_LAB_TECHNICIAN));

        assertDoesNotThrow(() -> itemService.validateVisible(List.of(item)));
    }

    @Test
    void isVisibleToAllowsPublicItemsForOrdinaryUsers() {
        Item item = new Item();

        assertTrue(itemService.isVisibleTo(item, user(UserRole.ROLE_STUDENT)));
        assertTrue(itemService.isVisibleTo(item, user(UserRole.ROLE_PROFESSOR)));
    }

    @Test
    void isVisibleToHidesRestrictedItemsOnlyFromOrdinaryUsers() {
        Item item = new Item();
        item.setRestricted(true);

        assertFalse(itemService.isVisibleTo(item, user(UserRole.ROLE_STUDENT)));
        assertFalse(itemService.isVisibleTo(item, user(UserRole.ROLE_PROFESSOR)));
        assertTrue(itemService.isVisibleTo(item, user(UserRole.ROLE_ADMIN)));
        assertTrue(itemService.isVisibleTo(item, user(UserRole.ROLE_LAB_TECHNICIAN)));
    }

    @Test
    void isVisibleToAllowsItemWhenUserBelongsToAnActiveGroup() {
        Group robotinic = group(1L, true);
        Item item = new Item();
        item.setGroups(Set.of(robotinic));
        User student = user(UserRole.ROLE_STUDENT);
        student.setGroups(Set.of(robotinic));

        assertTrue(itemService.isVisibleTo(item, student));
    }

    @Test
    void isVisibleToHidesItemFromUserInAnotherGroup() {
        Item item = new Item();
        item.setGroups(Set.of(group(1L, true)));
        User student = user(UserRole.ROLE_STUDENT);
        student.setGroups(Set.of(group(2L, true)));

        assertFalse(itemService.isVisibleTo(item, student));
    }

    @Test
    void isVisibleToHidesItemWhenSharedGroupIsInactive() {
        Group inactiveGroup = group(1L, false);
        Item item = new Item();
        item.setGroups(Set.of(inactiveGroup));
        User student = user(UserRole.ROLE_STUDENT);
        student.setGroups(Set.of(inactiveGroup));

        assertFalse(itemService.isVisibleTo(item, student));
    }

    @Test
    void isVisibleToKeepsRestrictedItemHiddenFromGroupMember() {
        Group robotinic = group(1L, true);
        Item item = new Item();
        item.setRestricted(true);
        item.setGroups(Set.of(robotinic));
        User student = user(UserRole.ROLE_STUDENT);
        student.setGroups(Set.of(robotinic));

        assertFalse(itemService.isVisibleTo(item, student));
    }

    private User user(UserRole role) {
        User user = new User();
        user.setRole(role);
        return user;
    }

    private Group group(Long id, boolean active) {
        Group group = new Group();
        group.setId(id);
        group.setName("Grupo " + id);
        group.setActive(active);
        return group;
    }
}
