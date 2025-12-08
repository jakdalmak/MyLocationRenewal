package com.jakdalmak.MyLocation.route;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jakdalmak.MyLocation.route.dto.LatLngDto;
import com.jakdalmak.MyLocation.route.dto.RoutePolylineResponse;
import com.jakdalmak.MyLocation.route.dto.RouteSegmentDto;
import com.jakdalmak.MyLocation.route.dto.RouteSummaryDto;
import com.jakdalmak.MyLocation.route.dto.RouteTransitStepDto;
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
     * ODsay 샘플 코드 스타일의 순수 HttpURLConnection GET.
     *  👉 통신 방식은 절대 건드리지 않음.
     */
    private String httpGet(String urlInfo) throws Exception {
        URL url = new URL(urlInfo);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Content-type", "application/json");

        int status = conn.getResponseCode();
        BufferedReader br;
        if (status >= 200 && status < 300) {
            br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
            );
        } else {
            br = new BufferedReader(
                    new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8)
            );
        }

        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }
        br.close();
        conn.disconnect();

        String body = sb.toString();
        log.info("HTTP GET {} -> status={}, bodyLen={}", urlInfo, status, body.length());
        return body;
    }

    public RoutePolylineResponse getBestPubTransRoute(
            double sx, double sy,
            double ex, double ey
    ) {
        try {
            // 0) apiKey 정리 + 로그
            String apiKey = cleanApiKey();
            if (apiKey == null || apiKey.isEmpty()) {
                throw new IllegalStateException("ODsay apiKey가 비어 있습니다. (odsay.api-key 확인)");
            }

            String encodedKey = URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

            log.info("ODsay apiKey debug - raw='{}', cleaned='{}', len={}, hex={}",
                    rawApiKey,
                    apiKey,
                    apiKey.length(),
                    apiKey.chars()
                            .mapToObj(c -> String.format("%02X", c))
                            .collect(Collectors.joining(" "))
            );
            log.info("ODsay apiKey encoded='{}'", encodedKey);

            // 1) searchPubTransPathT 호출 (통신 방식 그대로)
            String searchUrl =
                    SEARCH_URL
                            + "?SX=" + sx
                            + "&SY=" + sy
                            + "&EX=" + ex
                            + "&EY=" + ey
                            + "&OPT=0"
                            + "&apiKey=" + encodedKey;

            log.info(">>> ODsay searchUrl: {}", searchUrl);

            String searchJson = httpGet(searchUrl);
            JsonNode root = objectMapper.readTree(searchJson);

            if (root.has("error")) {
                JsonNode errorNode = root.get("error");
                String code = null;
                String msg = null;

                if (errorNode.isArray() && errorNode.size() > 0) {
                    JsonNode e = errorNode.get(0);
                    code = e.path("code").asText(null);
                    msg = e.path("message").asText(null);
                } else if (errorNode.isObject()) {
                    code = errorNode.path("code").asText(null);
                    msg = errorNode.path("message").asText(errorNode.path("msg").asText(null));
                }

                log.error("ODsay error(search): code={}, msg={}, raw={}", code, msg, searchJson);
                throw new IllegalStateException("ODsay 길찾기 실패: " + msg);
            }

            JsonNode result = root.path("result");
            JsonNode pathArray = result.path("path");
            if (!pathArray.isArray() || pathArray.isEmpty()) {
                throw new IllegalStateException("ODsay 길찾기 결과 없음");
            }

            JsonNode path0 = pathArray.get(0);
            JsonNode info = path0.path("info");

            int totalTime = info.path("totalTime").asInt();
            int payment = info.path("payment").asInt();
            int busTransitCount = info.path("busTransitCount").asInt();
            int subwayTransitCount = info.path("subwayTransitCount").asInt();
            String mapObj = info.path("mapObj").asText();

            // ---------------------------------------------------------
            // (1) subPath → steps / transferPoints 파싱
            // ---------------------------------------------------------
            List<RouteTransitStepDto> steps = new ArrayList<>();
            List<LatLngDto> transferPoints = new ArrayList<>();

            try {
                JsonNode subPathArray = path0.path("subPath");
                List<JsonNode> transitSubpaths = new ArrayList<>();

                if (subPathArray.isArray()) {
                    for (JsonNode sp : subPathArray) {
                        int trafficType = sp.path("trafficType").asInt(); // 1:지하철, 2:버스, 3:도보

                        // 도보(3)는 상세 목록에서 제외
                        if (trafficType != 1 && trafficType != 2) {
                            continue;
                        }

                        String type = (trafficType == 2) ? "BUS" : "SUBWAY";

                        String startName = sp.path("startName").asText("");
                        String endName = sp.path("endName").asText("");
                        int sectionTime = sp.path("sectionTime").asInt(0);
                        int stationCount = sp.path("stationCount").asInt(0);

                        // 노선 이름 (버스: busNo, 지하철: name)
                        String lineName = "";
                        JsonNode lanesNode = sp.path("lane");
                        if (lanesNode.isArray() && lanesNode.size() > 0) {
                            JsonNode lane0 = lanesNode.get(0);
                            lineName = lane0.path("busNo").asText("");
                            if (lineName.isEmpty()) {
                                lineName = lane0.path("name").asText("");
                            }
                        }

                        steps.add(new RouteTransitStepDto(
                                type,
                                lineName,
                                startName,
                                endName,
                                sectionTime,
                                stationCount
                        ));

                        transitSubpaths.add(sp);
                    }

                    // 환승 지점:
                    //  - 두 번째 대중교통 subPath부터 각 subPath의 startX/startY 를 환승 지점으로 사용
                    for (int i = 1; i < transitSubpaths.size(); i++) {
                        JsonNode sp = transitSubpaths.get(i);
                        double x = sp.path("startX").asDouble(Double.NaN);
                        double y = sp.path("startY").asDouble(Double.NaN);
                        if (!Double.isNaN(x) && !Double.isNaN(y)) {
                            transferPoints.add(new LatLngDto(y, x));
                        }
                    }
                }
            } catch (Exception parseEx) {
                log.warn("ODsay subPath 파싱 중 오류 발생 (steps/transferPoints는 비워둠).", parseEx);
                steps = Collections.emptyList();
                transferPoints = Collections.emptyList();
            }

            // ---------------------------------------------------------
            // (2) loadLane → segments / 전체 points 파싱
            // ---------------------------------------------------------
            String mapObjectParam = "0:0@" + mapObj;
            String encodedMapObject = URLEncoder.encode(mapObjectParam, StandardCharsets.UTF_8);

            String laneUrl =
                    LOAD_LANE_URL
                            + "?mapObject=" + encodedMapObject
                            + "&apiKey=" + encodedKey;

            log.info(">>> ODsay laneUrl: {}", laneUrl);

            String laneJson = httpGet(laneUrl);
            JsonNode laneRoot = objectMapper.readTree(laneJson);

            if (laneRoot.has("error")) {
                JsonNode error = laneRoot.get("error");
                String msg = error.has("msg")
                        ? error.get("msg").asText()
                        : error.path("message").asText("ODsay lane error");
                log.warn("ODsay loadLane error: {}", msg);
                throw new IllegalStateException("ODsay 노선 그래픽 조회 실패: " + msg);
            }

            JsonNode laneResult = laneRoot.path("result");
            JsonNode laneArray = laneResult.path("lane");

            List<LatLngDto> allPoints = new ArrayList<>();
            List<RouteSegmentDto> segments = new ArrayList<>();

            if (laneArray.isArray()) {
                for (JsonNode lane : laneArray) {
                    int laneType = lane.path("type").asInt(0); // loadLane 문서 기준
                    String segType;

                    // 대중교통 길찾기 기준 타입 매핑
                    // 1:지하철, 2/3/4/5:버스, 9:도보
                    if (laneType == 1 || laneType == 6) {
                        segType = "SUBWAY";
                    } else if (laneType == 2 || laneType == 3 || laneType == 4 || laneType == 5) {
                        segType = "BUS";
                    } else if (laneType == 9) {
                        segType = "WALK";
                    } else {
                        segType = "OTHER";
                    }

                    List<LatLngDto> segPoints = new ArrayList<>();

                    JsonNode sections = lane.path("section");
                    if (!sections.isArray()) continue;

                    for (JsonNode section : sections) {
                        JsonNode graphPos = section.path("graphPos");
                        if (!graphPos.isArray()) continue;

                        for (JsonNode pos : graphPos) {
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

            RouteSummaryDto summary = new RouteSummaryDto(
                    totalTime,
                    payment,
                    busTransitCount,
                    subwayTransitCount
            );

            List<LatLngDto> points = allPoints.isEmpty() ? Collections.emptyList() : allPoints;

            return new RoutePolylineResponse(
                    summary,
                    points,
                    steps,
                    segments,
                    transferPoints
            );

        } catch (Exception e) {
            log.error("ODsay route fetch failed (HttpURLConnection)", e);
            throw new RuntimeException("ODsay 경로 조회 중 오류가 발생했습니다.", e);
        }
    }
}
