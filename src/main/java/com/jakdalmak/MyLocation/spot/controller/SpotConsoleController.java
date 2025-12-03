package com.jakdalmak.MyLocation.spot.controller;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * 핀 & 로케이션 콘솔 화면
 * GET /console/map/spots
 */
@Controller
@RequestMapping("/console/map/spots")
public class SpotConsoleController {

    private final String kakaoMapJsKey;

    public SpotConsoleController(
            @Value("${kakao.map.javascript-key}") String kakaoMapJsKey
    ) {
        this.kakaoMapJsKey = kakaoMapJsKey;
    }

    @GetMapping
    public String showSpotConsole(Model model) {
        model.addAttribute("kakaoMapJsKey", kakaoMapJsKey);
        return "spot-console"; // templates/map/spot-console.html
    }
}