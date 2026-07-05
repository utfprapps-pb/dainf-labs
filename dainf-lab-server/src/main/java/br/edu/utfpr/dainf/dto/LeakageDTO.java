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
public class LeakageDTO implements Identifiable<Long> {
    private Long id;

    @NotNull(message = "O campo 'Data de Saida' deve ser selecionado.")
    private Instant date;

    private String observation;
    private SimpleUserDTO user;

    @Valid
    @NotNull(message = "Deve ser escolhido ao menos 1 produto.")
    private List<LeakageItemDTO> items;

    private LoanDTO loan;
}
