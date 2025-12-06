package com.jakdalmak.MyLocation.spot.query;

import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SpotQueryService {
    // 지구 반지름 (미터)
    private static final double EARTH_RADIUS_M = 6371_000.0;

    // 서비스 정책상 허용할 최대 반경 (예: 800m)
    private static final double MAX_RADIUS_M = 800.0;

    private final SpotQueryRepository spotRepository;

    /**
     * 기준 위/경도와 반경(미터)을 받아,
     * 1) 바운딩 박스 안의 후보 스팟들을 DB에서 조회하고
     * 2) 서버에서 하버사인으로 "진짜 원 범위"만 필터링해서 반환합니다.
     */
    public List<Spot> findSpotsWithinRadius(double centerLat,
                                            double centerLng,
                                            double radiusMeters) {

        double radius = Math.min(radiusMeters, MAX_RADIUS_M);

        // 1도(위도)의 길이 ≈ 111,320m 근사값 사용
        double latDelta = radius / 111_320.0;

        // 경도 1도 길이는 위도에 따라 달라지므로 cos(lat) 보정
        double radLat = Math.toRadians(centerLat);
        double lonDelta = radius / (111_320.0 * Math.cos(radLat));

        double minLat = centerLat - latDelta;
        double maxLat = centerLat + latDelta;
        double minLng = centerLng - lonDelta;
        double maxLng = centerLng + lonDelta;

        // 1) 바운딩 박스 기준으로 후보 스팟들을 DB에서 조회
        List<Spot> candidates = spotRepository.findInBoundingBox(
                minLat, maxLat,
                minLng, maxLng
        );

        // 2) 서버에서 하버사인 거리로 "원 범위" 필터링
        return candidates.stream()
                .filter(spot -> {
                    double distance = haversineDistanceMeters(
                            centerLat, centerLng,
                            spot.getLat(), spot.getLon()
                    );
                    return distance <= radius;
                })
                .toList();
    }

    /**
     * 기준 스팟 ID와 반경을 받아, 해당 스팟을 중심으로 한 원 범위 내 스팟 조회.
     * (자기 자신은 제외할지 여부를 옵션으로 처리 가능)
     */
    public List<Spot> findSpotsWithinRadiusOfSpot(Long centerSpotId,
                                                  double radiusMeters,
                                                  boolean excludeSelf) {

        Spot center = spotRepository.findById(centerSpotId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 스팟입니다. id=" + centerSpotId));

        List<Spot> inside = findSpotsWithinRadius(
                center.getLat(),
                center.getLon(),
                radiusMeters
        );

        if (excludeSelf) {
            inside = inside.stream()
                    .filter(s -> !s.getId().equals(center.getId()))
                    .toList();
        }

        return inside;
    }

    /**
     * 하버사인 공식 기반 두 좌표 사이 거리 계산 (미터 단위)
     */
    private double haversineDistanceMeters(double lat1, double lon1,
                                           double lat2, double lon2) {

        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(rLat1) * Math.cos(rLat2)
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_M * c;
    }
}
