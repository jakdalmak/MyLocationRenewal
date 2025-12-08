package com.jakdalmak.MyLocation.spot;

import com.jakdalmak.MyLocation.spot.command.application.domain.SpotType;
import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpotCommandRepository extends JpaRepository<Spot, Long> {

    // 같은 이름 + 같은 좌표 + GOVERNMENT 인 스팟이 이미 있으면 중복 삽입 방지용
    boolean existsByNameAndLatAndLonAndType(String name, Double lat, Double lon, SpotType type);
}
