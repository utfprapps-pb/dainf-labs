package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.shared.CrudRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface GroupRepository extends CrudRepository<Long, Group>, JpaSpecificationExecutor<Group> {
}
