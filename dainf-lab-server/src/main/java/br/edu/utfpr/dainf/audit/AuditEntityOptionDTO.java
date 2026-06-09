package br.edu.utfpr.dainf.audit;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AuditEntityOptionDTO {
    private String key;
    private String label;
}
