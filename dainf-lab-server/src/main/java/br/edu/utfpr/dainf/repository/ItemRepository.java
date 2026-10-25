package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.ItemSpecExecutor;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.Optional;

public interface ItemRepository extends CrudRepository<Long, Item>, ItemSpecExecutor {
    @Override
    @EntityGraph(attributePaths = "groups")
    Optional<Item> findById(Long id);
}
