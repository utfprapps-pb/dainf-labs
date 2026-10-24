package br.edu.utfpr.dainf.search;

import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.search.request.filter.SearchFilterAdapter;
import br.edu.utfpr.dainf.search.request.sort.SearchSortAdapter;
import br.edu.utfpr.dainf.shared.Identifiable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.io.Serializable;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

public class SearchHandler<ID extends Serializable, E extends Identifiable<ID>> {

    final SearchFilterAdapter searchFilterAdapter = new SearchFilterAdapter();
    final JpaSpecificationExecutor<E> executor;

    public SearchHandler(JpaSpecificationExecutor<E> executor) {
        Objects.requireNonNull(executor, "A JpaSpecificationExecutor must be provided");
        this.executor = executor;
    }

    public static Pageable getPageable(SearchRequest searchRequest) {
        return PageRequest.of(searchRequest.getPage(), searchRequest.getRows(), SearchSortAdapter.adapt(searchRequest.getSort()));
    }

    public Page<E> handle(SearchRequest searchRequest) {
        return handle(searchRequest, null, Collections.emptyMap());
    }

    public Page<E> handle(SearchRequest searchRequest, Specification<E> additionalSpecification) {
        return handle(searchRequest, additionalSpecification, Collections.emptyMap());
    }

    public Page<E> handle(
            SearchRequest searchRequest,
            Specification<E> additionalSpecification,
            Map<String, Function<SearchFilter, Specification<E>>> customFilters
    ) {
        List<Specification<E>> specifications = createSpecifications(searchRequest.getFilters(), customFilters);
        Pageable pageable = getPageable(searchRequest);
        Specification<E> specification = Specification.allOf(specifications);
        if (additionalSpecification != null) {
            specification = specification.and(additionalSpecification);
        }
        return executor.findAll(
                specification,
                pageable
        );
    }

    List<Specification<E>> createSpecifications(List<SearchFilter> filters) {
        return createSpecifications(filters, Collections.emptyMap());
    }

    List<Specification<E>> createSpecifications(
            List<SearchFilter> filters,
            Map<String, Function<SearchFilter, Specification<E>>> customFilters
    ) {
        if (filters == null) {
            return Collections.emptyList();
        }
        return filters.stream()
                .map(filter -> buildSpecification(filter, customFilters))
                .collect(Collectors.toList());
    }

    Specification<E> buildSpecification(
            SearchFilter filter,
            Map<String, Function<SearchFilter, Specification<E>>> customFilters
    ) {
        Function<SearchFilter, Specification<E>> customFilter = customFilters.get(filter.getField());
        return customFilter == null ? buildSpecification(filter) : customFilter.apply(filter);
    }

    Specification<E> buildSpecification(SearchFilter filter) {
        return (root, query, criteriaBuilder) -> searchFilterAdapter.adapt(filter, root, query, criteriaBuilder);
    }
}
