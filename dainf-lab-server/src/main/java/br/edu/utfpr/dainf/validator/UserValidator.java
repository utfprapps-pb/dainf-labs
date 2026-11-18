package br.edu.utfpr.dainf.validator;

import br.edu.utfpr.dainf.dto.UserDTO;
import br.edu.utfpr.dainf.dto.UserSignupDTO;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.UserRepository;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Validação amigável de unicidade (e-mail e RA/SIAPE). A garantia real contra duplicidade
 * (inclusive em requisições concorrentes) são os índices únicos criados por
 * {@link br.edu.utfpr.dainf.config.UserUniqueIndexInitializer}.
 */
public class UserValidator implements ConstraintValidator<ValidUser, Object> {

    @Autowired
    private UserRepository repository;

    @Override
    public boolean isValid(Object entity, ConstraintValidatorContext context) {
        return switch (entity) {
            case UserDTO dto -> validateUnique(dto.getId(), dto.getEmail(), dto.getDocumento(), context);
            case UserSignupDTO dto -> validateUnique(null, dto.getEmail(), dto.getDocumento(), context);
            case null, default -> true;
        };
    }

    private boolean validateUnique(Long id, String email, String documento, ConstraintValidatorContext context) {
        boolean emailValid = validateUniqueEmail(id, email, context);
        boolean documentoValid = validateUniqueDocumento(id, documento, context);
        return emailValid && documentoValid;
    }

    boolean validateUniqueEmail(Long id, String email, ConstraintValidatorContext context) {
        String normalized = User.normalizeEmail(email);
        if (normalized == null) {
            return true;
        }

        boolean exists = id == null
                ? repository.existsByEmailNormalized(normalized)
                : repository.existsByEmailNormalizedAndIdNot(normalized, id);

        if (exists) {
            handleMessage(context, "O e-mail informado já está em uso", "email");
        }
        return !exists;
    }

    boolean validateUniqueDocumento(Long id, String documento, ConstraintValidatorContext context) {
        String normalized = User.normalizeDocumento(documento);
        if (normalized == null) {
            return true;
        }

        boolean exists = id == null
                ? repository.existsByDocumentoNormalized(normalized)
                : repository.existsByDocumentoNormalizedAndIdNot(normalized, id);

        if (exists) {
            handleMessage(context, "O RA/SIAPE informado já está cadastrado", "documento");
        }
        return !exists;
    }

    public void handleMessage(ConstraintValidatorContext context, String message, String node) {
        context.buildConstraintViolationWithTemplate(message)
                .addPropertyNode(node)
                .addConstraintViolation()
                .disableDefaultConstraintViolation();
    }
}
