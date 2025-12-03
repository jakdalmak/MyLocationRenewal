// 핀 콘솔용 JS v1.4 (핀 사라짐 + 자동 센터 이동 제거 버전)

let spotMap;
let userLocation = null;

// 현재 선택된 기준점(핀 / 로케이션 중심)
let currentPoint = null;        // kakao.maps.LatLng
let currentRadius = null;       // m

// 새 핀 지정용 마커 + 반경 원
let clickMarker = null;
let radiusCircle = null;

// 저장된 스팟용 마커들
let spotMarkers = [];
let spotMarkerMap = {};         // spotId -> Marker

// 카카오 서비스
let geocoder = null;
let infoWindow = null;
let placesService = null;

function initSpotConsole() {
    const mapContainer = document.getElementById("spot-map");
    if (!mapContainer || !window.kakao || !kakao.maps) {
        console.error("Kakao map container or SDK not loaded (spot console)");
        return;
    }

    const defaultCenter = new kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청

    spotMap = new kakao.maps.Map(mapContainer, {
        center: defaultCenter,
        level: 4
    });

    // Kakao 서비스 준비
    geocoder = new kakao.maps.services.Geocoder();
    if (kakao.maps.services && kakao.maps.services.Places) {
        placesService = new kakao.maps.services.Places();
    }
    infoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });

    // 반경 초기값 세팅
    const radiusInput = document.getElementById("spot-radius");
    const initRadius = getRadiusFromInput();
    currentRadius = (initRadius && initRadius > 0) ? initRadius : 500;
    if (radiusInput && (!radiusInput.value || parseInt(radiusInput.value, 10) <= 0)) {
        radiusInput.value = currentRadius;
    }

    initGeolocation(defaultCenter);
    bindFormEvents();
    bindSearchEvents();
    bindMapClick();
    loadSpots();

    window.addEventListener("resize", function () {
        setTimeout(function () {
            spotMap.relayout();
        }, 100);
    });
}

/* ===================== 공통 상태 & 유틸 ===================== */

// 현재 기준 좌표 설정 + 마커/원 갱신
function setCurrentPoint(latlng, options) {
    options = options || {};
    const updateForm = options.updateForm !== false;
    // ✅ 기본값: moveCenter = false (명시적으로 true 넘길 때만 센터 이동)
    const moveCenter = options.moveCenter === true;

    currentPoint = latlng;

    // 폼에 좌표 쓰기
    if (updateForm) {
        const latInput = document.getElementById("spot-lat");
        const lonInput = document.getElementById("spot-lon");
        if (latInput && lonInput) {
            latInput.value = latlng.getLat().toFixed(6);
            lonInput.value = latlng.getLng().toFixed(6);
        }
    }

    // 새 핀(클릭 마커) 위치 갱신
    if (!clickMarker) {
        clickMarker = new kakao.maps.Marker({
            map: spotMap,
            position: latlng
        });
    } else {
        clickMarker.setPosition(latlng);
        clickMarker.setMap(spotMap);
    }

    // 반경 원 갱신
    redrawRadiusCircle();

    // 포커스 이동 시 기존 인포윈도우는 닫아 버리기
    if (infoWindow) {
        infoWindow.close();
    }

    if (moveCenter) {
        spotMap.setCenter(latlng);
    }
}

// 반경 input에서 숫자 읽기
function getRadiusFromInput() {
    const input = document.getElementById("spot-radius");
    if (!input) return null;
    const v = parseInt(input.value, 10);
    return isNaN(v) ? null : v;
}

