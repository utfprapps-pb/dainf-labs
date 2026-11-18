package br.edu.utfpr.dainf.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Cria os índices únicos de {@code app_user} que o {@code ddl-auto: update} do Hibernate não
 * consegue gerar (índices funcionais/parciais). São eles que impedem cadastros duplicados mesmo
 * quando duas requisições chegam simultaneamente.
 * <p>
 * Se já houver duplicados no banco, a criação falha: o erro é registrado no log (a aplicação
 * continua subindo) e o índice é criado automaticamente no próximo start após a limpeza.
 */
@Component
public class UserUniqueIndexInitializer implements ApplicationRunner {

    public static final String EMAIL_INDEX = "ux_app_user_email_lower";
    public static final String DOCUMENTO_INDEX = "ux_app_user_documento";

    private static final Logger LOGGER = LoggerFactory.getLogger(UserUniqueIndexInitializer.class);

    private static final Map<String, String> INDEXES = new LinkedHashMap<>();

    static {
        INDEXES.put(EMAIL_INDEX,
                "CREATE UNIQUE INDEX IF NOT EXISTS " + EMAIL_INDEX
                        + " ON app_user (lower(trim(email)))");
        INDEXES.put(DOCUMENTO_INDEX,
                "CREATE UNIQUE INDEX IF NOT EXISTS " + DOCUMENTO_INDEX
                        + " ON app_user (trim(documento))"
                        + " WHERE documento IS NOT NULL AND trim(documento) <> ''");
    }

    private final JdbcTemplate jdbcTemplate;

    public UserUniqueIndexInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        INDEXES.forEach((name, ddl) -> {
            try {
                jdbcTemplate.execute(ddl);
                LOGGER.info("Índice único {} verificado/criado em app_user", name);
            } catch (Exception e) {
                LOGGER.error("Não foi possível criar o índice único {} em app_user. "
                        + "Provavelmente existem cadastros duplicados; remova/mescle os duplicados "
                        + "e reinicie a aplicação. Causa: {}", name, e.getMessage());
            }
        });
    }
}
