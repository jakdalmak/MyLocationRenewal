package com.jakdalmak.MyLocation.map.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequiredArgsConstructor
@RequestMapping("/console/map")
public class MapConsoleController {

    // application.yml / properties 에서 키를 주입받음
    @Value("${kakao.map.javascript-key}")
    private String kakaoMapJsKey;

    @GetMapping
    public String showMapConsole(Model model) {
        model.addAttribute("kakaoMapJsKey", kakaoMapJsKey);
        return "map-console"; // templates/map-console.html
    }
}