package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.model.Notification;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.NotificationRepository;
import br.edu.utfpr.dainf.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import br.edu.utfpr.dainf.service.UserService;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserService userService;

    @GetMapping
    public ResponseEntity<Page<Notification>> getNotifications(
            @RequestParam(required = false, defaultValue = "false") boolean unreadOnly,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC) Pageable pageable) {
        User user = userService.getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        
        if (unreadOnly) {
            return ResponseEntity.ok(notificationService.getUnreadUserNotifications(user.getId(), pageable));
        }
        return ResponseEntity.ok(notificationService.getUserNotifications(user.getId(), pageable));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount() {
        User user = userService.getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(notificationService.countUnread(user.getId()));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id) {
        User user = userService.getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        notificationService.markAsRead(id, user.getId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead() {
        User user = userService.getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        notificationService.markAllAsRead(user.getId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/test-count/{userId}")
    public ResponseEntity<Long> testCount(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationRepository.countByUserIdAndIsReadFalse(userId));
    }

    @GetMapping("/test-list/{userId}")
    public ResponseEntity<Page<Notification>> testList(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationRepository.findByUserIdAndIsReadFalse(userId, org.springframework.data.domain.PageRequest.of(0, 10)));
    }

    @GetMapping("/debug-all")
    public ResponseEntity<java.util.List<Notification>> debugAll() {
        return ResponseEntity.ok(notificationRepository.findAll());
    }

    @GetMapping("/debug-res/{id}")
    public ResponseEntity<br.edu.utfpr.dainf.model.Reservation> debugRes(@PathVariable Long id, @Autowired br.edu.utfpr.dainf.repository.ReservationRepository repo) {
        return ResponseEntity.ok(repo.findById(id).orElse(null));
    }
}
