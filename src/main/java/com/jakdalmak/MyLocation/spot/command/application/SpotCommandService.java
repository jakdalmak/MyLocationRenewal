package com.jakdalmak.MyLocation.spot.command.application;

import com.jakdalmak.MyLocation.spot.SpotCommandRepository;
import com.jakdalmak.MyLocation.spot.command.application.domain.SpotType;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.SpotConsoleDto;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.request.SpotCreateRequest;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.response.SpotReadResponse;
import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;


/**
 * 간단한 인메모리 Spot 저장소.
 * 나중에 JPA 엔티티/레포지토리로 갈아끼우기 쉽게 최소한의 API만 정의.
 */
@Service
@RequiredArgsConstructor
public class SpotCommandService {

    private final SpotCommandRepository spotRepository;

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


    /**
     * 주소 기반으로 동일한 핀이 존재하는 경우, 새로운 핀을 만드는 것이 아닌
     * 해당 사용자에 대한 핀 - 사용자 다대다 관계 구축하여 핀 개수 낭비 자제
     * */
    private Optional<Spot> isAlreadyCreatedSpotByAddress(String address) {
        List<Spot> alreadyCreatedSpotList = spotRepository.findAllByAddress(address);

        Optional<Spot> targetSpot = Optional.empty();

        if(alreadyCreatedSpotList.size() == 0) return targetSpot;

        for(Spot spot : alreadyCreatedSpotList) {
            if(spot.getType() == SpotType.GOVERNMENT) {
                targetSpot = Optional.of(spot);
                break;
            }
        }

        return targetSpot;
    }

    /**
     * 위도 경도 기반으로 동일한 핀이 존재하는 경우, 새로운 핀을 만드는 것이 아닌
     * 해당 사용자에 대한 핀 - 사용자 다대다 관계 구축하여 핀 개수 낭비 자제
     * */
    private Optional<Spot> isAlreadyCreatedSpotByLatAndLot(double lat, double lot) {
        return spotRepository.findByLatAndLon(lat, lot);
    }

}