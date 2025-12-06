package com.jakdalmak.MyLocation.spot.command.application.domain.dto.response;

import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpotReadResponse {
    private Long id;
    private String name;
    private Double lat;
    private Double lon;
    private Integer locationWidth;
    private LocalDateTime createdAt;

    public static SpotReadResponse from(Spot spot) {
        return SpotReadResponse.builder()
                .id(spot.getId())
                .name(spot.getName())
                .lat(spot.getLat())
                .lon(spot.getLon())
                .locationWidth(spot.getLocationWidth())
                .createdAt(spot.getCreatedAt())
                .build();
    }
}
