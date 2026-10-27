package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.GroupDTO;
import br.edu.utfpr.dainf.dto.UserDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.GroupRepository;
import br.edu.utfpr.dainf.service.GroupService;
import br.edu.utfpr.dainf.shared.CrudController;
import jakarta.annotation.security.RolesAllowed;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("groups")
@RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN})
public class GroupController extends CrudController<Long, Group, GroupDTO, GroupRepository, GroupService> {

    public GroupController() {
        super(Group.class, GroupDTO.class);
    }

    @GetMapping("/{id}/users")
    public ResponseEntity<List<UserDTO>> findUsers(@PathVariable Long id) {
        return ResponseEntity.ok(toUserDtos(service.findUsers(id)));
    }

    @PutMapping("/{id}/users")
    public ResponseEntity<List<UserDTO>> replaceUsers(@PathVariable Long id, @RequestBody List<Long> userIds) {
        Set<Long> ids = new HashSet<>(userIds);
        return ResponseEntity.ok(toUserDtos(service.replaceUsers(id, ids)));
    }

    private List<UserDTO> toUserDtos(List<User> users) {
        return users.stream()
                .map(u -> UserDTO.builder()
                        .id(u.getId())
                        .nome(u.getNome())
                        .email(u.getEmail())
                        .documento(u.getDocumento())
                        .role(u.getRole())
                        .enabled(u.isEnabled())
                        .build())
                .toList();
    }
}
