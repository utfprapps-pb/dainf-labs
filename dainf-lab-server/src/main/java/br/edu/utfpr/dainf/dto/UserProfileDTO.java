package br.edu.utfpr.dainf.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Dados que o próprio usuário pode alterar no seu cadastro.
 * E-mail, perfil (role) e status não são alteráveis por aqui.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserProfileDTO {

    @NotBlank(message = "O nome é obrigatório.")
    @Size(max = 255, message = "O nome não pode exceder 255 caracteres.")
    private String nome;

    @Size(max = 25, message = "O RA/Siape não pode exceder 25 caracteres.")
    private String documento;

    @NotBlank(message = "O telefone é obrigatório.")
    @Size(max = 15, message = "O telefone não pode exceder 15 caracteres.")
    private String telefone;

    /** Obrigatória apenas quando {@code newPassword} é informada. */
    private String currentPassword;

    @Pattern(
            regexp = "^(|(?=.{6,100}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*)$",
            message = "A nova senha deve ter entre 6 e 100 caracteres e conter pelo menos uma letra minúscula, uma letra maiúscula e um número."
    )
    private String newPassword;
}
