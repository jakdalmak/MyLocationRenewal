package com.jakdalmak.MyLocation.spot.command.application.domain.dto.request;



import lombok.*;

/**
 * Spot 생성 시 클라이언트에서 받는 요청 DTO
 */

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpotCreateRequest {

    private String name;
    private Double lat;
    private Double lon;
    private Double locationWidth;
}