// src/main/resources/static/js/route-console.js

let routeMap;
let routePolyline = null;
let startMarker = null;
let endMarker = null;

// 출발/도착 핀 색상을 구분하기 위한 MarkerImage
let startMarkerImage = null;
let endMarkerImage = null;

// 현재 "핀 위치 변경" 모드 상태: 'start' | 'end' | null
let activePinMode = null;

// 스팟 목록/마커 (spot-console와 비슷한 구조)
let routeSpots = [];
let routeSpotMarkers = [];
let routeSpotMarkerMap = {}; // spotId -> Marker
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

    // 지오코더 / 인포윈도우 (스팟 InfoWindow용)
    if (kakao.maps.services && kakao.maps.services.Geocoder) {
        routeGeocoder = new kakao.maps.services.Geocoder();
    }
    routeInfoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });

    // 출발/도착 핀용 이미지 준비 (SVG data URL)
    startMarkerImage = createColoredPinImage("#2563eb"); // 파란색
    endMarkerImage = createColoredPinImage("#ef4444");   // 빨간색

    // 버튼 이벤트
    document
        .getElementById("btn-set-seoul-gimpo")
        .addEventListener("click", () => {
            fillSeoulGimpo();
            // 좌표가 바뀌었으니 기존 경로는 초기화
            clearRouteVisualization();
        });

    document
        .getElementById("btn-search-route")
        .addEventListener("click", () => {
            // 경로 조회 시에는 핀 위치 변경 모드 해제
            setActivePinMode(null);
            requestRouteFromServer();
        });

    const btnStartPinMode = document.getElementById("btn-start-pin-mode");
    const btnEndPinMode = document.getElementById("btn-end-pin-mode");

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

    // 지도 클릭 시: 활성화된 핀 모드에 따라 출발/도착 핀 이동
    kakao.maps.event.addListener(routeMap, "click", function (mouseEvent) {
        if (!activePinMode) {
            return;
        }
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

        // 좌표가 변경되었으니 기존 경로/요약은 초기화
        clearRouteVisualization();

        // 지도를 한 번 클릭하면 핀 변경 모드 해제
        setActivePinMode(null);
    });

    // 페이지 진입 시 기본값(th:value) 기준으로 핀 생성
    placeInitialMarkersFromInputs();

    // Spot 콘솔과 공유할 스팟 목록 UI 미리 구성
    loadRouteSpots();

    // 리사이즈 시 화면 재배치
    window.addEventListener("resize", function () {
        setTimeout(function () {
            routeMap.relayout();
        }, 100);
    });
}

/* ===================== 공통 유틸 ===================== */

// 컬러 SVG를 data URL로 만드는 간단한 핀 이미지
function createColoredPinImage(color) {
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
        `<circle cx="16" cy="16" r="7" fill="${color}" stroke="white" stroke-width="2"/>` +
        `</svg>`;
    const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    const size = new kakao.maps.Size(32, 32);
    const option = {
        offset: new kakao.maps.Point(16, 16),
    };
    return new kakao.maps.MarkerImage(url, size, option);
}

// 출발/도착 핀 위치를 input 값 기준으로 한 번 그려줌
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

    // 둘 다 있으면 화면 bounds 맞추기
    if (startMarker && endMarker) {
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(startMarker.getPosition());
        bounds.extend(endMarker.getPosition());
        routeMap.setBounds(bounds);
    }
}

// 출발 핀 설정/업데이트
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

// 도착 핀 설정/업데이트
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

// 핀 위치 변경 모드 토글 (동일 버튼 재클릭으로 해제는 하지 않고, 요구사항대로 반대 버튼/지도 클릭으로만 해제)
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

// 기존 경로와 요약 정보만 초기화 (핀은 유지)
function clearRouteVisualization() {
    if (routePolyline) {
        routePolyline.setMap(null);
        routePolyline = null;
    }
    const summaryDiv = document.getElementById("route-summary");
    if (summaryDiv) {
        summaryDiv.innerHTML = "";
    }
}

/* ===================== 좌표 세팅 기본값 ===================== */

function fillSeoulGimpo() {
    // 서버에서 주는 기본값과 일치시키거나, 여기서 하드코딩해도 됨
    const startLat = 37.553441;    // 서울역(공항철도) 근처
    const startLng = 126.9696769;
    const endLat = 37.56306;       // 김포공항역 근처
    const endLng = 126.80083;

    document.getElementById("startLat").value = startLat;
    document.getElementById("startLng").value = startLng;
    document.getElementById("endLat").value = endLat;
    document.getElementById("endLng").value = endLng;

    setStartMarker(startLat, startLng);
    setEndMarker(endLat, endLng);

    // 처음부터 두 핀이 다 보이도록 bounds
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

    // 출발/도착 마커는 새 경로 기준으로 다시 세팅
    setStartMarker(startLat, startLng);
    setEndMarker(endLat, endLng);

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

    // 3) bounds 맞추기
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach((latlng) => bounds.extend(latlng));
    routeMap.setBounds(bounds);

    // 4) 요약정보 표기
    const summaryDiv = document.getElementById("route-summary");
    if (summary) {
        const paymentText =
            typeof summary.payment === "number"
                ? summary.payment.toLocaleString()
                : summary.payment;

        summaryDiv.innerHTML =
            `<hr style="margin:8px 0;">` +
            `<div><strong>경로 요약</strong></div>` +
            `<div>총 소요시간: ${summary.totalTime}분</div>` +
            `<div>총 요금: ${paymentText}원</div>` +
            `<div>버스 환승: ${summary.busTransitCount}회 / ` +
            `지하철 환승: ${summary.subwayTransitCount}회</div>`;
    } else {
        summaryDiv.innerHTML = "";
    }
}

/* ===================== Spot 목록 UI (미리 구성) ===================== */

// Spot 콘솔에서 사용하는 JSON 구조와 동일하다고 가정:
// { id, name, lat, lon, locationWidth }
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
            if (tbody) {
                tbody.innerHTML = "";
            }
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

    if (!spots || spots.length === 0) {
        return;
    }

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
    // 기존 마커 제거
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

// 스팟 클릭 시: 지도 이동 + InfoWindow (이름, 주소, 반경)
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

    // Kakao Geocoder로 주소 역조회 (spot-console의 openSpotInfo와 동일한 느낌)
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

// 간단 XSS 방지용
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
