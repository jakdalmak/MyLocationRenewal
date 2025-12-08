package com.jakdalmak.MyLocation.route.dto;

import java.util.List;

/**
 * 지도에 색깔별로 그릴 polyline 구간 정보.
 * - type: BUS / SUBWAY / WALK
 * - points: 해당 구간의 위경도 좌표들
 */
public record RouteSegmentDto(
        String type,          // "BUS", "SUBWAY", "WALK"
        List<LatLngDto> points
) {}