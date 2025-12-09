// ============================
// route-console.js (전체 전문)
// ============================

let routeMap;

// 출발/도착 마커
let startMarker = null;
let endMarker = null;

// 마커 이미지들 (SVG 물방울)
let startMarkerImage = null;
let endMarkerImage = null;
let transferMarkerImage = null;

// 경로 polyline 들
let routePolylines = [];
let routePolylineGroups = [];

// 서버에서 내려온 경로 후보들
let routeCandidates = [];
let activeRouteIndex = 0;

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

    // 초기 center는 대충 서울 중심
    const center = new kakao.maps.LatLng(37.56, 126.97);

    routeMap = new kakao.maps.Map(mapContainer, {
        center: center,
        level: 8,
    });

    if (kakao.maps.services && kakao.maps.services.Geocoder) {
        routeGeocoder = new kakao.maps.services.Geocoder();
    }
    routeInfoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });

    // SVG 마커 이미지 생성
    startMarkerImage = createPinMarkerImage("#2563eb"); // 파랑
    endMarkerImage = createPinMarkerImage("#ef4444");   // 빨강
    transferMarkerImage = createPinMarkerImage("#a855f7"); // 보라

    document.getElementById("btn-set-seoul-gimpo")
        .addEventListener("click", () => {
            fillSeoulGimpo();
            clearRouteVisualization();
        });

    document.getElementById("btn-search-route")
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

        clearRouteVisualization();
        setActivePinMode(null);
    });

    placeInitialMarkersFromInputs();
    loadRouteSpots();

    window.addEventListener("resize", function () {
        setTimeout(() => {
            routeMap.relayout();
        }, 100);
    });
}

/* ===================== 마커/모드 유틸 ===================== */

function createPinMarkerImage(color) {
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">` +
        `<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">` +
        `<feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000" flood-opacity="0.25"/>` +
        `</filter></defs>` +
        `<path filter="url(#shadow)" d="M16 2C9.9 2 5 7 5 13.1c0 6.9 7 14.4 10.1 17.2a1.3 1.3 0 0 0 1.8 0C20 27.5 27 20 27 13.1 27 7 22.1 2 16 2z" fill="${color}" stroke="#ffffff" stroke-width="2"/>` +
        `<circle cx="16" cy="14" r="4.5" fill="#ffffff" fill-opacity="0.9"/>` +
        `</svg>`;

    const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(
        url,
        new kakao.maps.Size(32, 40),
        { offset: new kakao.maps.Point(16, 40) }
    );
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

    // 두 마커가 모두 존재하면 지도 bounds 맞추기
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
        startMarker = new kakao.maps.Marker({
            map: routeMap,
            position: pos,
            image: startMarkerImage,
        });
    } else {
        startMarker.setPosition(pos);
        startMarker.setMap(routeMap);
    }
}

function setEndMarker(lat, lng) {
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!endMarker) {
        endMarker = new kakao.maps.Marker({
            map: routeMap,
            position: pos,
            image: endMarkerImage,
        });
    } else {
        endMarker.setPosition(pos);
        endMarker.setMap(routeMap);
    }
}

function setActivePinMode(mode) {
    activePinMode = mode;

    const startBtn = document.getElementById("btn-start-pin-mode");
    const endBtn = document.getElementById("btn-end-pin-mode");

    if (startBtn) startBtn.classList.toggle("pin-toggle-btn--active", mode === "start");
    if (endBtn) endBtn.classList.toggle("pin-toggle-btn--active", mode === "end");
}

/* ===================== 경로 초기화/환승 토글 ===================== */

function clearRoutePolylines() {
    routePolylines.forEach((pl) => pl.setMap(null));
    routePolylines = [];
    routePolylineGroups = [];
    routeCandidates = [];
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
    if (btnToggleTransfers) btnToggleTransfers.textContent = "환승 핀 표시하기";
}

