package com.jakdalmak.MyLocation.spot.command.application.domain.dto.response;

import com.jakdalmak.MyLocation.spot.command.application.domain.SpotType;
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
    private Double locationWidth;
    private LocalDateTime createdAt;
    private SpotType type;

    public static SpotReadResponse from(Spot spot) {
        return SpotReadResponse.builder()
                .id(spot.getId())
                .name(spot.getName())
                .lat(spot.getLat())
                .lon(spot.getLon())
                .locationWidth(spot.getLocationWidth())
                .createdAt(spot.getCreatedAt())
                .type(spot.getType())
                .build();
    }
}
