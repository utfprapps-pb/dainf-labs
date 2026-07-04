package br.edu.utfpr.dainf.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class AssetDTO {
    private Long id;

    @Size(max = 255, message = "O campo 'Localização' deve ter no máximo 255 caracteres")
    private String location;

    @Size(max = 255, message = "O campo 'Patrimônio' deve ter no máximo 255 caracteres")
    private String serialNumber;
}
