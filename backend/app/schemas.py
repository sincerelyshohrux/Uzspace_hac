"""API kontrakti. Frontend dagi src/api/types.ts shu bilan bir xil bo'lishi kerak."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["new", "in_review", "confirmed", "false_positive"]
ChangeType = Literal["new_construction", "land_clearing", "demolition"]
PermitMatch = Literal["none", "matched", "partial", "no_data"]


class RiskBreakdown(BaseModel):
    confidence: float
    zone_weight: float
    area_factor: float
    permit_factor: float


class Alert(BaseModel):
    alert_id: str
    district: str
    area_m2: float
    lat: float
    lon: float
    confidence: float
    change_type: ChangeType
    start_month: Optional[str] = None
    zones: list[str] = []
    permit_match: PermitMatch
    risk_score: float
    risk: RiskBreakdown
    status: Status = "new"
    note: Optional[str] = None
    updated_at: Optional[str] = None
    chip_before: Optional[str] = None
    chip_after: Optional[str] = None
    geometry: dict[str, Any]


class AlertList(BaseModel):
    total: int
    items: list[Alert]


class AlertUpdate(BaseModel):
    status: Status
    note: Optional[str] = Field(default=None, max_length=1000)
    user: str = Field(default="inspector", max_length=100)


class AuditEntry(BaseModel):
    id: int
    alert_id: str
    old_status: Optional[str]
    new_status: str
    note: Optional[str]
    user: str
    ts: str


class TimeseriesPoint(BaseModel):
    month: str
    built: Optional[float]


class DistrictStat(BaseModel):
    district: str
    count: int
    area_ha: float
    in_restricted_zone: int
    high_risk: int
    confirmed: int


class TimelinePoint(BaseModel):
    month: str
    count: int
    area_ha: float


class Summary(BaseModel):
    total: int
    area_ha: float
    in_restricted_zone: int
    high_risk: int
    confirmed: int
    false_positive: int
    pending: int


class InspectorStat(BaseModel):
    user: str
    reviewed: int
    confirmed: int
    false_positive: int
    last_action: Optional[str]


class Health(BaseModel):
    status: str
    data_loaded: bool
    alerts: int
