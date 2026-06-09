package br.edu.utfpr.dainf.dto;

import br.edu.utfpr.dainf.shared.Identifiable;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ReservationItemDTO implements Identifiable<Long> {
    private Long id;

    @NotNull(message = "O campo 'Item' é obrigatório.")
    private ItemDTO item;

    @NotNull(message = "O campo 'Quantidade' é obrigatório.")
    @DecimalMin(value = "1", message = "A quantidade deve ser maior ou igual a 1.")
    private BigDecimal quantity;
}
