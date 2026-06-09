package br.edu.utfpr.dainf.audit;

import br.edu.utfpr.dainf.shared.Identifiable;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.hibernate.envers.AuditReaderFactory;
import org.hibernate.envers.RevisionType;
import org.hibernate.envers.query.AuditEntity;
import org.hibernate.envers.query.AuditQuery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
public class AuditService {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public Page<AuditEntryDTO> search(AuditSearchRequest request) {
        Optional<AuditableEntity> auditableEntity = AuditableEntity.fromKey(request.getEntityKey());
        if (auditableEntity.isEmpty()) {
            return Page.empty();
        }

        AuditableEntity entityDefinition = auditableEntity.get();
        Class<?> entityClass = entityDefinition.getEntityClass();
        int page = request.getPage() != null ? request.getPage() : 0;
        int rows = request.getRows() != null ? request.getRows() : 50;

        AuditQuery countQuery = buildQuery(entityClass, request);
        countQuery.addProjection(AuditEntity.revisionNumber().count());
        long total = (long) countQuery.getSingleResult();

        AuditQuery dataQuery = buildQuery(entityClass, request);
        dataQuery.addOrder(AuditEntity.revisionNumber().desc());
        dataQuery.setFirstResult(page * rows);
        dataQuery.setMaxResults(rows);

        List<Object[]> results = dataQuery.getResultList();

        List<AuditEntryDTO> content = results.stream()
                .map(result -> toDto(entityDefinition, result))
                .toList();

        return new PageImpl<>(content, PageRequest.of(page, rows), total);
    }

    public List<AuditEntityOptionDTO> listAuditableEntities() {
        return java.util.Arrays.stream(AuditableEntity.values())
                .map(entity -> new AuditEntityOptionDTO(entity.name(), entity.getLabel()))
                .toList();
    }

    /**
     * Compares the entity snapshot at the given revision against its immediately preceding
     * revision and returns only the fields whose formatted value differs between the two.
     */
    @Transactional(readOnly = true)
    public List<AuditFieldChangeDTO> getChanges(String entityKey, Long entityId, Integer revisionId) {
        Optional<AuditableEntity> auditableEntity = AuditableEntity.fromKey(entityKey);
        if (auditableEntity.isEmpty()) {
            return List.of();
        }

        Class<?> entityClass = auditableEntity.get().getEntityClass();

        List<Object[]> revisions = AuditReaderFactory.get(entityManager)
                .createQuery()
                .forRevisionsOfEntity(entityClass, false, true)
                .add(AuditEntity.id().eq(entityId))
                .addOrder(AuditEntity.revisionNumber().asc())
                .getResultList();

        Object current = null;
        Object previous = null;
        for (int i = 0; i < revisions.size(); i++) {
            CustomRevisionEntity revision = (CustomRevisionEntity) revisions.get(i)[1];
            if (revision.getId() == revisionId) {
                current = revisions.get(i)[0];
                previous = i > 0 ? revisions.get(i - 1)[0] : null;
                break;
            }
        }

        if (current == null && previous == null) {
            return List.of();
        }

        return diff(entityClass, previous, current);
    }

    private List<AuditFieldChangeDTO> diff(Class<?> entityClass, Object before, Object after) {
        List<AuditFieldChangeDTO> changes = new ArrayList<>();
        for (Field field : comparableFields(entityClass)) {
            field.setAccessible(true);
            String oldValue = formatFieldValue(field, readField(field, before));
            String newValue = formatFieldValue(field, readField(field, after));
            if (!Objects.equals(oldValue, newValue)) {
                changes.add(AuditFieldChangeDTO.builder()
                        .field(field.getName())
                        .oldValue(oldValue)
                        .newValue(newValue)
                        .build());
            }
        }
        return changes;
    }

    private List<Field> comparableFields(Class<?> entityClass) {
        List<Field> fields = new ArrayList<>();
        for (Class<?> type = entityClass; type != null && type != Object.class; type = type.getSuperclass()) {
            for (Field field : type.getDeclaredFields()) {
                int modifiers = field.getModifiers();
                if (Modifier.isStatic(modifiers) || field.isSynthetic() || "id".equals(field.getName())) {
                    continue;
                }
                if (field.isAnnotationPresent(AuditRedacted.class)) {
                    continue;
                }
                Class<?> fieldType = field.getType();
                if (Collection.class.isAssignableFrom(fieldType) || Map.class.isAssignableFrom(fieldType)) {
                    continue;
                }
                fields.add(field);
            }
        }
        return fields;
    }

    private Object readField(Field field, Object entity) {
        if (entity == null) {
            return null;
        }
        try {
            return field.get(entity);
        } catch (IllegalAccessException e) {
            return null;
        }
    }

    private String formatFieldValue(Field field, Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Identifiable<?> identifiable) {
            return field.getType().getSimpleName() + " #" + identifiable.getId();
        }
        if (value instanceof Enum<?> enumValue) {
            return enumValue.name();
        }
        return String.valueOf(value);
    }

    private AuditQuery buildQuery(Class<?> entityClass, AuditSearchRequest request) {
        AuditQuery query = AuditReaderFactory.get(entityManager)
                .createQuery()
                .forRevisionsOfEntity(entityClass, false, true);

        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            query.add(AuditEntity.revisionProperty("username").like("%" + request.getUsername() + "%"));
        }
        if (request.getRevisionType() != null && !request.getRevisionType().isBlank()) {
            query.add(AuditEntity.revisionType().eq(RevisionType.valueOf(request.getRevisionType())));
        }
        if (request.getDateFrom() != null) {
            query.add(AuditEntity.revisionProperty("timestamp").ge(toEpochMillis(request.getDateFrom())));
        }
        if (request.getDateTo() != null) {
            query.add(AuditEntity.revisionProperty("timestamp").le(toEpochMillis(request.getDateTo())));
        }
        return query;
    }

    private AuditEntryDTO toDto(AuditableEntity entityDefinition, Object[] result) {
        Object entity = result[0];
        CustomRevisionEntity revision = (CustomRevisionEntity) result[1];
        RevisionType revisionType = (RevisionType) result[2];
        Long entityId = extractId(entity);

        return AuditEntryDTO.builder()
                .revisionId(revision.getId())
                .revisionDate(toLocalDateTime(revision.getTimestamp()))
                .username(revision.getUsername())
                .revisionType(revisionType.name())
                .entityKey(entityDefinition.name())
                .entityName(entityDefinition.getLabel())
                .entityId(entityId)
                .description(entityDefinition.getLabel() + " #" + (entityId != null ? entityId : "?"))
                .build();
    }

    private Long extractId(Object entity) {
        if (entity == null) {
            return null;
        }
        try {
            Object id = entity.getClass().getMethod("getId").invoke(entity);
            return id instanceof Long longId ? longId : null;
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }

    private long toEpochMillis(LocalDateTime dateTime) {
        return dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    private LocalDateTime toLocalDateTime(long epochMillis) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneId.systemDefault());
    }
}
