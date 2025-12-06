#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
지자체 주소 작업 - 2단계
1단계에서 만든 local_gov_clean.csv 를 읽어서,
카카오 로컬 API(주소 검색)를 통해 lat, lon을 붙여

    name,address,lat,lon,phone,homepage

형태의 최종 CSV를 생성합니다.
"""

import time
import math
import requests
import pandas as pd
from typing import Optional, Tuple


# ================== 반드시 수정해서 사용할 상수들 ==================

# ✅ 카카오 REST API 키 (Authorization: KakaoAK {키})
KAKAO_REST_API_KEY = "1010b359139007ad64a090e9ebc98c05"

# ✅ 1단계에서 만든 정제 CSV 경로
INPUT_CLEAN_CSV_PATH = "local_gov_clean.csv"

# ✅ 최종 결과 CSV 경로
OUTPUT_GEOCODED_CSV_PATH = "local_gov_with_latlon.csv"

# ✅ API 호출 사이 텀 (초) - 너무 빠르게 호출하면 rate limit 걸릴 수 있어서 살짝 딜레이
REQUEST_INTERVAL_SEC = 0.2

# ============================================================


def geocode_address_kakao(address: str) -> Tuple[Optional[float], Optional[float]]:
    """
    카카오 로컬 주소검색 API를 사용해 주소 -> (lat, lon)으로 변환합니다.
    - lat: 위도 (y)
    - lon: 경도 (x)
    결과가 없거나 에러가 나면 (None, None)을 반환합니다.
    """
    # NaN 방어
    if not isinstance(address, str) or not address.strip():
        return None, None

    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }
    params = {
        "query": address
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()

        documents = data.get("documents", [])
        if not documents:
            return None, None

        # 가장 첫 번째 결과 사용
        doc = documents[0]
        lat = float(doc.get("y"))
        lon = float(doc.get("x"))
        return lat, lon

    except Exception as e:
        print(f"[WARN] Geocoding failed for address='{address}': {e}")
        return None, None


def main():
    print(f"[INFO] Loading cleaned CSV from {INPUT_CLEAN_CSV_PATH} ...")
    df = pd.read_csv(INPUT_CLEAN_CSV_PATH, encoding="utf-8-sig")

    required_cols = {"name", "address", "phone", "homepage"}
    if not required_cols.issubset(df.columns):
        raise ValueError(
            f"입력 CSV에 필요한 컬럼이 없습니다. 필요 컬럼: {required_cols}, 실제: {set(df.columns)}"
        )

    lats = []
    lons = []

    total = len(df)
    for idx, row in df.iterrows():
        name = row["name"]
        address = row["address"]

        print(f"[{idx + 1}/{total}] Geocoding: {name} / {address}")
        lat, lon = geocode_address_kakao(address)
        lats.append(lat)
        lons.append(lon)

        time.sleep(REQUEST_INTERVAL_SEC)

    df["lat"] = lats
    df["lon"] = lons

    # 최종 컬럼 정리: name, address, lat, lon, phone, homepage
    final_df = df[["name", "address", "lat", "lon", "phone", "homepage"]]

    # 최종 CSV 저장 (UTF-8-SIG: 엑셀에서 한글 안 깨짐)
    final_df.to_csv(OUTPUT_GEOCODED_CSV_PATH, index=False, encoding="utf-8-sig")
    print(f"[INFO] Done. Saved to {OUTPUT_GEOCODED_CSV_PATH}")
    print(f"[INFO] Rows: {len(final_df)}")


if __name__ == "__main__":
    main()
