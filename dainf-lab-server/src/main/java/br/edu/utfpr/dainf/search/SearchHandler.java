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
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

public class SearchHandler<ID extends Serializable, E extends Identifiable<ID>> {

    final SearchFilterAdapter searchFilterAdapter = new SearchFilterAdapter();
    final JpaSpecificationExecutor<E> executor;
    final Function<SearchFilter, Specification<E>> customSpecificationFactory;

    public SearchHandler(JpaSpecificationExecutor<E> executor) {
        this(executor, filter -> null);
    }

    public SearchHandler(JpaSpecificationExecutor<E> executor,
                         Function<SearchFilter, Specification<E>> customSpecificationFactory) {
        Objects.requireNonNull(executor, "A JpaSpecificationExecutor must be provided");
        this.executor = executor;
        this.customSpecificationFactory = customSpecificationFactory;
    }

    public static Pageable getPageable(SearchRequest searchRequest) {
        return PageRequest.of(searchRequest.getPage(), searchRequest.getRows(), SearchSortAdapter.adapt(searchRequest.getSort()));
    }

    public Page<E> handle(SearchRequest searchRequest) {
        return handle(searchRequest, null);
    }

    public Page<E> handle(SearchRequest searchRequest, Specification<E> extraSpecification) {
        List<Specification<E>> specifications = createSpecifications(searchRequest.getFilters());
        if (extraSpecification != null) specifications.add(extraSpecification);
        Pageable pageable = getPageable(searchRequest);
        return executor.findAll(
                Specification.allOf(specifications),
                pageable
        );
    }

    List<Specification<E>> createSpecifications(List<SearchFilter> filters) {
        if (filters == null) return new java.util.ArrayList<>();
        return filters.stream()
                .map(this::buildSpecification)
                .collect(Collectors.toList());
    }

    Specification<E> buildSpecification(SearchFilter filter) {
        Specification<E> customSpecification = customSpecificationFactory.apply(filter);
        if (customSpecification != null) return customSpecification;
        return (root, query, criteriaBuilder) -> searchFilterAdapter.adapt(filter, root, query, criteriaBuilder);
    }
}
