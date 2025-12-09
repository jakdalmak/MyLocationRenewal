package com.jakdalmak.MyLocation.route;

import com.jakdalmak.MyLocation.route.dto.RoutePolylineResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/console/route")
@RequiredArgsConstructor
@Slf4j
public class RouteQueryController {

    private final OdsayRouteService odsayRouteService;

    @GetMapping("/pubtrans")
    public OdsayRouteService.RoutePolylineMultiResponse getPubTransRoute(
            @RequestParam("sx") double sx,
            @RequestParam("sy") double sy,
            @RequestParam("ex") double ex,
            @RequestParam("ey") double ey
    ) {
        log.info("[RouteQueryController] 요청 sx={}, sy={}, ex={}, ey={}", sx, sy, ex, ey);

        OdsayRouteService.RoutePolylineMultiResponse response =
                odsayRouteService.getBestPubTransRoute(sx, sy, ex, ey);

        log.info("[RouteQueryController] 응답 routes.size={}",
                response.getRoutes() != null ? response.getRoutes().size() : 0);

        return response;
    }
}