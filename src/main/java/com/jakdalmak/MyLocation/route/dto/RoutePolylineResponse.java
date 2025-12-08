package com.jakdalmak.MyLocation.route.dto;

import java.util.List;

public record RoutePolylineResponse(
        RouteSummaryDto summary,

        // 기존 전체 polyline (백엔드가 segments 안 줄 때 fallback 용)
        List<LatLngDto> points,

        // 1) 상세 단계: 버스/지하철 이동 구간 요약
        List<RouteTransitStepDto> steps,

        // 2) 유형별 polyline 구간 (BUS / SUBWAY / WALK)
        List<RouteSegmentDto> segments,

        // 3) 환승 지점 (환승 핀 표시용)
        List<LatLngDto> transferPoints
) {}