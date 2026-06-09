package br.edu.utfpr.dainf.dto;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.shared.Identifiable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class InventoryTransactionDTO implements Identifiable<Long> {
    private Long id;
    private Long itemId;
    private String itemName;
    private InventoryTransactionType type;
    private BigDecimal quantity;
    private String userName;
    private Instant date;
    private BigDecimal currentQuantity;
}