// currentPoint / currentRadius 기준으로 반경 원 다시 그림
function redrawRadiusCircle() {
    if (!spotMap || !currentPoint || !currentRadius || currentRadius <= 0) {
        if (radiusCircle) {
            radiusCircle.setMap(null);
        }
        return;
    }

    if (!radiusCircle) {
        radiusCircle = new kakao.maps.Circle({
            center: currentPoint,
            radius: currentRadius,
            strokeWeight: 1,
            strokeColor: "#ef4444",
            strokeOpacity: 0.9,
            strokeStyle: "solid",
            fillColor: "#fecaca",
            fillOpacity: 0.3
        });
        radiusCircle.setMap(spotMap);

        // 원 위를 클릭해도 동일하게 현재 기준점 갱신 (지도 클릭 안 먹는 느낌 방지)
        kakao.maps.event.addListener(radiusCircle, "click", function (mouseEvent) {
            setCurrentPoint(mouseEvent.latLng);  // moveCenter 기본 false
        });
    } else {
        // Circle은 setPosition을 사용 (CustomOverlay 계열)
        radiusCircle.setPosition(currentPoint);
        radiusCircle.setRadius(currentRadius);
        radiusCircle.setMap(spotMap);
    }
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

/* ===================== Geolocation ===================== */

function initGeolocation(defaultCenter) {
    if (!navigator.geolocation) {
        console.log("[geo] 이 브라우저는 Geolocation을 지원하지 않습니다.");
        userLocation = defaultCenter;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            userLocation = new kakao.maps.LatLng(lat, lng);
            console.log(`[geo] 현재 위치: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        },
        function (error) {
            console.log(`[geo] 위치 획득 실패: code=${error.code}, message=${error.message}`);
            userLocation = defaultCenter;
        }
    );
}

/* ===================== 이벤트 바인딩 ===================== */

function bindMapClick() {
    kakao.maps.event.addListener(spotMap, "click", function (mouseEvent) {
        // ✅ 지도 클릭: 센터 이동 없이 핀/반경만 이동
        setCurrentPoint(mouseEvent.latLng, { moveCenter: false });
    });
}

function bindFormEvents() {
    const form = document.getElementById("spot-form");
    const btnUseCurrent = document.getElementById("btn-use-current");
    const btnSaveSpot = document.getElementById("btn-save-spot");
    const radiusInput = document.getElementById("spot-radius");

    if (btnUseCurrent) {
        btnUseCurrent.addEventListener("click", function () {
            if (!userLocation) {
                alert("현재 위치 정보를 아직 가져오지 못했습니다.");
                return;
            }
            // ✅ 현재 위치는 화면 중앙 이동 기대 → moveCenter: true
            setCurrentPoint(userLocation, { moveCenter: true });
        });
    }

    if (btnSaveSpot) {
        btnSaveSpot.addEventListener("click", function () {
            submitSpotForm();
        });
    }

    // 엔터로 폼 전체 submit 되는 것 방지
    if (form) {
        form.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault(); // 엔터는 저장 X
            }
        });
    }

    // 반경 값 변경 → currentRadius 갱신 + 원 리사이즈
    if (radiusInput) {
        const onRadiusChanged = function () {
            const v = parseInt(radiusInput.value, 10);
            if (!isNaN(v) && v > 0) {
                currentRadius = v;
                if (currentPoint) {
                    redrawRadiusCircle();
                }
            } else {
                // 잘못된 값이면 기존 원 그대로 두고 무시
            }
        };
        radiusInput.addEventListener("input", onRadiusChanged);
        radiusInput.addEventListener("change", onRadiusChanged);
    }
}

function bindSearchEvents() {
    const searchInput = document.getElementById("spot-search");
    const btnSearch = document.getElementById("btn-search");
    if (!searchInput || !btnSearch) return;

    btnSearch.addEventListener("click", function () {
        const keyword = searchInput.value.trim();
        doKeywordSearch(keyword);
    });

    searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            const keyword = searchInput.value.trim();
            doKeywordSearch(keyword);
        }
    });
}

/* ===================== 검색 기능 (Kakao Places) ===================== */

function doKeywordSearch(keyword) {
    const resultsContainer = document.getElementById("spot-search-results");
    if (!resultsContainer) return;

    if (!keyword) {
        resultsContainer.innerHTML = "<div class='search-result-item'>검색어를 입력하세요.</div>";
        return;
    }
    if (!placesService) {
        resultsContainer.innerHTML = "<div class='search-result-item'>검색 서비스를 사용할 수 없습니다.</div>";
        return;
    }

    placesService.keywordSearch(keyword, function (data, status) {
        if (status !== kakao.maps.services.Status.OK) {
            resultsContainer.innerHTML = "<div class='search-result-item'>검색 결과가 없습니다.</div>";
            return;
        }

        resultsContainer.innerHTML = "";
        data.slice(0, 5).forEach(function (place) {
            const item = document.createElement("div");
            item.className = "search-result-item";
            item.innerHTML =
                "<div class='search-result-title'>" + escapeHtml(place.place_name) + "</div>" +
                "<div class='search-result-addr'>" +
                escapeHtml(place.road_address_name || place.address_name || "") +
                "</div>";

            item.addEventListener("click", function () {
                const lat = parseFloat(place.y);
                const lon = parseFloat(place.x);
                const latlng = new kakao.maps.LatLng(lat, lon);

                // 이름 + 좌표 폼에 채움
                document.getElementById("spot-name").value = place.place_name;
                document.getElementById("spot-lat").value = lat.toFixed(6);
                document.getElementById("spot-lon").value = lon.toFixed(6);

                // ✅ 검색 결과 선택 시에는 화면 이동 기대 → moveCenter: true
                setCurrentPoint(latlng, { moveCenter: true });
            });

            resultsContainer.appendChild(item);
        });
    });
}

/* ===================== Spot 생성 / 목록 / 삭제 ===================== */

function submitSpotForm() {
    const name = document.getElementById("spot-name").value.trim();
    const latStr = document.getElementById("spot-lat").value;
    const lonStr = document.getElementById("spot-lon").value;

    const radius = getRadiusFromInput();
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (!name) {
        alert("이름을 입력해 주세요.");
        return;
    }
    if (isNaN(lat) || isNaN(lon)) {
        alert("위도/경도를 올바르게 입력해 주세요. (지도 클릭 또는 검색을 사용하세요.)");
        return;
    }
    if (!radius || radius <= 0) {
        alert("반경(m)을 올바르게 입력해 주세요.");
        return;
    }

    const payload = {
        name: name,
        lat: lat,
        lon: lon,
        locationWidth: radius
    };

    fetch("/api/console/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(resp => {
            if (!resp.ok) {
                throw new Error("Spot 생성 실패");
            }
            return resp.json();
        })
        .then(created => {
            console.log("[spot] 생성:", created);
            // 이름만 초기화, 좌표/반경은 유지 (연속 등록 편의)
            document.getElementById("spot-name").value = "";
            loadSpots();
        })
        .catch(err => {
            console.error(err);
            alert("핀 생성 중 오류가 발생했습니다.");
        });
}

function loadSpots() {
    fetch("/api/console/spots")
        .then(resp => resp.json())
        .then(spots => {
            renderSpotTable(spots);
            renderSpotMarkers(spots);
        })
        .catch(err => {
            console.error("Spot 목록 조회 실패", err);
        });
}

function renderSpotTable(spots) {
    const tbody = document.getElementById("spot-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    spots.forEach(spot => {
        const tr = document.createElement("tr");

        tr.addEventListener("click", function () {
            focusSpot(spot);
        });

        const latNum = Number(spot.lat);
        const lonNum = Number(spot.lon);

        tr.innerHTML = `
            <td>${spot.id}</td>
            <td>${escapeHtml(spot.name)}</td>
            <td>${latNum.toFixed(5)}</td>
            <td>${lonNum.toFixed(5)}</td>
            <td>${spot.locationWidth}</td>
            <td>
                <button type="button" class="btn-danger btn-delete" data-id="${spot.id}">삭제</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    const deleteButtons = tbody.querySelectorAll(".btn-delete");
    deleteButtons.forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            const id = this.getAttribute("data-id");
            if (confirm(`ID ${id} 핀을 삭제할까요?`)) {
                deleteSpot(id);
            }
        });
    });
}

