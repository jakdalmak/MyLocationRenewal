package com.jakdalmak.MyLocation.spot.command.application;

import com.jakdalmak.MyLocation.spot.SpotCommandRepository;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.SpotConsoleDto;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.request.SpotCreateRequest;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.response.SpotReadResponse;
import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;


/**
 * 간단한 인메모리 Spot 저장소.
 * 나중에 JPA 엔티티/레포지토리로 갈아끼우기 쉽게 최소한의 API만 정의.
 */
@Service
@RequiredArgsConstructor
public class SpotCommandService {

    private final SpotCommandRepository spotRepository;

    @Transactional(readOnly = true)
    public List<SpotReadResponse> getAllSpot() {
        // 최근 생성 순 정렬 (원하면 createdAt으로 바꿔도 됨)
        return spotRepository.findAll(Sort.by(Sort.Direction.DESC, "id"))
                .stream()
                .map(SpotReadResponse::from)
                .toList();
    }

    @Transactional
    public SpotReadResponse createSpot(SpotCreateRequest request) {
        Spot spot = Spot.builder()
                .name(request.getName())
                .lat(request.getLat())
                .lon(request.getLon())
                .locationWidth(request.getLocationWidth())
                .build();

        Spot saved = spotRepository.save(spot);
        return SpotReadResponse.from(saved);
    }

    @Transactional
    public void deleteSpot(Long id) {
        // 필요하면 존재 검사 후 예외 처리 추가 가능
        spotRepository.deleteById(id);
    }
}