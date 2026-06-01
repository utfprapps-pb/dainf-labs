package br.edu.utfpr.dainf.dto;

import br.edu.utfpr.dainf.shared.Identifiable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.List;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PurchaseDTO implements Identifiable<Long> {
    private Long id;

    @NotNull(message = "O campo 'Data de Compra' deve ser selecionado.")
    private Instant date;

    private String observation;

    @NotNull(message = "O campo 'Fornecedor' deve ser escolhido.")
    private FornecedorDTO fornecedor;

    private SimpleUserDTO user;

    @Valid
    @NotNull(message = "Deve ser escolhido ao menos 1 produto.")
    private List<PurchaseItemDTO> items;
}
