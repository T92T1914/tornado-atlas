"""Retain JMA case classifications, source columns and reported uncertainty."""

from __future__ import annotations

import csv
import io
import math
import re
from datetime import date, datetime

SOURCE = "jma_tornado_and_gust_cases"
URL = "https://www.data.jma.go.jp/stats/data/bosai/tornado/data/ichiran.csv"
GUIDE_URL = "https://www.data.jma.go.jp/stats/data/bosai/tornado/data/datafmt.csv"
# The published CSV has 89 columns. The guide numbers 82 elements because
# seven prefecture code/name pairs occupy two columns each.
HEADERS = (
    "事例番号", "現象種類", "発生年", "発生月", "発生日", "発生時", "発生分",
    "発生時刻確度(-分)", "発生時刻確度(+分)", "発生緯度(度)", "発生緯度(分)",
    "発生緯度(秒)", "発生緯度確度(±秒)", "発生経度(度)", "発生経度(分)",
    "発生経度(秒)", "発生経度確度(±秒)", "発生県", "", "発生市町村",
    "消滅年", "消滅月", "消滅日", "消滅時", "消滅分", "消滅時刻確度(-分)",
    "消滅時刻確度(+分)", "消滅緯度(度)", "消滅緯度(分)", "消滅緯度(秒)",
    "消滅緯度確度(±秒)", "消滅経度(度)", "消滅経度(分)", "消滅経度(秒)",
    "消滅経度確度(±秒)", "消滅県", "", "消滅市町村", "被害域幅(m)最小",
    "被害域幅(m)最大", "被害域長さ(100m)最小", "被害域長さ(100m)最大",
    "移動方向1", "移動方向2", "移動速度(km/h)", "継続時間(分)",
    "Fスケール最小値", "Fスケール最大値", "回転方向", "発生地点区別", "総観場1",
    "総観場2", "総観場3", "総観場じょう乱からの位置", "死者", "共用フラグ_死者",
    "負傷者合計", "共用フラグ_負傷者合計", "負傷者(重傷)", "共用フラグ_負傷者(重傷)",
    "負傷者(軽傷)", "共用フラグ_負傷者(軽傷)", "住家被害合計", "共用フラグ_住家被害合計",
    "住家全壊", "共用フラグ_住家全壊", "住家半壊", "共用フラグ_住家半壊",
    "住家一部損壊", "共用フラグ_住家一部損壊", "非住家被害合計", "共用フラグ_非住家被害合計",
    "非住家全壊", "共用フラグ_非住家全壊", "非住家半壊", "共用フラグ_非住家半壊",
    "非住家一部損壊", "共用フラグ_非住家一部損壊", "通過県", "", "通過県", "",
    "通過県", "", "通過県", "", "通過県", "", "現象の風速",
)
PHENOMENA = {
    "1": ("tornado", "竜巻"),
    "2": ("downburst", "ダウンバースト(マイクロバーストを含む)"),
    "3": ("tornado_or_downburst", "竜巻またはダウンバースト(マイクロバーストを含む)"),
    "4": ("gust_front", "ガストフロント"),
    "5": ("dust_devil", "じん旋風(つむじ風を含む)"),
    "6": ("unknown", "不明"),
    "7": ("tornado_or_funnel_cloud", "竜巻または漏斗雲(2007年以降のみ)"),
    "8": ("downburst_or_gust_front", "ダウンバーストまたはガストフロント(2007年以降のみ)"),
    "9": ("other", "その他"),
    "-9999": ("unset", "未設定"),
}
MISSING = {"-9999": "unset", "-8888": "unknown", "": "blank"}


