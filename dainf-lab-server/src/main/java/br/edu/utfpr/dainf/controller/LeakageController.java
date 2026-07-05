package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.LeakageDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Leakage;
import br.edu.utfpr.dainf.repository.LeakageRepository;
import br.edu.utfpr.dainf.service.LeakageService;
import br.edu.utfpr.dainf.shared.CrudController;
import jakarta.annotation.security.RolesAllowed;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("leakages")
@RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN})
public class LeakageController extends CrudController<Long, Leakage, LeakageDTO, LeakageRepository, LeakageService> {
    public LeakageController() {
        super(Leakage.class, LeakageDTO.class);
    }
}
