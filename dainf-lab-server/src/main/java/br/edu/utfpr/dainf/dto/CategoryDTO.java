package br.edu.utfpr.dainf.dto;

import br.edu.utfpr.dainf.shared.Identifiable;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CategoryDTO implements Identifiable<Long> {

    private Long id;

    @NotBlank(message = "O nome da categoria não pode ser nulo ou vazio")
    private String description;

    private String icon;

    private List<CategoryDTO> subcategories;
}
