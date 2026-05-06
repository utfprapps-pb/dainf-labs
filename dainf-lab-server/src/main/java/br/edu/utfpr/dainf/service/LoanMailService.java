package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.mail.Mail;
import br.edu.utfpr.dainf.mail.MailService;
import br.edu.utfpr.dainf.model.Loan;
import br.edu.utfpr.dainf.repository.LoanRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class LoanMailService {

    private static final ZoneId BRAZIL_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(BRAZIL_ZONE);

    private final MailService mailService;
    private final LoanRepository loanRepository;

    public LoanMailService(MailService mailService, LoanRepository loanRepository) {
        this.mailService = mailService;
        this.loanRepository = loanRepository;
    }

    @Async
    @Transactional(readOnly = true)
    public void sendLoanCreated(Long loanId) {
        Loan loan = loanRepository.findById(loanId).orElse(null);
        if (loan == null) return;
        String email = borrowerEmail(loan);
        if (email == null) return;

        try {
            String content = mailService.buildTemplate("loan-created", Map.of(
                    "borrowerName", loan.getBorrower().getNome(),
                    "loanDate", DATE_FORMATTER.format(loan.getLoanDate()),
                    "deadline", loan.getDeadline() != null ? DATE_FORMATTER.format(loan.getDeadline()) : "Sem prazo definido",
                    "items", loan.getItems() != null ? loan.getItems() : List.of()
            ));
            mailService.send(Mail.builder()
                    .to(List.of(email))
                    .subject("Novo empréstimo registrado")
                    .content(content)
                    .build());
        } catch (Exception e) {
            log.error("Falha ao enviar e-mail de novo empréstimo para {}: {}", email, e.getMessage());
        }
    }

    @Async
    @Transactional(readOnly = true)
    public void sendLoanCompleted(Long loanId) {
        Loan loan = loanRepository.findById(loanId).orElse(null);
        if (loan == null) return;
        String email = borrowerEmail(loan);
        if (email == null) return;

        try {
            String content = mailService.buildTemplate("loan-completed", Map.of(
                    "borrowerName", loan.getBorrower().getNome(),
                    "loanDate", DATE_FORMATTER.format(loan.getLoanDate()),
                    "items", loan.getItems() != null ? loan.getItems() : List.of()
            ));
            mailService.send(Mail.builder()
                    .to(List.of(email))
                    .subject("Empréstimo concluído")
                    .content(content)
                    .build());
        } catch (Exception e) {
            log.error("Falha ao enviar e-mail de empréstimo concluído para {}: {}", email, e.getMessage());
        }
    }

    @Async
    @Transactional(readOnly = true)
    public void sendLoanOverdue(Long loanId) {
        Loan loan = loanRepository.findById(loanId).orElse(null);
        if (loan == null) return;
        String email = borrowerEmail(loan);
        if (email == null) return;

        try {
            String content = mailService.buildTemplate("loan-overdue", Map.of(
                    "borrowerName", loan.getBorrower().getNome(),
                    "deadline", loan.getDeadline() != null ? DATE_FORMATTER.format(loan.getDeadline()) : "Sem prazo definido",
                    "items", loan.getItems() != null ? loan.getItems() : List.of()
            ));
            mailService.send(Mail.builder()
                    .to(List.of(email))
                    .subject("Empréstimo em atraso")
                    .content(content)
                    .build());
        } catch (Exception e) {
            log.error("Falha ao enviar e-mail de empréstimo em atraso para {}: {}", email, e.getMessage());
        }
    }

    private String borrowerEmail(Loan loan) {
        if (loan.getBorrower() == null) return null;
        String email = loan.getBorrower().getEmail();
        return (email != null && !email.isBlank()) ? email : null;
    }
}
