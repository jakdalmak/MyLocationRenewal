// src/main/resources/static/js/route-console.js

let routeMap;

// 출발/도착 마커
let startMarker = null;
let endMarker = null;

// 마커 이미지들
let startMarkerImage = null;
let endMarkerImage = null;
let transferMarkerImage = null;

// 경로 polyline 들 (버스/지하철/도보 구간별)
let routePolylines = [];

// 환승 마커
let transferMarkers = [];
let transfersVisible = false;
let lastRouteTransfers = [];

// "핀 위치 변경" 모드: 'start' | 'end' | null
let activePinMode = null;

// 스팟 목록/마커 (spot-console 미리보기용)
let routeSpots = [];
let routeSpotMarkers = [];
let routeSpotMarkerMap = {};
let routeGeocoder = null;
let routeInfoWindow = null;

function initRouteConsole() {
    const mapContainer = document.getElementById("map");

    if (!mapContainer || !window.kakao || !kakao.maps) {
        console.error("KakaoMap SDK 또는 컨테이너가 없습니다 (route console).");
        return;
    }

    // 초기 center는 대충 서울 한가운데
    const center = new kakao.maps.LatLng(37.56, 126.97);

    routeMap = new kakao.maps.Map(mapContainer, {
        center: center,
        level: 8,
    });

    // 지오코더 / 인포윈도우
    if (kakao.maps.services && kakao.maps.services.Geocoder) {
        routeGeocoder = new kakao.maps.services.Geocoder();
    }
    routeInfoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });

    // 출발/도착/환승용 마커 이미지 생성
    startMarkerImage = createPinMarkerImage("#2563eb"); // 파랑: 출발
    endMarkerImage = createPinMarkerImage("#ef4444");   // 빨강: 도착
    transferMarkerImage = createPinMarkerImage("#a855f7"); // 별: 환승

    // 버튼 이벤트
    document
        .getElementById("btn-set-seoul-gimpo")
        .addEventListener("click", () => {
            fillSeoulGimpo();
            clearRouteVisualization();
        });

    document
        .getElementById("btn-search-route")
        .addEventListener("click", () => {
            setActivePinMode(null);
            requestRouteFromServer();
        });

    const btnStartPinMode = document.getElementById("btn-start-pin-mode");
    const btnEndPinMode = document.getElementById("btn-end-pin-mode");
    const btnToggleTransfers = document.getElementById("btn-toggle-transfers");

    if (btnStartPinMode) {
        btnStartPinMode.addEventListener("click", () => {
            setActivePinMode("start");
        });
    }
    if (btnEndPinMode) {
        btnEndPinMode.addEventListener("click", () => {
            setActivePinMode("end");
        });
    }
    if (btnToggleTransfers) {
        btnToggleTransfers.addEventListener("click", () => {
            toggleTransferMarkers();
        });
    }

    // 지도 클릭 시: 활성화된 핀 모드에 따라 출발/도착 핀 이동
    kakao.maps.event.addListener(routeMap, "click", function (mouseEvent) {
        if (!activePinMode) return;

        const latlng = mouseEvent.latLng;
        const lat = latlng.getLat();
        const lng = latlng.getLng();

        if (activePinMode === "start") {
            document.getElementById("startLat").value = lat.toFixed(6);
            document.getElementById("startLng").value = lng.toFixed(6);
            setStartMarker(lat, lng);
        } else if (activePinMode === "end") {
            document.getElementById("endLat").value = lat.toFixed(6);
            document.getElementById("endLng").value = lng.toFixed(6);
            setEndMarker(lat, lng);
        }

        // 좌표가 변경되었으니 기존 경로/요약/환승핀 초기화
        clearRouteVisualization();

        // 지도 한 번 클릭하면 핀 변경 모드 해제
        setActivePinMode(null);
    });

    // 페이지 진입 시 기본값(th:value) 기준으로 핀 생성
    placeInitialMarkersFromInputs();

    // Spot 콘솔과 공유할 스팟 목록 UI 미리 구성
    loadRouteSpots();

    // 리사이즈 시 지도 재배치
    window.addEventListener("resize", function () {
        setTimeout(function () {
            routeMap.relayout();
        }, 100);
    });
}