function toggleTransferMarkers() {
    const btn = document.getElementById("btn-toggle-transfers");
    if (!btn) return;

    if (!lastRouteTransfers || lastRouteTransfers.length === 0) {
        alert("표시할 환승 지점이 없습니다.");
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

    const params = new URLSearchParams({
        sx: startLng,
        sy: startLat,
        ex: endLng,
        ey: endLat,
    });

    try {
        const res = await fetch(`/api/console/route/pubtrans?` + params.toString());
        if (!res.ok) {
            const msg = await res.text();
            console.error(msg);
            alert("경로 조회 실패");
            return;
        }

        const data = await res.json();
        console.log("[route] server response:", data);
        drawRouteOnMap(data, { startLat, startLng, endLat, endLng });

    } catch (err) {
        console.error(err);
        alert("경로 조회 중 오류가 발생했습니다.");
    }
}

/* ===================== 지도에 경로 표시 ===================== */

function drawRouteOnMap(data, { startLat, startLng, endLat, endLng }) {
    clearRouteVisualization();

    setStartMarker(startLat, startLng);
    setEndMarker(endLat, endLng);

    let routes = [];
    if (Array.isArray(data.routes) && data.routes.length > 0) {
        routes = data.routes;
    } else if (data.summary || data.points || data.segments) {
        routes = [data];
    } else {
        alert("서버에서 받은 데이터 없음.");
        return;
    }

    routeCandidates = routes;
    routePolylineGroups = [];
    routePolylines = [];
    activeRouteIndex = 0;

    const bounds = new kakao.maps.LatLngBounds();
    let hasBounds = false;

    routes.forEach((route, routeIdx) => {
        const segs = Array.isArray(route.segments) ? route.segments : null;
        const points = Array.isArray(route.points) ? route.points : [];
        const group = [];

        if (segs && segs.length > 0) {
            segs.forEach((seg, idx) => {
                if (!Array.isArray(seg.points) || seg.points.length === 0) return;

                const path = seg.points.map(p => new kakao.maps.LatLng(p.lat, p.lng));

                const isActive = (routeIdx === activeRouteIndex);
                const color = isActive ? getSegmentColor(seg.type) : "#d1d5db";
                const weight = isActive ? 5 : 3;
                const opacity = isActive ? 0.9 : 0.5;

                console.log(`[segment] route=${routeIdx}, type=${seg.type}, pts=${seg.points.length}`);

                const polyline = new kakao.maps.Polyline({
                    map: routeMap,
                    path: path,
                    strokeWeight: weight,
                    strokeColor: color,
                    strokeOpacity: opacity,
                    strokeStyle: "solid",
                });

                group.push({ polyline, type: seg.type });
                routePolylines.push(polyline);

                path.forEach((pt) => {
                    bounds.extend(pt);
                    hasBounds = true;
                });
            });
        } else if (points.length > 0) {
            const path = points.map(p => new kakao.maps.LatLng(p.lat, p.lng));
            const isActive = (routeIdx === activeRouteIndex);
            const color = isActive ? "#ef4444" : "#d1d5db";

            const polyline = new kakao.maps.Polyline({
                map: routeMap,
                path: path,
                strokeWeight: 5,
                strokeColor: color,
                strokeOpacity: 0.8,
            });

            group.push({ polyline, type: "LINE" });
            routePolylines.push(polyline);

            path.forEach((pt) => bounds.extend(pt));
            hasBounds = true;
        }

        routePolylineGroups.push(group);
    });

    if (hasBounds) {
        routeMap.setBounds(bounds);
    }

    const activeRoute = routeCandidates[activeRouteIndex] || {};
    lastRouteTransfers = Array.isArray(activeRoute.transferPoints)
        ? activeRoute.transferPoints
        : [];

    transfersVisible = false;

    const btnToggleTransfers = document.getElementById("btn-toggle-transfers");
    if (btnToggleTransfers) btnToggleTransfers.textContent = "환승 핀 표시하기";

    renderRouteSummary();
}

/* ===================== segment 색상 ===================== */

function getSegmentColor(type) {
    const t = String(type || "").toUpperCase();

    if (t === "BUS") return "#10b981";       // 초록
    if (t === "SUBWAY") return "#6366f1";   // 남색
    if (t === "WALK") return "#6b7280";     // 회색

    return "#ef4444"; // 기타: 빨강
}

/* ===================== UI 렌더링 (요약/상세/탭) ===================== */

function renderRouteSummary() {
    const summaryDiv = document.getElementById("route-summary");
    if (!summaryDiv) return;

    if (routeCandidates.length === 0) {
        summaryDiv.innerHTML = "";
        return;
    }

    const activeRoute = routeCandidates[activeRouteIndex];
    const summary = activeRoute.summary;
    const steps = Array.isArray(activeRoute.steps) ? activeRoute.steps : [];

    let html = "";

    if (routeCandidates.length > 1) {
        html += `<div style="margin:4px 0 8px; display:flex; flex-wrap:wrap; gap:4px;">`;
        routeCandidates.forEach((route, idx) => {
            const s = route.summary;
            const time = s ? `${s.totalTime}분` : "";
            const fee = s ? `${s.payment.toLocaleString()}원` : "";
            const isActive = idx === activeRouteIndex;
            const style = isActive
                ? "background:#111827;color:#f9fafb;border-color:#111827;"
                : "background:#f3f4f6;color:#111827;border-color:#d1d5db;";

            html +=
                `<button type="button" class="route-tab-btn" data-route-idx="${idx}"` +
                ` style="border-radius:999px;border:1px solid;padding:3px 8px;font-size:11px;cursor:pointer;${style}">` +
                `경로 ${idx + 1} · ${time}/${fee}</button>`;
        });
        html += `</div>`;
    }

    if (!summary) {
        summaryDiv.innerHTML = html;
        return;
    }

    html += `<hr style="margin:8px 0;">`;
    html += `<div><strong>경로 요약 (경로 ${activeRouteIndex + 1})</strong></div>`;
    html += `<div>총 소요시간: ${summary.totalTime}분</div>`;
    html += `<div>총 요금: ${summary.payment.toLocaleString()}원</div>`;
    html += `<div>버스 환승: ${summary.busTransitCount}회 / 지하철 환승: ${summary.subwayTransitCount}회</div>`;

    if (steps.length > 0) {
        html += `<details open class="route-steps"><summary>상세 경로</summary><ol>`;
        steps.forEach((step) => {
            const type = step.type.toUpperCase();
            const tag =
                type === "BUS" ? "버스" :
                    type === "SUBWAY" ? "지하철" :
                        type === "WALK" ? "도보" : "기타";

            let tagClass = "";
            if (type === "BUS") tagClass = "bus";
            if (type === "SUBWAY") tagClass = "subway";
            if (type === "WALK") tagClass = "walk";

            const line = step.lineName ? ` ${step.lineName}` : "";
            const extra = [];
            if (step.stationCount > 0) extra.push(`${step.stationCount}정거장`);
            if (step.sectionTime > 0) extra.push(`${step.sectionTime}분`);
            const extraText = extra.length ? ` (${extra.join(" / ")})` : "";

            html += `<li><span class="route-step-tag ${tagClass}">${tag}</span>`;
            html += `${step.startName} → ${step.endName}${line}${extraText}</li>`;
        });
        html += `</ol></details>`;
    }

    summaryDiv.innerHTML = html;

    if (routeCandidates.length > 1) {
        const tabs = summaryDiv.querySelectorAll(".route-tab-btn");
        tabs.forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.getAttribute("data-route-idx"), 10);
                setActiveRoute(idx);
            });
        });
    }
}

