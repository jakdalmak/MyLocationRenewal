package com.jakdalmak.MyLocation.spot.domain;
import lombok.Data;

/**
 * Spot 생성 시 클라이언트에서 받는 요청 DTO
 */
@Data
public class SpotCreateRequest {

    private String name;
    private double lat;
    private double lon;
    private int locationWidth;
}