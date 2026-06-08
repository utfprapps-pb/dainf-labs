package br.edu.utfpr.dainf.audit;

import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Builder
@lombok.AllArgsConstructor
public class AuditSearchRequest {
    private String entityKey;
    private String username;
    private String revisionType;
    private LocalDateTime dateFrom;
    private LocalDateTime dateTo;

    @Builder.Default
    private Integer page = 0;

    @Builder.Default
    private Integer rows = 50;
}