/* ===================== 포커스 경로 변경 ===================== */

function setActiveRoute(index) {
    if (index < 0 || index >= routeCandidates.length) return;

    activeRouteIndex = index;

    routePolylineGroups.forEach((group, rIdx) => {
        const isActive = rIdx === activeRouteIndex;
        group.forEach(({ polyline, type }) => {
            const color = isActive ? getSegmentColor(type) : "#d1d5db";
            const weight = isActive ? 5 : 3;
            const opacity = isActive ? 0.9 : 0.4;
            polyline.setOptions({
                strokeColor: color,
                strokeWeight: weight,
                strokeOpacity: opacity,
            });
        });
    });

    clearTransferMarkers();
    const activeRoute = routeCandidates[activeRouteIndex];
    lastRouteTransfers = Array.isArray(activeRoute.transferPoints)
        ? activeRoute.transferPoints
        : [];

    transfersVisible = false;

    const btn = document.getElementById("btn-toggle-transfers");
    if (btn) btn.textContent = "환승 핀 표시하기";

    renderRouteSummary();
}

/* ===================== Spot 목록 ===================== */

function loadRouteSpots() {
    const tbody = document.getElementById("route-spot-table-body");
    const emptyMsg = document.getElementById("route-spot-empty");

    fetch("/api/console/spots")
        .then(r => r.json())
        .then(spots => {
            routeSpots = spots || [];
            renderRouteSpotTable(spots);
            renderRouteSpotMarkers(spots);

            if (spots.length === 0) {
                emptyMsg.style.display = "block";
            } else {
                emptyMsg.style.display = "none";
            }
        })
        .catch(err => {
            console.error("[spot] error:", err);
            tbody.innerHTML = "";
            emptyMsg.style.display = "block";
            emptyMsg.textContent = "스팟 API 응답 없음.";
        });
}

