package com.jakdalmak.MyLocation.route;

import com.jakdalmak.MyLocation.route.dto.RoutePolylineResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/console/route")
@RequiredArgsConstructor
public class RouteQueryController {

    private final OdsayRouteService odsayRouteService;

    @GetMapping("/pubtrans")
    public RoutePolylineResponse getPubTransRoute(
            @RequestParam("sx") double sx,
            @RequestParam("sy") double sy,
            @RequestParam("ex") double ex,
            @RequestParam("ey") double ey
    ) {
        return odsayRouteService.getBestPubTransRoute(sx, sy, ex, ey);
    }
}