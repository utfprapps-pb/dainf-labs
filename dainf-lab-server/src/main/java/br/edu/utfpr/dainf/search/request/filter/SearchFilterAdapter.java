package br.edu.utfpr.dainf.search.request.filter;

import br.edu.utfpr.dainf.exception.WarnException;
import jakarta.persistence.criteria.*;
import org.hibernate.query.sqm.PathElementException;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;

import java.time.Instant;
import java.util.List;

@SuppressWarnings({"unchecked", "rawtypes"})
public class SearchFilterAdapter implements Specification {

    private SearchFilter filter;

    public Predicate adapt(SearchFilter filter, Root root, CriteriaQuery query, CriteriaBuilder criteriaBuilder) {
        query.distinct(true);
        this.filter = filter;
        return toPredicate(root, query, criteriaBuilder);
    }

    @Override
    @Nullable
    public Predicate toPredicate(Root root, @Nullable CriteriaQuery query, CriteriaBuilder cb) {
        Expression field = getNestedField(root, filter.getField());
        Object value = convertValue(field, filter.getValue());
        return switch (filter.getType()) {
            case EQUALS -> cb.equal(field, value);
            case NOT_EQUALS -> cb.notEqual(field, value);
            case LIKE -> cb.like(field, "%" + value + "%");
            case ILIKE -> cb.like(cb.upper(field), "%" + ((String) value).toUpperCase() + "%");
            case NOT_LIKE -> cb.notLike(field, "%" + value + "%");
            case GREATER -> cb.greaterThan(field, value.toString());
            case LESS -> cb.lessThan(field, value.toString());
            case GREATER_EQUALS -> cb.greaterThanOrEqualTo(field, value.toString());
            case LESS_EQUALS -> cb.lessThanOrEqualTo(field, value.toString());
            case IN -> field.in((List<?>) value);
            case NOT_IN -> cb.not(field.in((List<?>) value));
            case IS_NULL -> cb.isNull(field);
            case IS_NOT_NULL -> cb.isNotNull(field);
            case BETWEEN -> {
                List<?> rawValues = (List<?>) filter.getValue();
                yield cb.between(
                        field,
                        (Comparable<Object>) convertValue(field, rawValues.get(0)),
                        (Comparable<Object>) convertValue(field, rawValues.get(1))
                );
            }
        };
    }

    @SuppressWarnings("unchecked")
    private Object convertValue(Expression<?> fieldExpression, Object value) {
        if (value == null) return null;
        Class<?> javaType = fieldExpression.getJavaType();
        if (javaType != null && javaType.isEnum() && value instanceof String strValue) {
            return Enum.valueOf((Class<Enum>) javaType, strValue);
        }
        if (Instant.class.equals(javaType) && value instanceof String strValue) {
            return Instant.parse(strValue);
        }
        return value;
    }


    Expression<?> getNestedField(Root<?> root, String fieldPath) {
        String[] path = fieldPath.split("\\.");
        Path<?> currentPath = root;

        for (String segment : path) {
            try {
                currentPath = currentPath.get(segment);
            } catch (PathElementException e) {
                throw new WarnException("Invalid field path", e);
            }
        }

        return currentPath;
    }
}