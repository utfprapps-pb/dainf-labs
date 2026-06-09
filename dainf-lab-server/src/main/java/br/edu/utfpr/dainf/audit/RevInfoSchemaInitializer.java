package br.edu.utfpr.dainf.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Ensures revinfo.timestamp exists before Hibernate tries to INSERT into it.
 * ddl-auto:update does not reliably add inherited columns to an existing revinfo table,
 * and create-drop can fail to drop revinfo first if _aud FK constraints exist in the DB
 * from a previous unclean shutdown.
 */
@Component
public class RevInfoSchemaInitializer {

    private static final Logger log = LoggerFactory.getLogger(RevInfoSchemaInitializer.class);

    public RevInfoSchemaInitializer(DataSource dataSource) {
        try (var conn = dataSource.getConnection();
             var stmt = conn.createStatement()) {
            stmt.execute("""
                    ALTER TABLE revinfo
                    ADD COLUMN IF NOT EXISTS timestamp BIGINT DEFAULT 0 NOT NULL
                    """);
            log.debug("revinfo.timestamp column ensured");
        } catch (Exception e) {
            // Ignored: table does not exist yet on a fresh start; Hibernate will create it
            // correctly (with all columns) during DDL initialization.
            log.trace("revinfo not yet present, skipping column check: {}", e.getMessage());
        }
    }
}
