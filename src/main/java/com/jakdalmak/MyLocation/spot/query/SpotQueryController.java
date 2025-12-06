package com.jakdalmak.MyLocation.spot.query;

import com.jakdalmak.MyLocation.spot.command.application.domain.dto.response.SpotReadResponse;
import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/console/spots")
@RequiredArgsConstructor
public class SpotQueryController {

    private final SpotQueryService spotQueryService;

    /**
     * 지도 중심 좌표 + 반경으로 원 범위 내 스팟 목록 조회
     *
     * 예: GET /api/spots/within?lat=37.501&lng=127.026&radius=800
     */
    @GetMapping("/within")
    public List<SpotReadResponse> getSpotsWithinRadius(
            @RequestParam("lat") double lat,
            @RequestParam("lng") double lng,
            @RequestParam(value = "radius", defaultValue = "800") double radiusMeters
    ) {
        List<Spot> spots = spotQueryService.findSpotsWithinRadius(lat, lng, radiusMeters);
        return spots.stream()
                .map(SpotReadResponse::from)
                .toList();
    }

    /**
     * 기준 스팟 ID + 반경으로 원 범위 내 스팟 목록 조회
     *
     * 예: GET /api/spots/{spotId}/neighbors?radius=800&excludeSelf=true
     */
    @GetMapping("/{spotId}/neighbors")
    public List<SpotReadResponse> getSpotsAroundSpot(
            @PathVariable("spotId") Long spotId,
            @RequestParam(value = "radius", defaultValue = "800") double radiusMeters,
            @RequestParam(value = "excludeSelf", defaultValue = "true") boolean excludeSelf
    ) {
        List<Spot> spots = spotQueryService.findSpotsWithinRadiusOfSpot(spotId, radiusMeters, excludeSelf);
        return spots.stream()
                .map(SpotReadResponse::from)
                .toList();
    }
}
