from __future__ import annotations

import math
from typing import Iterable


EARTH_RADIUS_M = 6_371_008.8


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def haversine_many_m(latitude: float, longitude: float, latitudes, longitudes):  # type: ignore[no-untyped-def]
    """Vectorized haversine distance; accepts NumPy arrays without importing NumPy here."""
    import numpy as np

    phi1 = np.radians(latitude)
    phi2 = np.radians(latitudes)
    delta_phi = np.radians(latitudes - latitude)
    delta_lambda = np.radians(longitudes - longitude)
    a = np.sin(delta_phi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    try:
        west, south, east, north = (float(item.strip()) for item in value.split(","))
    except (TypeError, ValueError) as exc:
        raise ValueError("bbox must be west,south,east,north") from exc
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("bbox coordinates are invalid or not ordered west,south,east,north")
    return west, south, east, north


def chunked(items: Iterable, size: int):  # type: ignore[no-untyped-def]
    chunk = []
    for item in items:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk

