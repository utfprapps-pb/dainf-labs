package br.edu.utfpr.dainf.shared;

import br.edu.utfpr.dainf.mail.Mail;
import br.edu.utfpr.dainf.mail.MailService;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.Map;

@TestConfiguration
public class TestConfig {

    @Bean
    @Primary
    public MailService mailService() {
        return new MailService() {
            @Override
            public void send(Mail mail) {
            }

            @Override
            public String buildTemplate(String templateName, Map<String, Object> variables) {
                return "";
            }
        };
    }
}
