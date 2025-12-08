package com.jakdalmak.MyLocation.route.dto;

/**
 * 버스/지하철 단위의 이동 단계 요약
 * - ODsay searchPubTransPathT 의 subPath(trafficType 1,2) 기준으로 만들면 됨.
 */
public record RouteTransitStepDto(
        String type,       // "BUS" or "SUBWAY"
        String lineName,   // 예: "7016", "지하철 5호선", "9호선 급행"
        String startName,  // 예: "서울역", "공덕역"
        String endName,    // 예: "공덕역", "김포공항역"
        int sectionTime,   // 해당 구간 소요 시간(분)
        int stationCount   // 정류장/역 개수
) {}