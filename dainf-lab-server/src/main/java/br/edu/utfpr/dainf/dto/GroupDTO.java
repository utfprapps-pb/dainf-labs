package br.edu.utfpr.dainf.dto;

import br.edu.utfpr.dainf.shared.Identifiable;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupDTO implements Identifiable<Long> {

    private Long id;

    @NotBlank(message = "O nome do grupo é obrigatório.")
    private String name;

    private String description;

    @Builder.Default
    private Boolean active = true;

    public Boolean getActive() {
        return !Boolean.FALSE.equals(active);
    }
}
