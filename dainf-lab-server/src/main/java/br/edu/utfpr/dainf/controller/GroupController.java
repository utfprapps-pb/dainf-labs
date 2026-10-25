package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.GroupDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.repository.GroupRepository;
import br.edu.utfpr.dainf.service.GroupService;
import br.edu.utfpr.dainf.shared.CrudController;
import jakarta.annotation.security.RolesAllowed;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("groups")
@RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN})
public class GroupController extends CrudController<Long, Group, GroupDTO, GroupRepository, GroupService> {

    public GroupController() {
        super(Group.class, GroupDTO.class);
    }
}