/* ===================== 마커/모드 유틸 ===================== */

/**
 * 카카오 기본 마커 이미지를 사용하도록 구현.
 *  #2563eb → 파란 핀 (출발)
 *  #ef4444 → 빨간 핀 (도착)
 *  그 외    → 별 모양 마커 (환승 등)
 */
function createPinMarkerImage(color) {
    let src;

    if (color === "#2563eb") {
        src = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png";
    } else if (color === "#ef4444") {
        src = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png";
    } else {
        src = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png";
    }

    const size = new kakao.maps.Size(24, 35);
    const option = {
        offset: new kakao.maps.Point(12, 35),
    };
    return new kakao.maps.MarkerImage(src, size, option);
}

function placeInitialMarkersFromInputs() {
    const startLat = parseFloat(document.getElementById("startLat").value);
    const startLng = parseFloat(document.getElementById("startLng").value);
    const endLat = parseFloat(document.getElementById("endLat").value);
    const endLng = parseFloat(document.getElementById("endLng").value);

    if (!Number.isNaN(startLat) && !Number.isNaN(startLng)) {
        setStartMarker(startLat, startLng);
    }
    if (!Number.isNaN(endLat) && !Number.isNaN(endLng)) {
        setEndMarker(endLat, endLng);
    }

    if (startMarker && endMarker) {
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(startMarker.getPosition());
        bounds.extend(endMarker.getPosition());
        routeMap.setBounds(bounds);
    }
}

function setStartMarker(lat, lng) {
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!startMarker) {
        const options = { map: routeMap, position: pos };
        if (startMarkerImage) options.image = startMarkerImage;
        startMarker = new kakao.maps.Marker(options);
    } else {
        startMarker.setPosition(pos);
        startMarker.setMap(routeMap);
    }
}

function setEndMarker(lat, lng) {
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!endMarker) {
        const options = { map: routeMap, position: pos };
        if (endMarkerImage) options.image = endMarkerImage;
        endMarker = new kakao.maps.Marker(options);
    } else {
        endMarker.setPosition(pos);
        endMarker.setMap(routeMap);
    }
}

function setActivePinMode(mode) {
    activePinMode = mode;
    const startBtn = document.getElementById("btn-start-pin-mode");
    const endBtn = document.getElementById("btn-end-pin-mode");

    if (startBtn) {
        startBtn.classList.toggle("pin-toggle-btn--active", mode === "start");
    }
    if (endBtn) {
        endBtn.classList.toggle("pin-toggle-btn--active", mode === "end");
    }
}

/* ===================== 경로 초기화/환승 토글 ===================== */

function clearRoutePolylines() {
    routePolylines.forEach((pl) => pl.setMap(null));
    routePolylines = [];
}

function clearTransferMarkers() {
    transferMarkers.forEach((m) => m.setMap(null));
    transferMarkers = [];
}

function clearRouteVisualization() {
    clearRoutePolylines();
    clearTransferMarkers();
    transfersVisible = false;
    lastRouteTransfers = [];

    const summaryDiv = document.getElementById("route-summary");
    if (summaryDiv) summaryDiv.innerHTML = "";

    const btnToggleTransfers = document.getElementById("btn-toggle-transfers");
    if (btnToggleTransfers) {
        btnToggleTransfers.textContent = "환승 핀 표시하기";
    }
}

function toggleTransferMarkers() {
    const btn = document.getElementById("btn-toggle-transfers");
    if (!btn) return;

    if (!lastRouteTransfers || lastRouteTransfers.length === 0) {
        alert("표시할 환승 지점이 없습니다.\n먼저 대중교통 경로를 조회하거나, 환승이 있는 경로인지 확인해주세요.");
        return;
    }

    if (!transfersVisible) {
        showTransferMarkers();
        transfersVisible = true;
        btn.textContent = "환승 핀 숨기기";
    } else {
        clearTransferMarkers();
        transfersVisible = false;
        btn.textContent = "환승 핀 표시하기";
    }
}

