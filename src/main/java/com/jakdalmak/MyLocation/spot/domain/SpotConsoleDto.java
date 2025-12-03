package com.jakdalmak.MyLocation.spot.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 콘솔용 Spot DTO
 *  - id: 콘솔 내 식별자 (인메모리)
 *  - name: 스팟 이름
 *  - lat / lon: 위도, 경도
 *  - locationWidth: 반경 (m 단위, 기존 MyLocation 구조와 맞춤)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpotConsoleDto {

    private Long id;

    private String name;

    // 위도
    private double lat;

    // 경도
    private double lon;

    // 반경 (미터)
    private int locationWidth;
}