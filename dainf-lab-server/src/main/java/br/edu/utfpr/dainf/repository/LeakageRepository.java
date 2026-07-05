package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.model.Leakage;
import br.edu.utfpr.dainf.model.Loan;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.LeakageSpecExecutor;

import java.util.Optional;

public interface LeakageRepository extends CrudRepository<Long, Leakage>, LeakageSpecExecutor {
    Optional<Leakage> findByLoan(Loan loan);
}