function renderSpotMarkers(spots) {
    spotMarkers.forEach(m => m.setMap(null));
    spotMarkers = [];
    spotMarkerMap = {};

    spots.forEach(spot => {
        const latlng = new kakao.maps.LatLng(Number(spot.lat), Number(spot.lon));
        const marker = new kakao.maps.Marker({
            map: spotMap,
            position: latlng
        });

        spotMarkers.push(marker);
        spotMarkerMap[spot.id] = marker;

        kakao.maps.event.addListener(marker, "click", function () {
            focusSpot(spot);
        });
    });
}

function focusSpot(spot) {
    const latlng = new kakao.maps.LatLng(Number(spot.lat), Number(spot.lon));

    // 폼 값 동기화
    document.getElementById("spot-name").value = spot.name;
    document.getElementById("spot-lat").value = Number(spot.lat).toFixed(6);
    document.getElementById("spot-lon").value = Number(spot.lon).toFixed(6);

    const radiusVal = Number(spot.locationWidth) || 0;
    document.getElementById("spot-radius").value = radiusVal;
    currentRadius = radiusVal;

    // 기준 좌표/마커/원 갱신 (포커스 시에는 화면 중앙 이동 기대 → moveCenter: true)
    setCurrentPoint(latlng, { moveCenter: true });

    // 인포윈도우 표시
    openSpotInfo(spot);
}

