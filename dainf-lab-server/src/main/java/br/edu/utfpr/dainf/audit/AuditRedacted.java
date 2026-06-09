package br.edu.utfpr.dainf.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a field that must never be exposed through the audit log (passwords, tokens,
 * recovery codes, etc). {@link AuditService} excludes annotated fields entirely from
 * change comparisons, regardless of whether their value actually changed.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface AuditRedacted {
}
