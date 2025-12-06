package com.jakdalmak.MyLocation.spot;

import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpotCommandRepository extends JpaRepository<Spot, Long> {
}
