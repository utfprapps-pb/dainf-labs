package br.edu.utfpr.dainf.repository;


import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.UserSpecExecutor;

import java.util.List;
import java.util.Optional;
import br.edu.utfpr.dainf.enums.UserRole;

public interface UserRepository extends CrudRepository<Long, User>, UserSpecExecutor {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailVerificationToken(String token);
    Optional<User> findByClearanceCode(String clearanceCode);
    List<User> findByRoleIn(List<UserRole> roles);
}
