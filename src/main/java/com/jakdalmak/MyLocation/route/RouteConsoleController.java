package com.jakdalmak.MyLocation.route;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class RouteConsoleController {

    private final String kakaoMapJsKey;

    public RouteConsoleController(
            @Value("${kakao.map.javascript-key}") String kakaoMapJsKey
    ) {
        this.kakaoMapJsKey = kakaoMapJsKey;
    }

    @GetMapping("/console/route")
    public String routeConsole(Model model) {
        model.addAttribute("kakaoMapJsKey", kakaoMapJsKey);

        // 서울역(공항철도) 근처
        model.addAttribute("defaultStartLat", 37.553441);
        model.addAttribute("defaultStartLng", 126.9696769);

        // 김포공항역 근처
        model.addAttribute("defaultEndLat", 37.56306);
        model.addAttribute("defaultEndLng", 126.80083);

        return "route-console";
    }
}