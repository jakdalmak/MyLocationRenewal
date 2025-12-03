// src/main/resources/static/js/map-console.js

// 전역 변수(필요 최소한만)
let map;
let currentMarker = null;
let clickMarker = null;

// document.addEventListener("DOMContentLoaded", function () {
//     initKakaoMapConsole();
// });

function initKakaoMapConsole() {
    const mapContainer = document.getElementById("map");
    if (!mapContainer || !window.kakao || !kakao.maps) {
        console.error("Kakao map container or SDK not loaded");
        return;
    }

    // 기본 중심(서울 시청 근처)
    const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780);

    map = new kakao.maps.Map(mapContainer, {
        center: defaultCenter,
        level: 4
    });

    logLine("[init] 카카오맵 초기화 완료");
    logLine(`       기본 중심: ${defaultCenter.getLat().toFixed(6)}, ${defaultCenter.getLng().toFixed(6)}`);

    // GeoLocation 시도
    initGeolocation(defaultCenter);

    // 지도 클릭 이벤트
    kakao.maps.event.addListener(map, "click", function (mouseEvent) {
        const latlng = mouseEvent.latLng;
        updateClickMarker(latlng);
    });

    // 리사이즈 대응 (선택)
    window.addEventListener("resize", function () {
        // 기본적으로 너비/높이가 flex 로 결정되므로, 레이아웃만 재계산
        setTimeout(function () {
            map.relayout();
        }, 100);
    });
}

// GeoLocation 초기화
function initGeolocation(defaultCenter) {
    const latSpan = document.getElementById("current-lat");
    const lngSpan = document.getElementById("current-lng");
    const statusBadge = document.getElementById("geo-status");

    if (!navigator.geolocation) {
        statusBadge.textContent = "지원 안 함";
        statusBadge.style.backgroundColor = "#fee2e2";
        statusBadge.style.color = "#b91c1c";

        logLine("[geo] 이 브라우저는 Geolocation을 지원하지 않습니다.");
        setCurrentMarker(defaultCenter, "기본 위치 (서울 시청 인근)");
        latSpan.textContent = defaultCenter.getLat().toFixed(6);
        lngSpan.textContent = defaultCenter.getLng().toFixed(6);
        return;
    }

    statusBadge.textContent = "시도 중...";
    logLine("[geo] 현재 위치를 가져오는 중입니다...");

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const locPosition = new kakao.maps.LatLng(lat, lng);

            setCurrentMarker(locPosition, "여기에 계신가요?!");
            map.setCenter(locPosition);

            latSpan.textContent = lat.toFixed(6);
            lngSpan.textContent = lng.toFixed(6);

            statusBadge.textContent = "성공";
            statusBadge.style.backgroundColor = "#dcfce7";
            statusBadge.style.color = "#166534";

            logLine(`[geo] 위치 획득 성공: lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}`);
        },
        function (error) {
            statusBadge.textContent = "실패";
            statusBadge.style.backgroundColor = "#fee2e2";
            statusBadge.style.color = "#b91c1c";

            logLine(`[geo] 위치 획득 실패: code=${error.code}, message=${error.message}`);
            logLine("[geo] 기본 중심 좌표를 사용합니다.");

            setCurrentMarker(defaultCenter, "기본 위치 (서울 시청 인근)");
            map.setCenter(defaultCenter);
        }
    );
}

// 현재 위치 마커/인포윈도우
function setCurrentMarker(position, message) {
    if (!map) return;

    if (!currentMarker) {
        currentMarker = new kakao.maps.Marker({
            map: map,
            position: position
        });
    } else {
        currentMarker.setPosition(position);
    }

    const infowindow = new kakao.maps.InfoWindow({
        content: `<div style="padding:5px;font-size:12px;">${message}</div>`
    });
    infowindow.open(map, currentMarker);
}

// 지도 클릭 마커
function updateClickMarker(latlng) {
    if (!map) return;

    if (!clickMarker) {
        clickMarker = new kakao.maps.Marker({
            map: map,
            position: latlng
        });
    } else {
        clickMarker.setPosition(latlng);
    }

    const latSpan = document.getElementById("last-click-lat");
    const lngSpan = document.getElementById("last-click-lng");

    latSpan.textContent = latlng.getLat().toFixed(6);
    lngSpan.textContent = latlng.getLng().toFixed(6);

    logLine(`[click] 지도 클릭: lat=${latlng.getLat().toFixed(6)}, lng=${latlng.getLng().toFixed(6)}`);
}

// 우측 콘솔 로그에 라인 추가
function logLine(message) {
    const logEl = document.getElementById("console-log");
    if (!logEl) {
        console.log(message);
        return;
    }

    const div = document.createElement("div");
    div.className = "line";
    const timestamp = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    div.textContent = `[${timestamp}] ${message}`;
    logEl.appendChild(div);

    // 스크롤 가장 아래로
    logEl.scrollTop = logEl.scrollHeight;
}
