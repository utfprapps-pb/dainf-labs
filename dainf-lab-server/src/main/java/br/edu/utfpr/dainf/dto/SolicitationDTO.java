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
public class SolicitationDTO implements Identifiable<Long> {
    private Long id;
    private String observation;

    @NotNull(message = "O campo 'Data de Solicitação' deve ser selecionado.")
    private Instant date;

    private UserDTO user;

    @Valid
    @NotNull(message = "Deve ser escolhido ao menos 1 item.")
    private List<SolicitationItemDTO> items;
}
