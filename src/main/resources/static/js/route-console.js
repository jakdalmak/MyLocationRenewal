// src/main/resources/static/js/route-console.js

let routeMap;
let routePolyline = null;
let startMarker = null;
let endMarker = null;

function initRouteConsole() {
    const mapContainer = document.getElementById("map");

    // 초기 center는 대충 서울 한가운데
    const center = new kakao.maps.LatLng(37.56, 126.97);

    routeMap = new kakao.maps.Map(mapContainer, {
        center: center,
        level: 8,
    });

    // 버튼 이벤트
    document
        .getElementById("btn-set-seoul-gimpo")
        .addEventListener("click", fillSeoulGimpo);

    document
        .getElementById("btn-search-route")
        .addEventListener("click", requestRouteFromServer);
}

function fillSeoulGimpo() {
    // 서버에서 주는 기본값과 일치시키거나, 여기서 하드코딩해도 됨
    document.getElementById("startLat").value = 37.553441;    // 서울역(공항철도) 근처
    document.getElementById("startLng").value = 126.9696769;
    document.getElementById("endLat").value = 37.56306;       // 김포공항역 근처
    document.getElementById("endLng").value = 126.80083;
}

async function requestRouteFromServer() {
    const startLat = parseFloat(document.getElementById("startLat").value);
    const startLng = parseFloat(document.getElementById("startLng").value);
    const endLat = parseFloat(document.getElementById("endLat").value);
    const endLng = parseFloat(document.getElementById("endLng").value);

    if (
        Number.isNaN(startLat) ||
        Number.isNaN(startLng) ||
        Number.isNaN(endLat) ||
        Number.isNaN(endLng)
    ) {
        alert("위도/경도를 모두 입력해주세요.");
        return;
    }

    // ODsay는 SX=경도, SY=위도, EX=경도, EY=위도
    const params = new URLSearchParams({
        sx: startLng,
        sy: startLat,
        ex: endLng,
        ey: endLat,
    });

    try {
        const res = await fetch(`/api/console/route/pubtrans?` + params.toString());
        if (!res.ok) {
            const text = await res.text();
            console.error("route error:", text);
            alert("경로 조회 실패: " + res.status);
            return;
        }
        const data = await res.json();
        drawRouteOnMap(data, { startLat, startLng, endLat, endLng });
    } catch (e) {
        console.error(e);
        alert("경로 조회 중 오류가 발생했습니다.");
    }
}

function drawRouteOnMap(data, { startLat, startLng, endLat, endLng }) {
    const points = data.points || [];
    const summary = data.summary;

    if (!points.length) {
        alert("경로 좌표가 없습니다.");
        return;
    }

    // 1) 기존 Polyline / 마커 제거
    if (routePolyline) {
        routePolyline.setMap(null);
        routePolyline = null;
    }
    if (startMarker) {
        startMarker.setMap(null);
        startMarker = null;
    }
    if (endMarker) {
        endMarker.setMap(null);
        endMarker = null;
    }

    // 2) Polyline path 생성
    const path = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));

    routePolyline = new kakao.maps.Polyline({
        map: routeMap,
        path: path,
        strokeWeight: 5,
        strokeColor: "#ff0000",
        strokeOpacity: 0.8,
        strokeStyle: "solid",
    });

    // 3) 출발/도착 마커
    const startPos = new kakao.maps.LatLng(startLat, startLng);
    const endPos = new kakao.maps.LatLng(endLat, endLng);

    startMarker = new kakao.maps.Marker({
        map: routeMap,
        position: startPos,
    });

    endMarker = new kakao.maps.Marker({
        map: routeMap,
        position: endPos,
    });

    // 4) bounds 맞추기
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach((latlng) => bounds.extend(latlng));
    routeMap.setBounds(bounds);

    // 5) 요약정보 표기
    const summaryDiv = document.getElementById("route-summary");
    if (summary) {
        summaryDiv.innerHTML =
            `<hr style="margin:8px 0;">` +
            `<div><strong>경로 요약</strong></div>` +
            `<div>총 소요시간: ${summary.totalTime}분</div>` +
            `<div>총 요금: ${summary.payment.toLocaleString()}원</div>` +
            `<div>버스 환승: ${summary.busTransitCount}회 / ` +
            `지하철 환승: ${summary.subwayTransitCount}회</div>`;
    } else {
        summaryDiv.innerHTML = "";
    }
}
