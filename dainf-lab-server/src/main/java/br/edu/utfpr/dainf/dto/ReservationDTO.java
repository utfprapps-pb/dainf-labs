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
public class ReservationDTO implements Identifiable<Long> {
    private Long id;
    private String description;
    private String observation;

    @NotNull(message = "Deve ser informado a data de reserva.")
    private Instant reservationDate;

    @NotNull(message = "Deve ser informada a data de retirada.")
    private Instant withdrawalDate;
    private SimpleUserDTO user;

    @Valid
    @NotNull(message = "Deve ser escolhido ao menos 1 produto.")
    private List<ReservationItemDTO> items;
}
