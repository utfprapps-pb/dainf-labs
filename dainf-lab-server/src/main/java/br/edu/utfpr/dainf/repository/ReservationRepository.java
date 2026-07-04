package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.model.Reservation;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.ReservationSpecExecutor;

import java.util.List;
import br.edu.utfpr.dainf.model.User;

public interface ReservationRepository extends CrudRepository<Long, Reservation>, ReservationSpecExecutor {
    List<Reservation> findByUserAndStatusIn(User user, List<String> statuses);
}
