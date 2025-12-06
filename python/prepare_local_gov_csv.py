#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
지자체 주소 작업 - 1단계
원본 '지방자치단체 주소록(2016년 12월 31일 기준).csv' 를 정제해서

    name,address,zipcode,phone,homepage

컬럼만 남긴 CSV를 생성합니다.
이 결과물을 눈으로 확인한 뒤, 2단계 지오코딩 스크립트에서 사용합니다.
"""

import pandas as pd
import pandas as pd


# ================== 설정값 (필요시 수정) ==================

# 원본 CSV 경로
INPUT_CSV_PATH = "지방자치단체 주소록(2016년 12월 31일 기준).csv"

# 정제된 CSV 출력 경로
OUTPUT_CLEAN_CSV_PATH = "local_gov_clean.csv"

# 원본 CSV 인코딩
# - 엑셀에서 바로 저장했다면 보통 "cp949"
# - UTF-8로 재저장했다면 "utf-8-sig"
INPUT_ENCODING = "cp949"

# ========================================================


def load_and_clean_csv(path: str, encoding: str = "cp949") -> pd.DataFrame:
    """
    원본 CSV를 읽어서 실제 '행정기관 데이터' 행만 남기고,
    컬럼명을 통일된 형태로 정리합니다.

    반환 컬럼:
        - name      : 행정기관명 (서울특별시, 종로구, 수원시, 장안구, ...)
        - address   : 청사 소재지(도로명 주소)
        - zipcode   : 우편번호
        - phone     : 대표전화
        - homepage  : 홈페이지 도메인
    """
    df = pd.read_csv(path, encoding=encoding)

    # 원본 첫 두 컬럼명 (예: '시도, 시군구 사무소 소재지 ', 'Unnamed: 1')
    col0 = df.columns[0]
    col1 = df.columns[1]

    def is_data_row(row) -> bool:
        v0 = row[col0]
        v1 = row[col1]

        # 1) 첫 컬럼이 비어 있으면 데이터 아님
        if pd.isna(v0):
            return False

        s0 = str(v0).strip()

        # 2) '구분' 헤더행 제거
        if s0 == "구분":
            return False

        # 3) ';', ';[1]' 같은 각주/구분선 제거
        if s0.startswith(";"):
            return False

        # 4) 섹션별로 반복되는 헤더행 제거 (두 번째 컬럼에 '소      재      지' 포함)
        if isinstance(v1, str) and "소      재      지" in v1:
            return False

        return True

    mask = df.apply(is_data_row, axis=1)
    df_clean = df[mask].copy()

    # 컬럼명을 의미 있게 리네이밍
    df_clean = df_clean.rename(columns={
        col0: "name",
        col1: "address",
        df.columns[2]: "zipcode",
        df.columns[3]: "phone",
        df.columns[4]: "homepage",
    })

    # 우리가 관심 있는 컬럼만 선택
    result = df_clean[["name", "address", "zipcode", "phone", "homepage"]].reset_index(drop=True)
    return result


def main():
    print(f"[INFO] Loading raw CSV from {INPUT_CSV_PATH} ...")
    df = load_and_clean_csv(INPUT_CSV_PATH, encoding=INPUT_ENCODING)

    print(f"[INFO] Clean rows: {len(df)}")
    print("[INFO] First 5 rows (preview):")
    print(df.head())

    # 엑셀에서 열기 좋게 UTF-8-SIG로 저장
    df.to_csv(OUTPUT_CLEAN_CSV_PATH, index=False, encoding="utf-8-sig")
    print(f"[INFO] Clean CSV saved to: {OUTPUT_CLEAN_CSV_PATH}")
    print("[INFO] Columns:", list(df.columns))


if __name__ == "__main__":
    main()
