package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.GroupRepository;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class GroupService extends CrudService<Long, Group, GroupRepository> {

    @Autowired
    private UserRepository userRepository;

    @Override
    public JpaSpecificationExecutor<Group> getSpecExecutor() {
        return repository;
    }

    @Transactional(readOnly = true)
    public List<User> findUsers(Long groupId) {
        return userRepository.findAllByGroups_Id(groupId);
    }

    @Transactional
    public List<User> replaceUsers(Long groupId, Set<Long> userIds) {
        Group group = repository.findById(groupId)
                .orElseThrow(() -> new WarnException("Grupo não encontrado."));

        Set<Long> targetIds = new HashSet<>(userIds);
        List<User> targets = userRepository.findAllById(targetIds);
        if (targets.size() != targetIds.size()) {
            throw new WarnException("Um ou mais usuários informados não foram encontrados.");
        }

        for (User member : userRepository.findAllByGroups_Id(groupId)) {
            if (!targetIds.contains(member.getId())) {
                member.getGroups().removeIf(g -> g.getId().equals(groupId));
                userRepository.save(member);
            }
        }
        for (User user : targets) {
            if (user.getGroups().stream().noneMatch(g -> g.getId().equals(groupId))) {
                user.getGroups().add(group);
                userRepository.save(user);
            }
        }
        return userRepository.findAllByGroups_Id(groupId);
    }
}
