package com.jakdalmak.MyLocation.spot.command.application.controller;

import com.jakdalmak.MyLocation.spot.command.application.GovernmentSpotBaseDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/basedata/government-spots")
@RequiredArgsConstructor
@Tag(name = "Government Spot BaseData", description = "지자체 주소 작업용 GOVERNMENT 스팟 CSV 업로드 API")
public class BaseDataSpotCommandController {

    private final GovernmentSpotBaseDataService baseDataService;

    // 필요하면 설정값으로 뺄 수 있음
    private static final int DEFAULT_LOCATION_WIDTH_METER = 500;

    public record UploadResultResponse(
            String fileName,
            int insertedCount
    ) {}


    @PostMapping(value = "/upload-csv", consumes = "multipart/form-data")
    @Operation(
            summary = "지자체 주소 CSV 업로드",
            description = "local_gov_with_latlon.csv 파일을 업로드하여 GOVERNMENT 스팟 베이스데이터를 생성합니다."
    )
    public ResponseEntity<UploadResultResponse> uploadGovernmentSpotsCsv(
            @RequestPart("file") MultipartFile file
    ) {
        int insertedCount = baseDataService.importGovernmentSpotsFromCsv(file, DEFAULT_LOCATION_WIDTH_METER);

        UploadResultResponse body = new UploadResultResponse(
                file.getOriginalFilename(),
                insertedCount
        );
        return ResponseEntity.ok(body);
    }



    @PostMapping(value = "/upload-subway-csv", consumes = "multipart/form-data")
    @Operation(
            summary = "지하철 역사 CSV 업로드",
            description = "전체_도시철도역사정보 CSV 파일을 업로드하여 지하철역 GOVERNMENT 스팟을 생성합니다. " +
                    "Spot.name은 항상 '역사명 + 공백 + 노선명' 형식으로 저장됩니다."
    )
    public ResponseEntity<UploadResultResponse> uploadSubwayStationsCsv(
            @RequestPart("file") MultipartFile file
    ) {
        int insertedCount = baseDataService.importSubwayStationsFromExcel(file, DEFAULT_LOCATION_WIDTH_METER);

        UploadResultResponse body = new UploadResultResponse(
                file.getOriginalFilename(),
                insertedCount
        );
        return ResponseEntity.ok(body);
    }
}
