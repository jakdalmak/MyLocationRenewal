# ============ 1단계: Build Stage ==========================
FROM gradle:8.13-jdk21 AS builder
WORKDIR /app
COPY --chown=gradle:gradle . .
RUN gradle clean build -x test --no-daemon

# ============ 2단계: Runtime Stage ==========================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /
COPY --from=builder /app/build/libs/*.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]