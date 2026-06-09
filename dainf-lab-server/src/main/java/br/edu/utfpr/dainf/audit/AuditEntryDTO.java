package br.edu.utfpr.dainf.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@AllArgsConstructor
public class AuditEntryDTO {
    private Integer revisionId;
    private LocalDateTime revisionDate;
    private String username;
    private String revisionType;
    private String entityKey;
    private String entityName;
    private Long entityId;
    private String description;
}
