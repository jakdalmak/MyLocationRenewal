package com.jakdalmak.MyLocation.spot.command.application.domain.entity;

import com.jakdalmak.MyLocation.spot.command.application.domain.SpotType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "spot",
        indexes = {
                @Index(name = "idx_spot_lat_lon", columnList = "lat, lon")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Spot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;  // JS에서 spot.id 로 사용

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lon;

    /**
     * 반경(m) – JS에서 locationWidth 필드로 사용
     */
    @Column(name = "location_width_m", nullable = false)
    private Double locationWidth;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(updatable = false)
    private SpotType type;
}