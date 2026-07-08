package br.edu.utfpr.dainf.dto;

import java.math.BigDecimal;

public record PendingItemDTO(Long itemId, String itemName, BigDecimal pendingQuantity) {
}