function openSpotInfo(spot) {
    if (!infoWindow) {
        infoWindow = new kakao.maps.InfoWindow({ zIndex: 3 });
    }

    const lat = Number(spot.lat);
    const lon = Number(spot.lon);
    const latlng = new kakao.maps.LatLng(lat, lon);

    const marker = spotMarkerMap[spot.id] || clickMarker; // 혹시나 없으면 클릭 마커라도 사용

    let html = `
        <div style="padding:8px 10px;min-width:190px;">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(spot.name)}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">
                주소 조회 중...
            </div>
            <div style="font-size:11px;color:#9ca3af;">
                반경 ${spot.locationWidth} m
            </div>
        </div>
    `;

    infoWindow.setContent(html);

    // ✅ 마커 위에 인포윈도우를 붙여서 띄움 (핀 안 사라지게)
    if (marker) {
        infoWindow.open(spotMap, marker);
    } else {
        infoWindow.setPosition(latlng);
        infoWindow.open(spotMap);
    }

    if (!geocoder) return;

    geocoder.coord2Address(lon, lat, function (result, status) {
        if (status === kakao.maps.services.Status.OK && result && result.length > 0) {
            const addressObj = result[0];
            const address = addressObj.road_address
                ? addressObj.road_address.address_name
                : addressObj.address.address_name;

            html = `
                <div style="padding:8px 10px;min-width:190px;">
                    <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(spot.name)}</div>
                    <div style="font-size:11px;color:#111827;margin-bottom:4px;">
                        ${escapeHtml(address)}
                    </div>
                    <div style="font-size:11px;color:#9ca3af;">
                        반경 ${spot.locationWidth} m
                    </div>
                </div>
            `;

            infoWindow.setContent(html);
            if (marker) {
                infoWindow.open(spotMap, marker);
            } else {
                infoWindow.setPosition(latlng);
                infoWindow.open(spotMap);
            }
        }
    });
}

function deleteSpot(id) {
    fetch(`/api/console/spots/${id}`, {
        method: "DELETE"
    })
        .then(resp => {
            if (!resp.ok) throw new Error("삭제 실패");
            loadSpots();
        })
        .catch(err => {
            console.error(err);
            alert("삭제 중 오류가 발생했습니다.");
        });
}
