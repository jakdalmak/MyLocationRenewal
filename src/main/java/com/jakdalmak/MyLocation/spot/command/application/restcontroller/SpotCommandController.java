package com.jakdalmak.MyLocation.spot.command.application.restcontroller;


import com.jakdalmak.MyLocation.spot.command.application.SpotCommandService;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.SpotConsoleDto;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.request.SpotCreateRequest;
import com.jakdalmak.MyLocation.spot.command.application.domain.dto.response.SpotReadResponse;
import com.jakdalmak.MyLocation.spot.command.application.domain.entity.Spot;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/console/spots")
public class SpotCommandController {
    private final SpotCommandService spotCommandService;

//    @GetMapping
//    public List<Spot> list() {
//        return spotCommandService.findAll();
//    }

    @PostMapping
    public SpotReadResponse create(@RequestBody SpotCreateRequest req) {
        return spotCommandService.createSpot(req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        spotCommandService.deleteSpot(id);
    }


}
