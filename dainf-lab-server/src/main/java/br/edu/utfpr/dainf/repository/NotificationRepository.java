package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByUserId(Long userId, Pageable pageable);
    Page<Notification> findByUserIdAndIsReadFalse(Long userId, Pageable pageable);
    long countByUserIdAndIsReadFalse(Long userId);
}
