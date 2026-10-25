package br.edu.utfpr.dainf.repository;


import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.UserSpecExecutor;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.Optional;

public interface UserRepository extends CrudRepository<Long, User>, UserSpecExecutor {
    @EntityGraph(attributePaths = "groups")
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailVerificationToken(String token);
    Optional<User> findByClearanceCode(String clearanceCode);
}
