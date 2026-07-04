package br.edu.utfpr.dainf.dto;

import br.edu.utfpr.dainf.enums.ItemType;
import br.edu.utfpr.dainf.model.ItemImage;
import br.edu.utfpr.dainf.shared.Identifiable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ItemDTO implements Identifiable<Long> {
    private Long id;

    @NotBlank
    @NotNull
    @NotEmpty(message = "O campo 'Nome' é obrigatório")
    @Size(max = 50, message = "O campo 'Nome' deve ter no máximo 50 caracteres")
    private String name;

    private String description;
    private BigDecimal price;

    @NotNull(message = "O campo 'Categoria' é obrigatório")
    private CategoryDTO category;

    @Valid
    private List<AssetDTO> assets;
    private List<ItemImage> images;
    private String siorg;
    private String location;
    private BigDecimal quantity;
    private BigDecimal minimumStock;

    @NotNull(message = "O campo 'Tipo' é obrigatório")
    private ItemType type;

    private String code;
}
