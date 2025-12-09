package com.jakdalmak.MyLocation.route;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jakdalmak.MyLocation.route.dto.LatLngDto;
import com.jakdalmak.MyLocation.route.dto.RoutePolylineResponse;
import com.jakdalmak.MyLocation.route.dto.RouteSegmentDto;
import com.jakdalmak.MyLocation.route.dto.RouteSummaryDto;
import com.jakdalmak.MyLocation.route.dto.RouteTransitStepDto;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * ODsay 대중교통 경로 조회 서비스.
 * - searchPubTransPathT 로 최대 3개 경로 조회
 * - 각 경로별로 loadLane 을 다시 호출해 polyline/segment 정보 구성
 * - WALK(trafficType=3) 반영 + lane.class 기반 BUS/SUBWAY 매핑
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OdsayRouteService {

    @Value("${odsay.api-key}")
    private String rawApiKey;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String SEARCH_URL = "https://api.odsay.com/v1/api/searchPubTransPathT";
    private static final String LOAD_LANE_URL = "https://api.odsay.com/v1/api/loadLane";

    private String cleanApiKey() {
        if (rawApiKey == null) return null;
        return rawApiKey.strip();
    }

    /**
     * 공식 샘플 스타일 HttpURLConnection.
     */
    private String httpGet(String urlInfo) throws Exception {
        URL url = new URL(urlInfo);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Content-type", "application/json");

        int status = conn.getResponseCode();
        BufferedReader br;
        if (status >= 200 && status < 300) {
            br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        } else {
            br = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8));
        }

        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        conn.disconnect();

        String body = sb.toString();
        log.info("[HTTP GET] {} -> status={}, bodyLen={}", urlInfo, status, body.length());
        return body;
    }

    /**
     * 3개 경로까지 조회
     */
    public RoutePolylineMultiResponse getBestPubTransRoute(
            double sx, double sy,
            double ex, double ey
    ) {
        try {
            String apiKey = cleanApiKey();
            if (apiKey == null || apiKey.isEmpty()) {
                throw new IllegalStateException("ODsay apiKey가 비어 있음.");
            }

            String encodedKey = URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

            log.info("[apiKey debug] raw='{}'", rawApiKey);
            log.info("[apiKey clean]='{}'", apiKey);
            log.info("[apiKey hex]={}", apiKey.chars()
                    .mapToObj(c -> String.format("%02X", c))
                    .collect(Collectors.joining(" ")));

            // 1) searchPubTransPathT 호출
            String searchUrl =
                    SEARCH_URL
                            + "?SX=" + sx
                            + "&SY=" + sy
                            + "&EX=" + ex
                            + "&EY=" + ey
                            + "&OPT=0"
                            + "&apiKey=" + encodedKey;

            log.info(">>> searchUrl: {}", searchUrl);

            String searchJson = httpGet(searchUrl);
            JsonNode root = objectMapper.readTree(searchJson);

            if (root.has("error")) {
                JsonNode err = root.get("error");
                String msg = err.path("message").asText(err.path("msg").asText("ODsay error"));
                log.error("ODsay search error: {}", msg);
                throw new IllegalStateException("ODsay 길찾기 실패: " + msg);
            }

            JsonNode result = root.path("result");
            JsonNode pathArray = result.path("path");
            if (!pathArray.isArray() || pathArray.isEmpty()) {
                throw new IllegalStateException("ODsay 길찾기 결과 없음");
            }

            int count = Math.min(3, pathArray.size());
            List<RoutePolylineResponse> routes = new ArrayList<>();

            for (int i = 0; i < count; i++) {
                RoutePolylineResponse r = buildSingleRoute(pathArray.get(i), encodedKey);
                routes.add(r);
            }

            log.info(">>> 최종 route 개수 = {}", routes.size());
            return new RoutePolylineMultiResponse(routes);

        } catch (Exception e) {
            log.error("[ODsay] 경로 조회 실패", e);
            throw new RuntimeException("ODsay 경로 조회 오류", e);
        }
    }

    /**
     * path[*] 하나에 대해 summary + steps + transferPoints + segments + points 구성
     */
    private RoutePolylineResponse buildSingleRoute(JsonNode pathNode, String encodedKey) throws Exception {

        JsonNode info = pathNode.path("info");

        int totalTime = info.path("totalTime").asInt();
        int payment = info.path("payment").asInt();
        int busTransitCount = info.path("busTransitCount").asInt();
        int subwayTransitCount = info.path("subwayTransitCount").asInt();
        String mapObj = info.path("mapObj").asText();

        /* ================================================================
         * (1) subPath → steps + transferPoints
         * ================================================================ */
        List<RouteTransitStepDto> steps = new ArrayList<>();
        List<LatLngDto> transferPoints = new ArrayList<>();

        try {
            JsonNode subPath = pathNode.path("subPath");
            List<JsonNode> transitOnly = new ArrayList<>();

            if (subPath.isArray()) {
                for (JsonNode sp : subPath) {
                    int trafficType = sp.path("trafficType").asInt();
                    String typeStr;

                    if (trafficType == 1) typeStr = "SUBWAY";
                    else if (trafficType == 2) typeStr = "BUS";
                    else if (trafficType == 3) typeStr = "WALK";
                    else continue; // 기타는 skip

                    String startName = sp.path("startName").asText("");
                    String endName = sp.path("endName").asText("");
                    int sectionTime = sp.path("sectionTime").asInt(0);
                    int stationCount = sp.path("stationCount").asInt(0);

                    String lineName = "";
                    if (trafficType == 1 || trafficType == 2) {
                        JsonNode laneArr = sp.path("lane");
                        if (laneArr.isArray() && laneArr.size() > 0) {
                            JsonNode lane0 = laneArr.get(0);
                            lineName = lane0.path("busNo").asText("");
                            if (lineName.isEmpty()) {
                                lineName = lane0.path("name").asText("");
                            }
                        }
                    }

                    steps.add(new RouteTransitStepDto(
                            typeStr,
                            lineName,
                            startName,
                            endName,
                            sectionTime,
                            stationCount
                    ));

                    if (trafficType == 1 || trafficType == 2) {
                        transitOnly.add(sp);
                    }
                }

                // 환승 포인트: 두 번째 transit 부터 startX/startY
                for (int i = 1; i < transitOnly.size(); i++) {
                    JsonNode sp = transitOnly.get(i);
                    double x = sp.path("startX").asDouble(Double.NaN);
                    double y = sp.path("startY").asDouble(Double.NaN);
                    if (!Double.isNaN(x) && !Double.isNaN(y)) {
                        transferPoints.add(new LatLngDto(y, x));
                    }
                }
            }

            log.info("[buildRoute] steps={}, transfers={}", steps.size(), transferPoints.size());

        } catch (Exception ex) {
            log.warn("subPath 파싱 오류", ex);
            steps = Collections.emptyList();
            transferPoints = Collections.emptyList();
        }

        /* ================================================================
         * (2) loadLane → segments + allPoints
         * lane.class 기반 매핑으로 OTHER 제거
         * ================================================================ */
        String mapObjParam = "0:0@" + mapObj;
        String encodedMap = URLEncoder.encode(mapObjParam, StandardCharsets.UTF_8);

        String laneUrl = LOAD_LANE_URL
                + "?mapObject=" + encodedMap
                + "&apiKey=" + encodedKey;

        log.info(">>> loadLane URL: {}", laneUrl);

        String laneJson = httpGet(laneUrl);
        JsonNode laneRoot = objectMapper.readTree(laneJson);

        if (laneRoot.has("error")) {
            JsonNode err = laneRoot.get("error");
            String msg = err.path("message").asText(err.path("msg").asText("ODsay error"));
            log.error("loadLane error: {}", msg);
            throw new IllegalStateException("loadLane 실패: " + msg);
        }

        JsonNode laneResult = laneRoot.path("result");
        JsonNode laneArr = laneResult.path("lane");

        List<LatLngDto> allPoints = new ArrayList<>();
        List<RouteSegmentDto> segments = new ArrayList<>();

        if (laneArr.isArray()) {
            for (JsonNode ln : laneArr) {

                // ************* 핵심 수정 부분 *************
                // lane.class 로 BUS/SUBWAY 판별
                int laneClass = ln.path("class").asInt(0);
                String segType;

                if (laneClass == 1) segType = "BUS";
                else if (laneClass == 2) segType = "SUBWAY";
                else segType = "WALK"; // 일부 도보 구간은 class 0이거나 graphPos만 존재 → WALK 처리

                List<LatLngDto> segPoints = new ArrayList<>();

                JsonNode sections = ln.path("section");
                if (!sections.isArray()) continue;

                for (JsonNode sec : sections) {
                    JsonNode posArr = sec.path("graphPos");
                    if (!posArr.isArray()) continue;

                    for (JsonNode pos : posArr) {
                        double x = pos.path("x").asDouble(); // 경도
                        double y = pos.path("y").asDouble(); // 위도
                        LatLngDto dto = new LatLngDto(y, x);
                        segPoints.add(dto);
                        allPoints.add(dto);
                    }
                }

                if (!segPoints.isEmpty()) {
                    segments.add(new RouteSegmentDto(segType, segPoints));
                }
            }
        }

        log.info("[buildRoute] segments={}, allPoints={}", segments.size(), allPoints.size());

        RouteSummaryDto summary = new RouteSummaryDto(
                totalTime,
                payment,
                busTransitCount,
                subwayTransitCount
        );

        return new RoutePolylineResponse(
                summary,
                allPoints.isEmpty() ? Collections.emptyList() : allPoints,
                steps,
                segments,
                transferPoints
        );
    }

    /* ================================================================
     * Multi 경로 응답 DTO
     * ================================================================ */
    @Getter
    public static class RoutePolylineMultiResponse {
        private final List<RoutePolylineResponse> routes;

        public RoutePolylineMultiResponse(List<RoutePolylineResponse> routes) {
            this.routes = routes;
        }
    }
}
