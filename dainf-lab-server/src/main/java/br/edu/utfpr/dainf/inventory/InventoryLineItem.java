package br.edu.utfpr.dainf.inventory;

import br.edu.utfpr.dainf.model.Item;

import java.math.BigDecimal;

public interface InventoryLineItem {
    Item getItem();
    BigDecimal inventoryQuantity();
}
