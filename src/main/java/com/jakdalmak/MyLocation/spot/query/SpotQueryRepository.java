package com.jakdalmak.MyLocation.spot.query;

import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpotQueryRepository extends JpaRepository<Spot, Long> {

    /**
     * 바운딩 박스(사각형) 안에 포함되는 스팟들만 조회합니다.
     * - 실제 원(반경) 필터링은 Service 레이어에서 수행합니다.
     */
    @Query("""
        SELECT s
        FROM Spot s
        WHERE s.lat BETWEEN :minLat AND :maxLat
          AND s.lon BETWEEN :minLng AND :maxLng
        """)
    List<Spot> findInBoundingBox(
            @Param("minLat") double minLat,
            @Param("maxLat") double maxLat,
            @Param("minLng") double minLng,
            @Param("maxLng") double maxLng
    );

}
