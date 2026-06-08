package br.edu.utfpr.dainf.audit;

import br.edu.utfpr.dainf.model.*;

import java.util.Arrays;
import java.util.Optional;

/**
 * Registry of {@code @Audited} entities that can be browsed on the audit log page.
 */
public enum AuditableEntity {
    ASSET("Patrimônio", Asset.class),
    CART("Carrinho", Cart.class),
    CART_ITEM("Item do carrinho", CartItem.class),
    CATEGORY("Categoria", Category.class),
    CONFIGURATION("Configuração", Configuration.class),
    FORNECEDOR("Fornecedor", Fornecedor.class),
    INVENTORY("Estoque", Inventory.class),
    INVENTORY_TRANSACTION("Transação de estoque", InventoryTransaction.class),
    ISSUE("Saída", Issue.class),
    ISSUE_ITEM("Item de saída", IssueItem.class),
    ITEM("Item", Item.class),
    ITEM_IMAGE("Imagem do item", ItemImage.class),
    LOAN("Empréstimo", Loan.class),
    LOAN_ITEM("Item de empréstimo", LoanItem.class),
    PURCHASE("Compra", Purchase.class),
    PURCHASE_ITEM("Item de compra", PurchaseItem.class),
    RESERVATION("Reserva", Reservation.class),
    RESERVATION_ITEM("Item de reserva", ReservationItem.class),
    RETURN("Devolução", Return.class),
    RETURN_ITEM("Item de devolução", ReturnItem.class),
    SOLICITATION("Solicitação", Solicitation.class),
    SOLICITATION_ITEM("Item de solicitação", SolicitationItem.class),
    USER("Usuário", User.class),
    USER_RECOVERY("Recuperação de usuário", UserRecovery.class);

    private final String label;
    private final Class<?> entityClass;

    AuditableEntity(String label, Class<?> entityClass) {
        this.label = label;
        this.entityClass = entityClass;
    }

    public String getLabel() {
        return label;
    }

    public Class<?> getEntityClass() {
        return entityClass;
    }

    public static Optional<AuditableEntity> fromKey(String key) {
        return Arrays.stream(values())
                .filter(entity -> entity.name().equals(key))
                .findFirst();
    }
}
