package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.CategoryDTO;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CategoryControllerTest extends CrudControllerTest<CategoryDTO> {

    @Override
    protected String getURL() {
        return "/categories";
    }

    @Override
    protected CategoryDTO createValidObject() {
        CategoryDTO child1 = createChild("child1");
        CategoryDTO child2 = createChild("child2");
        return new CategoryDTO(null, "Teste", "icon", List.of(child1, child2), true);
    }

    @Override
    protected CategoryDTO createInvalidObject() {
        return new CategoryDTO(null, null, "icon", List.of(), true);
    }

    @Override
    protected void onBeforeUpdate(CategoryDTO dto) {
        dto.setDescription("Teste Alterado");
    }

    @Test
    void createWithNullDescription_returns400() throws Exception {
        CategoryDTO dto = new CategoryDTO(null, null, "icon", List.of(), true);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithEmptyDescription_returns400() throws Exception {
        CategoryDTO dto = new CategoryDTO(null, "", "icon", List.of(), true);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    private CategoryDTO createChild(String description) {
        CategoryDTO child = new CategoryDTO();
        child.setDescription(description);
        child.setIcon("icon");
        return child;
    }
}