function renderRouteSpotTable(spots) {
    const tbody = document.getElementById("route-spot-table-body");

    tbody.innerHTML = "";

    spots.forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
            `<td>${s.id}</td>` +
            `<td>${s.name}</td>` +
            `<td>${Number(s.lat).toFixed(5)}</td>` +
            `<td>${Number(s.lon).toFixed(5)}</td>` +
            `<td>${s.locationWidth}</td>`;

        tr.addEventListener("click", () => focusRouteSpot(s));
        tbody.appendChild(tr);
    });
}

function renderRouteSpotMarkers(spots) {
    routeSpotMarkers.forEach(m => m.setMap(null));
    routeSpotMarkers = [];
    routeSpotMarkerMap = {};

    spots.forEach((s) => {
        const latlng = new kakao.maps.LatLng(Number(s.lat), Number(s.lon));
        const marker = new kakao.maps.Marker({ map: routeMap, position: latlng });
        routeSpotMarkers.push(marker);
        routeSpotMarkerMap[s.id] = marker;

        kakao.maps.event.addListener(marker, "click", () => focusRouteSpot(s));
    });
}

function focusRouteSpot(spot) {
    const latlng = new kakao.maps.LatLng(Number(spot.lat), Number(spot.lon));
    routeMap.setCenter(latlng);
    openRouteSpotInfo(spot);
}

function openRouteSpotInfo(spot) {
    let html =
        `<div style="padding:8px 10px;min-width:190px;">` +
        `<div style="font-weight:600;font-size:13px;margin-bottom:4px;">${spot.name}</div>` +
        `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;">주소 조회 중...</div>` +
        `<div style="font-size:11px;color:#9ca3af;">반경 ${spot.locationWidth} m</div>` +
        `</div>`;

    const latlng = new kakao.maps.LatLng(Number(spot.lat), Number(spot.lon));
    const marker = routeSpotMarkerMap[spot.id];

    routeInfoWindow.setContent(html);
    routeInfoWindow.open(routeMap, marker ?? latlng);

    if (!routeGeocoder) return;

    routeGeocoder.coord2Address(
        spot.lon,
        spot.lat,
        (result, status) => {
            if (status !== kakao.maps.services.Status.OK) return;

            const addrObj = result[0];
            const addr = addrObj.road_address
                ? addrObj.road_address.address_name
                : addrObj.address.address_name;

            html =
                `<div style="padding:8px 10px;min-width:190px;">` +
                `<div style="font-weight:600;font-size:13px;margin-bottom:4px;">${spot.name}</div>` +
                `<div style="font-size:11px;color:#111827;margin-bottom:4px;">${addr}</div>` +
                `<div style="font-size:11px;color:#9ca3af;">반경 ${spot.locationWidth} m</div>` +
                `</div>`;

            routeInfoWindow.setContent(html);
            routeInfoWindow.open(routeMap, marker ?? latlng);
        }
    );
}

/* ===================== 공통 유틸 ===================== */

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
