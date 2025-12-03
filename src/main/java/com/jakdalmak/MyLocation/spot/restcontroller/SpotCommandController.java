package com.jakdalmak.MyLocation.spot.restcontroller;


import com.jakdalmak.MyLocation.spot.SpotCommandService;
import com.jakdalmak.MyLocation.spot.domain.SpotConsoleDto;
import com.jakdalmak.MyLocation.spot.domain.SpotCreateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/console/spots")
public class SpotCommandController {
    private final SpotCommandService spotConsoleService;

    @GetMapping
    public List<SpotConsoleDto> list() {
        return spotConsoleService.findAll();
    }

    @PostMapping
    public SpotConsoleDto create(@RequestBody SpotCreateRequest req) {
        return spotConsoleService.create(req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        spotConsoleService.delete(id);
    }
}