function showTransferMarkers() {
    clearTransferMarkers();
    if (!transferMarkerImage) return;

    lastRouteTransfers.forEach((tp) => {
        const lat = Number(tp.lat);
        const lng = Number(tp.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;

        const pos = new kakao.maps.LatLng(lat, lng);
        const marker = new kakao.maps.Marker({
            map: routeMap,
            position: pos,
            image: transferMarkerImage,
        });
        transferMarkers.push(marker);
    });
}

/* ===================== 기본 좌표 세팅 ===================== */

function fillSeoulGimpo() {
    // 서울역(공항철도) ↔ 김포공항역 예제
    const startLat = 37.553441;
    const startLng = 126.9696769;
    const endLat = 37.56306;
    const endLng = 126.80083;

    document.getElementById("startLat").value = startLat;
    document.getElementById("startLng").value = startLng;
    document.getElementById("endLat").value = endLat;
    document.getElementById("endLng").value = endLng;

    setStartMarker(startLat, startLng);
    setEndMarker(endLat, endLng);

    const bounds = new kakao.maps.LatLngBounds();
    bounds.extend(startMarker.getPosition());
    bounds.extend(endMarker.getPosition());
    routeMap.setBounds(bounds);
}

/* ===================== ODsay 경로 조회 ===================== */

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

// data: RoutePolylineResponse 확장 버전
function drawRouteOnMap(data, { startLat, startLng, endLat, endLng }) {
    const summary = data.summary || null;
    const segments = Array.isArray(data.segments) ? data.segments : null;
    const points = Array.isArray(data.points) ? data.points : [];
    const steps = Array.isArray(data.steps) ? data.steps : [];
    lastRouteTransfers = Array.isArray(data.transferPoints)
        ? data.transferPoints
        : [];

    // 기존 경로/요약/환승핀 초기화
    clearRouteVisualization();

    // 출발/도착 마커는 새 경로 기준으로 다시 세팅
    setStartMarker(startLat, startLng);
    setEndMarker(endLat, endLng);

    const bounds = new kakao.maps.LatLngBounds();
    let hasBounds = false;

    if (segments && segments.length > 0) {
        // 타입별 구간 polyline
        segments.forEach((seg, idx) => {
            if (!Array.isArray(seg.points) || seg.points.length === 0) {
                return;
            }

            const path = seg.points.map(
                (p) => new kakao.maps.LatLng(p.lat, p.lng)
            );

            const rawType = seg.type || seg.segmentType || "";
            const color = getSegmentColor(rawType);

            // 디버깅 로그
            console.log("segment", idx, "rawType=", rawType, "color=", color);

            const polyline = new kakao.maps.Polyline({
                map: routeMap,
                path: path,
                strokeWeight: 5,
                strokeColor: color,
                strokeOpacity: 0.9,
                strokeStyle: "solid",
            });

            routePolylines.push(polyline);
            path.forEach((latlng) => {
                bounds.extend(latlng);
                hasBounds = true;
            });
        });
    } else if (points.length > 0) {
        // 백엔드가 아직 segments를 안 내려주는 경우: 기존처럼 단일 빨간 선
        const path = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
        const polyline = new kakao.maps.Polyline({
            map: routeMap,
            path: path,
            strokeWeight: 5,
            strokeColor: "#ff0000",
            strokeOpacity: 0.8,
            strokeStyle: "solid",
        });
        routePolylines.push(polyline);
        path.forEach((latlng) => {
            bounds.extend(latlng);
            hasBounds = true;
        });
    }

    if (hasBounds) {
        routeMap.setBounds(bounds);
    }

    // 요약 + 상세 경로 렌더링
    renderRouteSummary(summary, steps);
}

/**
 * 경로 segment 타입에 따른 색상.
 *  - BUS / SUBWAY / WALK 문자열뿐 아니라
 *    혹시 숫자 코드(1,2,3...)가 넘어오는 경우도 함께 커버.
 */
function getSegmentColor(type) {
    const upper = String(type || "").toUpperCase();

    // 버스: BUS 또는 2,3,4,5
    if (
        upper === "BUS" ||
        upper === "2" ||
        upper === "3" ||
        upper === "4" ||
        upper === "5"
    ) {
        return "#10b981"; // green
    }

    // 지하철: SUBWAY 또는 1,6
    if (upper === "SUBWAY" || upper === "1" || upper === "6") {
        return "#6366f1"; // indigo
    }

    // 도보: WALK 또는 9
    if (upper === "WALK" || upper === "9") {
        return "#6b7280"; // gray
    }

    // 정체 모를 타입은 빨간색으로 눈에 띄게
    return "#ef4444";
}

function renderRouteSummary(summary, steps) {
    const summaryDiv = document.getElementById("route-summary");
    if (!summaryDiv) return;

    if (!summary) {
        summaryDiv.innerHTML = "";
        return;
    }

    const paymentText =
        typeof summary.payment === "number"
            ? summary.payment.toLocaleString()
            : summary.payment;

    let html =
        `<hr style="margin:8px 0;">` +
        `<div><strong>경로 요약</strong></div>` +
        `<div>총 소요시간: ${summary.totalTime}분</div>` +
        `<div>총 요금: ${paymentText}원</div>` +
        `<div>버스 환승: ${summary.busTransitCount}회 / ` +
        `지하철 환승: ${summary.subwayTransitCount}회</div>`;

    if (steps && steps.length > 0) {
        html += `<details class="route-steps" open>` +
            `<summary>상세 경로 (버스/지하철 순서)</summary>` +
            `<ol>`;
        steps.forEach((step) => {
            const typeUpper = String(step.type || "").toUpperCase();
            const isBus = typeUpper === "BUS";
            const tagClass = isBus ? "bus" : "subway";
            const tagLabel = isBus ? "버스" : "지하철";

            const lineName = step.lineName || "";
            const startName = step.startName || "";
            const endName = step.endName || "";
            const sectionTime =
                typeof step.sectionTime === "number" ? step.sectionTime : null;
            const stationCount =
                typeof step.stationCount === "number" ? step.stationCount : null;

            let lineInfo = lineName ? ` ${escapeHtml(lineName)}` : "";
            let extra = [];
            if (stationCount !== null) extra.push(`${stationCount}정거장`);
            if (sectionTime !== null) extra.push(`${sectionTime}분`);
            const extraText = extra.length ? ` (${extra.join(" / ")})` : "";

            html +=
                `<li>` +
                `<span class="route-step-tag ${tagClass}">${tagLabel}</span>` +
                `${escapeHtml(startName)} → ${escapeHtml(endName)}` +
                `${lineInfo}${extraText}` +
                `</li>`;
        });
        html += `</ol></details>`;
    }

    summaryDiv.innerHTML = html;
}

/* ===================== Spot 목록 UI (미리보기용) ===================== */

function loadRouteSpots() {
    const tbody = document.getElementById("route-spot-table-body");
    const emptyMsg = document.getElementById("route-spot-empty");
    if (!tbody) return;

    fetch("/api/console/spots")
        .then((resp) => {
            if (!resp.ok) {
                throw new Error("spot api not ready: " + resp.status);
            }
            return resp.json();
        })
        .then((spots) => {
            routeSpots = spots || [];
            renderRouteSpotTable(routeSpots);
            renderRouteSpotMarkers(routeSpots);

            if (routeSpots.length === 0) {
                if (emptyMsg) emptyMsg.style.display = "block";
            } else {
                if (emptyMsg) emptyMsg.style.display = "none";
            }
        })
        .catch((err) => {
            console.log("[route-spot] 스팟 목록을 불러오지 못했습니다.", err);
            if (tbody) tbody.innerHTML = "";
            if (emptyMsg) {
                emptyMsg.style.display = "block";
                emptyMsg.textContent =
                    "스팟 API를 아직 사용할 수 없습니다. (서버에서 /api/console/spots 구현 후 동작합니다.)";
            }
        });
}

function renderRouteSpotTable(spots) {
    const tbody = document.getElementById("route-spot-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!spots || spots.length === 0) return;

    spots.forEach((spot) => {
        const tr = document.createElement("tr");
        const latNum = Number(spot.lat);
        const lonNum = Number(spot.lon);

        tr.innerHTML = `
            <td>${spot.id}</td>
            <td class="spot-name-cell">${escapeHtml(spot.name)}</td>
            <td>${latNum.toFixed(5)}</td>
            <td>${lonNum.toFixed(5)}</td>
            <td>${spot.locationWidth}</td>
        `;

        tr.addEventListener("click", function () {
            focusRouteSpot(spot);
        });

        tbody.appendChild(tr);
    });
}

function renderRouteSpotMarkers(spots) {
    routeSpotMarkers.forEach((m) => m.setMap(null));
    routeSpotMarkers = [];
    routeSpotMarkerMap = {};

    if (!spots || spots.length === 0) return;

    spots.forEach((spot) => {
        const lat = Number(spot.lat);
        const lon = Number(spot.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;

        const latlng = new kakao.maps.LatLng(lat, lon);
        const marker = new kakao.maps.Marker({
            map: routeMap,
            position: latlng,
        });

        routeSpotMarkers.push(marker);
        routeSpotMarkerMap[spot.id] = marker;

        kakao.maps.event.addListener(marker, "click", function () {
            focusRouteSpot(spot);
        });
    });
}

function focusRouteSpot(spot) {
    const lat = Number(spot.lat);
    const lon = Number(spot.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    const latlng = new kakao.maps.LatLng(lat, lon);
    routeMap.setCenter(latlng);

    openRouteSpotInfo(spot);
}

function openRouteSpotInfo(spot) {
    if (!routeInfoWindow) {
        routeInfoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });
    }

    const lat = Number(spot.lat);
    const lon = Number(spot.lon);
    const latlng = new kakao.maps.LatLng(lat, lon);
    const marker = routeSpotMarkerMap[spot.id] || null;

    let html =
        `<div style="padding:8px 10px;min-width:190px;">` +
        `<div style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(
            spot.name
        )}</div>` +
        `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;">주소 조회 중...</div>` +
        `<div style="font-size:11px;color:#9ca3af;">반경 ${spot.locationWidth} m</div>` +
        `</div>`;

    routeInfoWindow.setContent(html);

    if (marker) {
        routeInfoWindow.open(routeMap, marker);
    } else {
        routeInfoWindow.setPosition(latlng);
        routeInfoWindow.open(routeMap);
    }

    if (!routeGeocoder) return;

    routeGeocoder.coord2Address(
        lon,
        lat,
        function (result, status) {
            if (status === kakao.maps.services.Status.OK && result && result.length > 0) {
                const addrObj = result[0];
                const address = addrObj.road_address
                    ? addrObj.road_address.address_name
                    : addrObj.address.address_name;

                html =
                    `<div style="padding:8px 10px;min-width:190px;">` +
                    `<div style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(
                        spot.name
                    )}</div>` +
                    `<div style="font-size:11px;color:#111827;margin-bottom:4px;">${escapeHtml(
                        address
                    )}</div>` +
                    `<div style="font-size:11px;color:#9ca3af;">반경 ${spot.locationWidth} m</div>` +
                    `</div>`;

                routeInfoWindow.setContent(html);
                if (marker) {
                    routeInfoWindow.open(routeMap, marker);
                } else {
                    routeInfoWindow.setPosition(latlng);
                    routeInfoWindow.open(routeMap);
                }
            }
        }
    );
}

/* ===================== 공통 유틸 ===================== */

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
