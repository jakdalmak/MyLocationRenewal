package com.jakdalmak.MyLocation.route.dto;

public record RouteSummaryDto(
        int totalTime,          // 총 소요 시간(분)
        int payment,            // 총 요금(원)
        int busTransitCount,    // 버스 환승 횟수
        int subwayTransitCount  // 지하철 환승 횟수
) {}