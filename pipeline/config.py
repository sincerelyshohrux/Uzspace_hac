"""Pipeline settings: area of interest, periods and detection thresholds."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "pipeline" / "cache"

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"

REGION = "Toshkent"
# Tashkent city and close surroundings (lon_min, lat_min, lon_max, lat_max)
AOI_BBOX = (69.12, 41.20, 69.42, 41.40)
CRS = "EPSG:32642"  # UTM zone 42N, metres
RES = 10

# Same season in both years, so crop cycles affect T1 and T2 alike
T1 = ("2023-06-01", "2023-09-30")
T2 = ("2025-06-01", "2025-09-30")
MONTHS = ("2023-01", "2025-12")

MAX_CLOUD = 5          # % per scene for the seasonal composites
SCENES_PER_PERIOD = 4
MONTHLY_MAX_CLOUD = 30
MONTHLY_RES = 20

BANDS = ["B02", "B03", "B04", "B08", "B11"]
# Sentinel-2 scene classification values kept as valid pixels:
# 4 vegetation, 5 bare soil, 6 water, 7 unclassified
SCL_VALID = (4, 5, 6, 7)
# Processing baseline >= 04.00 (all scenes after Jan 2022) adds this offset to DN
BOA_OFFSET = 1000

# Change rules (see detect.py)
D_NDVI_MIN = 0.12      # vegetation loss T1 -> T2
D_NDBI_MIN = 0.06      # built-up index gain T1 -> T2
NDVI_T2_MAX = 0.30     # T2 must not be vegetated
NDVI_PEAK_T2_MAX = 0.45  # if any T2 scene is this green, it is a seasonal field
# Object-level filters (mean over the object): drop dry grass / fallow strips
OBJ_NDBI_T2_MIN = 0.03    # built-up or bare surface must show a positive NDBI in T2
OBJ_NDVI_T2_MAX = 0.19    # residual vegetation above this is dry grass, not a site
MIN_PIXELS = 5         # 500 m2
MAX_AREA_M2 = 150_000  # larger blobs are usually agricultural parcels
MAX_ALERTS = 250

# Restricted zones from OpenStreetMap (Overpass API)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CITY_ONLY = True   # keep only changes inside the Toshkent city boundary
# Protection corridor on each side of a line feature, metres. Working assumptions for
# ranking, not the legal widths (those depend on canal class and line voltage).
ZONE_BUFFER_M = {"canal": 30, "river": 50, "power_line": 30, "railway": 25}
ZONE_WEIGHT = {"power_line": 1.0, "canal": 0.9, "river": 0.9, "park": 0.8,
               "farmland": 0.7, "railway": 0.6, "cemetery": 0.6}
ZONE_WEIGHT_NONE = 0.3
MIN_ZONE_POLY_M2 = 2000   # smaller parks / plots are dropped from the map layer