def normalize(cells: list[str]) -> dict:
    """Normalize one ordered case without treating ambiguous gusts as tornadoes."""
    if len(cells) != len(HEADERS):
        raise ValueError("JMA case must contain exactly 89 columns")
    identifier, code = cells[0].strip(), cells[1].strip()
    if re.fullmatch(r"[0-9]{10}", identifier) is None:
        raise ValueError("A ten-digit JMA case ID is required")
    if code not in PHENOMENA:
        raise ValueError("Unrecognized JMA phenomenon code requires source review")
    issues = []

    def number(index: int, *, integral: bool = False) -> dict:
        raw = cells[index].strip()
        if raw in MISSING:
            return {"reported": cells[index], "status": MISSING[raw], "value": None}
        try:
            if integral and re.fullmatch(r"[0-9]+", raw) is None:
                raise ValueError
            value = int(raw) if integral else float(raw)
            if value < 0 or not math.isfinite(value):
                raise ValueError
        except (ValueError, OverflowError):
            issues.append(f"invalid_numeric:column_{index + 1}")
            return {"reported": cells[index], "status": "invalid", "value": None}
        return {"reported": cells[index], "status": "reported", "value": value}

    def timestamp(start: int) -> dict:
        fields = [number(start + offset, integral=True) for offset in range(5)]
        values = [field["value"] for field in fields]
        local = None
        if all(value is not None for value in values):
            try:
                local = datetime(*values).isoformat(timespec="minutes")
            except (ValueError, OverflowError):
                issues.append(f"invalid_calendar_time:column_{start + 1}")
        result = {"reported": cells[start:start + 5], "components": fields,
                  "local": local, "utc": None, "zone": None,
                  "basis": "reported_calendar_components_timezone_unresolved",
                  "uncertainty_minus_minutes": number(start + 5),
                  "uncertainty_plus_minutes": number(start + 6)}
        if local:
            issues.append(f"unresolved_timezone:column_{start + 1}")
        return result

    def position(start: int) -> dict:
        components = [number(start + offset) for offset in range(8)]
        lat_d, lat_m, lat_s, lat_error, lon_d, lon_m, lon_s, lon_error = (
            field["value"] for field in components)
        point = None
        if all(value is not None for value in (lat_d, lat_m, lat_s, lon_d, lon_m, lon_s)):
            if (lat_m < 60 and lat_s < 60 and lon_m < 60 and lon_s < 60
                    and lat_d + lat_m / 60 + lat_s / 3600 <= 90
                    and lon_d + lon_m / 60 + lon_s / 3600 <= 180):
                point = [lon_d + lon_m / 60 + lon_s / 3600,
                         lat_d + lat_m / 60 + lat_s / 3600]
                if point == [0, 0]:
                    point = None
                    issues.append(f"placeholder_coordinates:column_{start + 1}")
            else:
                issues.append(f"invalid_coordinates:column_{start + 1}")
        return {"point": point, "reported_components": components,
                "uncertainty_latitude_arcseconds": lat_error,
                "uncertainty_longitude_arcseconds": lon_error}

    def interval(start: int, factor: int) -> dict:
        lower, upper = number(start), number(start + 1)
        minimum, maximum = lower["value"], upper["value"]
        if minimum is not None and maximum is not None and minimum > maximum:
            issues.append(f"reversed_interval:column_{start + 1}")
            minimum = maximum = None
        converted = [value * factor if value is not None else None
                     for value in (minimum, maximum)]
        for offset, value in enumerate(converted):
            if value is not None and not math.isfinite(value):
                issues.append(f"unit_conversion_overflow:column_{start + offset + 1}")
                converted[offset] = None
        return {"reported_minimum": lower, "reported_maximum": upper,
                "minimum_m": converted[0], "maximum_m": converted[1]}

    year_field = number(2, integral=True)
    year = year_field["value"]
    if year is None or not 1 <= year <= 9999:
        raise ValueError("JMA case needs a valid occurrence year")
    begin, end = timestamp(2), timestamp(20)
    begin_position, end_position = position(9), position(27)
    scale = "F" if year < 2016 else "JEF" if year > 2016 else None
    if year == 2016:
        try:
            occurrence = date(year, int(cells[3]), int(cells[4]))
            scale = "JEF" if occurrence >= date(2016, 4, 1) else "F"
        except ValueError:
            issues.append("unresolved_rating_scale_date")
    lower, upper = number(46, integral=True), number(47, integral=True)
    minimum, maximum = lower["value"], upper["value"]
    if any(value is not None and value > 5 for value in (minimum, maximum)) or (
            minimum is not None and maximum is not None and minimum > maximum):
        issues.append("invalid_rating_interval")
        minimum = maximum = None
    reported = None
    if scale and minimum is not None and maximum is not None:
        reported = f"{scale}{minimum}" if minimum == maximum else f"{scale}{minimum}..{scale}{maximum}"
    impacts = {}
    for index in range(54, 78, 2):
        impacts[HEADERS[index]] = {"count": number(index, integral=True),
                                  "shared_scope_reported": cells[index + 1],
                                  "aggregation": "not_aggregated"}
    classification, original_name = PHENOMENA[code]
    return {
        "schema_version": 1, "id": "jma:" + identifier, "source": SOURCE,
        "source_record_id": identifier, "source_episode_id": None,
        "record_kind": "reported_gust_case", "country_code": "JP", "year": year,
        "title": " ".join(value for value in (cells[18], cells[19]) if value) or identifier,
        "administrative_area": cells[18] or None, "local_area": cells[19] or None,
        "language": "ja", "reporting_entity": "Japan Meteorological Agency",
        "classification": classification, "classification_code": code,
        "classification_reported": original_name, "confirmed_tornado": code == "1",
        "rating": {"reported": reported, "scale": scale, "minimum": minimum,
                   "maximum": maximum, "value": minimum if minimum == maximum else None,
                   "source_minimum": lower, "source_maximum": upper,
                   "basis": "reported_damage_rating_interval"},
        "time": {"begin": begin, "end": end},
        "spatial": {"begin_point": begin_position["point"], "end_point": end_position["point"],
                    "begin": begin_position, "end": end_position,
                    "coordinate_order": "longitude_latitude", "track": None,
                    "datum": None,
                    "basis": "reported_damage_trace_endpoints" if code == "1" else "reported_gust_reference_points",
                    "interpolation": None},
        "dimensions": {"length_interval": interval(40, 100), "width_interval": interval(38, 1),
                       "length_m": None, "width_m": None, "visible_funnel_width_m": None,
                       "scope": "reported_damage_area"},
        "impacts": impacts, "wind": {"reported": number(88), "unit": None},
        "narrative": "", "episode_narrative": "", "continuation": {},
        "reconstruction": {"status": "not_built", "observed_appearance": None},
        "quality_notes": issues,
    }


def iter_cases(content: bytes):
    """Yield every class with its complete ordered row and logical CSV record."""
    if not isinstance(content, bytes) or len(content) > 16_000_000:
        raise ValueError("JMA source must be bytes within the 16 MB input limit")
    text = content.decode("cp932", errors="strict")
    reader = csv.reader(io.StringIO(text, newline=""), strict=True)
    if tuple(next(reader, ())) != HEADERS:
        raise ValueError("Unsupported JMA CSV schema; exact ordered headers are required")
    for row_number, cells in enumerate(reader, start=2):
        if len(cells) != len(HEADERS):
            raise ValueError(f"JMA CSV record {row_number} must contain exactly 89 columns")
        raw = {"headers": list(HEADERS), "values": cells}
        yield row_number, raw, normalize(cells)
