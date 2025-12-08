package com.jakdalmak.MyLocation.common.swagger;


import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI myLocationOpenAPI() {
        return new OpenAPI()
                .components(new Components())
                .info(new Info()
                        .title("MyLocation API")
                        .description("지자체 주소 작업 및 Spot 관련 API 문서")
                        .version("v1.0.0"));
    }
}
