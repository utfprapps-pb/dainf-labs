package br.edu.utfpr.dainf.repository;


import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.UserSpecExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends CrudRepository<Long, User>, UserSpecExecutor {

    /**
     * Busca case-insensitive e ignorando espaços nas pontas, alinhada ao índice único
     * {@code ux_app_user_email_lower} (lower(trim(email))).
     */
    @EntityGraph(attributePaths = "groups")
    @Query("select u from User u where lower(trim(u.email)) = lower(trim(:email))")
    Optional<User> findByEmail(@Param("email") String email);

    @Query("select count(u) > 0 from User u where lower(trim(u.email)) = lower(trim(:email))")
    boolean existsByEmailNormalized(@Param("email") String email);

    @Query("select count(u) > 0 from User u where lower(trim(u.email)) = lower(trim(:email)) and u.id <> :id")
    boolean existsByEmailNormalizedAndIdNot(@Param("email") String email, @Param("id") Long id);

    @Query("select count(u) > 0 from User u where trim(u.documento) = trim(:documento)")
    boolean existsByDocumentoNormalized(@Param("documento") String documento);

    @Query("select count(u) > 0 from User u where trim(u.documento) = trim(:documento) and u.id <> :id")
    boolean existsByDocumentoNormalizedAndIdNot(@Param("documento") String documento, @Param("id") Long id);

    Optional<User> findByEmailVerificationToken(String token);
    Optional<User> findByClearanceCode(String clearanceCode);

    @EntityGraph(attributePaths = "groups")
    List<User> findAllByGroups_Id(Long groupId);
}
