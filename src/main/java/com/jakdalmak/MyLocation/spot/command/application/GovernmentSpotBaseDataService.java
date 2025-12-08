package com.jakdalmak.MyLocation.spot.command.application;

import com.jakdalmak.MyLocation.spot.SpotCommandRepository;
import com.jakdalmak.MyLocation.spot.command.application.domain.SpotType;
import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GovernmentSpotBaseDataService {

    private final SpotCommandRepository spotRepository;

    @Transactional
    public int importGovernmentSpotsFromCsv(MultipartFile file, int defaultLocationWidthMeter) {
        List<Spot> batch = new ArrayList<>();

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String line = br.readLine(); // 헤더 스킵
            if (line == null) {
                log.warn("CSV가 비어 있습니다: {}", file.getOriginalFilename());
                return 0;
            }

            int lineNum = 1;
            while ((line = br.readLine()) != null) {
                lineNum++;

                if (line.isBlank()) {
                    continue;
                }

                // CSV: name,address,lat,lon,phone,homepage
                String[] cols = line.split(",", -1);
                if (cols.length < 4) {
                    log.warn("컬럼 수가 부족합니다. line {}: {}", lineNum, line);
                    continue;
                }

                String name = cols[0].trim();
                String address = cols[1].trim();
                String latStr = cols[2].trim();
                String lonStr = cols[3].trim();
                // 필요하면 phone/homepage도 향후 Spot에 추가 가능
                // String phone = cols.length > 4 ? cols[4].trim() : null;
                // String homepage = cols.length > 5 ? cols[5].trim() : null;

                if (name.isEmpty() || latStr.isEmpty() || lonStr.isEmpty()) {
                    log.warn("필수 값(name/lat/lon) 누락. line {}: {}", lineNum, line);
                    continue;
                }

                Double lat;
                Double lon;
                try {
                    lat = Double.parseDouble(latStr);
                    lon = Double.parseDouble(lonStr);
                } catch (NumberFormatException e) {
                    log.warn("lat/lon 파싱 실패. line {}: {}", lineNum, line, e);
                    continue;
                }

                // 중복 방지: 같은 이름 + 좌표 + GOVERNMENT면 스킵
                boolean exists = spotRepository.existsByNameAndLatAndLonAndType(
                        name, lat, lon, SpotType.GOVERNMENT
                );
                if (exists) {
                    log.info("이미 존재하는 GOVERNMENT 스팟입니다. skip. name={}, lat={}, lon={}",
                            name, lat, lon);
                    continue;
                }

                Spot spot = Spot.builder()
                        .name(name)
                        .lat(lat)
                        .lon(lon)
                        .locationWidth(defaultLocationWidthMeter)
                        .type(SpotType.GOVERNMENT)
//                        .ownerUserId(null)
                        .build();

                batch.add(spot);
            }

        } catch (IOException e) {
            throw new IllegalStateException("지자체 CSV 읽기 실패: " + file.getOriginalFilename(), e);
        }

        if (batch.isEmpty()) {
            log.warn("저장할 GOVERNMENT 스팟이 없습니다. file={}", file.getOriginalFilename());
            return 0;
        }

        spotRepository.saveAll(batch);
        log.info("GOVERNMENT 스팟 {}개 저장 완료. file={}", batch.size(), file.getOriginalFilename());
        return batch.size();
    }

    /**
     * 🔹 전체_도시철도역사정보_20250930.xlsx 를 그대로 업로드해서
     *     역사명 + " " + 노선명, 위도, 경도, type=GOVERNMENT 로 Spot을 저장한다.
     *
     * 사용 컬럼 (정확한 헤더명):
     *  - 역사명
     *  - 노선명
     *  - 역위도
     *  - 역경도
     */
    @Transactional
    public int importSubwayStationsFromExcel(MultipartFile file, int defaultLocationWidthMeter) {
        List<Spot> batch = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                log.warn("엑셀에 시트가 없습니다. file={}", file.getOriginalFilename());
                return 0;
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                log.warn("엑셀에 헤더 행이 없습니다. file={}", file.getOriginalFilename());
                return 0;
            }

            // 헤더 텍스트 → 컬럼 인덱스 매핑
            Map<String, Integer> colIndex = new HashMap<>();
            DataFormatter formatter = new DataFormatter(); // 숫자/문자 상관없이 문자열로 뽑기 위함

            for (Cell cell : headerRow) {
                String header = formatter.formatCellValue(cell);
                if (header != null && !header.isBlank()) {
                    colIndex.put(header.trim(), cell.getColumnIndex());
                }
            }

            Integer idxStationName = colIndex.get("역사명");
            Integer idxLineName    = colIndex.get("노선명");
            Integer idxLat         = colIndex.get("역위도");
            Integer idxLon         = colIndex.get("역경도");

            if (idxStationName == null || idxLineName == null || idxLat == null || idxLon == null) {
                throw new IllegalArgumentException(
                        "지하철 엑셀 헤더를 찾을 수 없습니다. " +
                                "필요 헤더: [역사명, 노선명, 역위도, 역경도], 실제: " + colIndex.keySet()
                );
            }

            int lastRowNum = sheet.getLastRowNum();
            for (int rowNum = 1; rowNum <= lastRowNum; rowNum++) {
                Row row = sheet.getRow(rowNum);
                if (row == null) {
                    continue;
                }

                String stationName = formatter.formatCellValue(row.getCell(idxStationName)).trim();
                String lineName    = formatter.formatCellValue(row.getCell(idxLineName)).trim();
                String latStr      = formatter.formatCellValue(row.getCell(idxLat)).trim();
                String lonStr      = formatter.formatCellValue(row.getCell(idxLon)).trim();

                if (stationName.isEmpty() || lineName.isEmpty() ||
                        latStr.isEmpty() || lonStr.isEmpty()) {
                    log.debug("필수 값(역사명/노선명/lat/lon) 누락. row={} file={}", rowNum + 1, file.getOriginalFilename());
                    continue;
                }

                String name = stationName + " " + lineName;  // ✅ 이름 형식 강제

                Double lat;
                Double lon;
                try {
                    lat = Double.parseDouble(latStr);
                    lon = Double.parseDouble(lonStr);
                } catch (NumberFormatException e) {
                    log.warn("lat/lon 파싱 실패(지하철). row={} lat='{}' lon='{}'. file={}",
                            rowNum + 1, latStr, lonStr, file.getOriginalFilename(), e);
                    continue;
                }

                boolean exists = spotRepository.existsByNameAndLatAndLonAndType(
                        name, lat, lon, SpotType.GOVERNMENT
                );
                if (exists) {
                    log.debug("이미 존재하는 지하철 GOVERNMENT 스팟. skip. name={}, lat={}, lon={}",
                            name, lat, lon);
                    continue;
                }

                Spot spot = Spot.builder()
                        .name(name)
                        .lat(lat)
                        .lon(lon)
                        .locationWidth(defaultLocationWidthMeter)
                        .type(SpotType.GOVERNMENT)
//                        .ownerUserId(null)
                        .build();

                batch.add(spot);
            }

        } catch (Exception e) {
            throw new IllegalStateException("지하철 엑셀 읽기 실패: " + file.getOriginalFilename(), e);
        }

        if (batch.isEmpty()) {
            log.warn("저장할 지하철 GOVERNMENT 스팟이 없습니다. file={}", file.getOriginalFilename());
            return 0;
        }

        spotRepository.saveAll(batch);
        log.info("지하철 GOVERNMENT 스팟 {}개 저장 완료. file={}", batch.size(), file.getOriginalFilename());
        return batch.size();
    }
}