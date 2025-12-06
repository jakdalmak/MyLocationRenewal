package com.jakdalmak.MyLocation.route.dto;

import java.util.List;

public record RoutePolylineResponse(
        RouteSummaryDto summary,
        List<LatLngDto> points
) {}