package com.jakdalmak.MyLocation.spot;

import com.jakdalmak.MyLocation.spot.domain.SpotConsoleDto;
import com.jakdalmak.MyLocation.spot.domain.SpotCreateRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;


/**
 * 간단한 인메모리 Spot 저장소.
 * 나중에 JPA 엔티티/레포지토리로 갈아끼우기 쉽게 최소한의 API만 정의.
 */
@Service
public class SpotCommandService {

    private final AtomicLong sequence = new AtomicLong(0L);
    private final ConcurrentMap<Long, SpotConsoleDto> store = new ConcurrentHashMap<>();

    public List<SpotConsoleDto> findAll() {
        return new ArrayList<>(store.values());
    }

    public SpotConsoleDto create(SpotCreateRequest req) {
        Long id = sequence.incrementAndGet();
        SpotConsoleDto dto = SpotConsoleDto.builder()
                .id(id)
                .name(req.getName())
                .lat(req.getLat())
                .lon(req.getLon())
                .locationWidth(req.getLocationWidth())
                .build();
        store.put(id, dto);
        return dto;
    }

    public void delete(Long id) {
        store.remove(id);
    }
}