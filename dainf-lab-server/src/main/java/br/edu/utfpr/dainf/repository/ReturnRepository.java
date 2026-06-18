package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.model.Return;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.ReturnSpecExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface ReturnRepository extends CrudRepository<Long, Return>, ReturnSpecExecutor {
    Return findByLoanId(Long loanId);

    @Query("SELECT COALESCE(SUM(ri.quantityReturned), 0) FROM ReturnItem ri WHERE ri.aReturn.loan.id = :loanId")
    BigDecimal sumQuantityReturnedByLoan(@Param("loanId") Long loanId);

    @Query("SELECT COALESCE(SUM(ri.quantityIssued), 0) FROM ReturnItem ri WHERE ri.aReturn.loan.id = :loanId")
    BigDecimal sumQuantityIssuedByLoan(@Param("loanId") Long loanId);

    @Query(value = """
        SELECT
          COUNT(*) FILTER (WHERE r.return_date <= l.deadline) AS onTimeCount,
          COUNT(*) FILTER (WHERE r.return_date > l.deadline) AS overdueCount
        FROM return r
        JOIN loan l ON r.loan_id = l.id
        WHERE r.return_date BETWEEN :startDate AND :endDate
        """, nativeQuery = true)
    br.edu.utfpr.dainf.dto.ReturnRateSummary getReturnRateSummary(
            @Param("startDate") java.time.LocalDate startDate,
            @Param("endDate") java.time.LocalDate endDate
    );
}
