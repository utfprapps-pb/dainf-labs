package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.repository.GroupRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

@Service
public class GroupService extends CrudService<Long, Group, GroupRepository> {

    @Override
    public JpaSpecificationExecutor<Group> getSpecExecutor() {
        return repository;
    }
}
