from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, List, Literal, Optional
from datetime import date, datetime
from decimal import Decimal



class UserLogin(BaseModel):
    username: str
    password: str


class Location(BaseModel):
    latitude: float
    longitude: float


class StartingPoint(BaseModel):
    name: str
    location: Location
    city: str
    country: str


class Preferences(BaseModel):
    maxWalkingDistanceMeters: int
    budgetLevel: int
    ratingThreshold: float
    likesBreakfastOutside: bool
    transportMode: Literal["WALK", "DRIVE", "BICYCLE", "TRANSIT", "TWO_WHEELER"]


class Availability(BaseModel):
    startTime: int
    endTime: int


class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str
    preferences: Preferences
    startingPoint: StartingPoint
    availability: Availability
    preferredTypes: list
    
    
class PlaceCreate(BaseModel):
    placeId: str
    name: str 
    formatted_address: Optional[str] = None
    location: Optional[Location] = None
    types: List[str]
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None 
    price_level: Optional[int] = None
    google_maps_uri: Optional[str] = None
    website_uri: Optional[str] = None
    photo_refs: Optional[List[dict]] = None
    opening_hours: Optional[dict] = None

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


# ═══════════════════════════════════════════════
#  CRM – Partner
# ═══════════════════════════════════════════════

PartnerCategory = Literal["hotel", "restaurant", "activity", "transfer"]
PartnerStatus   = Literal["active", "paused", "archived"]


class PartnerCreate(BaseModel):
    name: str
    category: PartnerCategory
    city: str = "sochi"
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[PartnerCategory] = None
    status: Optional[PartnerStatus] = None
    city: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


class PartnerOut(BaseModel):
    id: int
    name: str
    category: str
    status: str
    city: str
    contact_name: Optional[str]
    contact_email: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class PartnerListOut(BaseModel):
    items: List[PartnerOut]
    total: int
    page: int
    limit: int


# ═══════════════════════════════════════════════
#  CRM – Place (CRM-side create, search uses existing Place model)
# ═══════════════════════════════════════════════

PlaceSource = Literal["google", "foursquare", "manual", "partner"]


class CrmPlaceCreate(BaseModel):
    source: PlaceSource
    external_id: Optional[str] = None
    name: str
    category: str
    lat: float
    lng: float
    address: Optional[str] = None
    city: str = "sochi"
    rating: Optional[float] = None
    tags: Optional[List[str]] = None


class CrmPlaceOut(BaseModel):
    place_id: str
    name: Optional[str]
    formatted_address: Optional[str]
    rating: Optional[float]
    types: Optional[List[str]]

    class Config:
        orm_mode = True


# ═══════════════════════════════════════════════
#  CRM – PartnerPlace
# ═══════════════════════════════════════════════

RelationshipType = Literal["owner", "reseller", "sponsor"]
CommissionType   = Literal["cpa", "cpl", "fixed"]
PartnerPlaceStatus = Literal["active", "paused", "archived"]


class PartnerPlaceCreate(BaseModel):
    partner_id: int
    place_id: str
    relationship_type: RelationshipType = "owner"
    priority_weight: float = 1.0
    commission_type: Optional[CommissionType] = None
    commission_value: Optional[Decimal] = None
    is_promotable: bool = True
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PartnerPlaceUpdate(BaseModel):
    relationship_type: Optional[RelationshipType] = None
    priority_weight: Optional[float] = None
    commission_type: Optional[CommissionType] = None
    commission_value: Optional[Decimal] = None
    is_promotable: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[PartnerPlaceStatus] = None


class PartnerPlaceOut(BaseModel):
    id: int
    partner_id: int
    place_id: str
    relationship_type: str
    priority_weight: float
    commission_type: Optional[str]
    commission_value: Optional[Decimal]
    is_promotable: bool
    start_date: Optional[date]
    end_date: Optional[date]
    status: str

    class Config:
        orm_mode = True


# ═══════════════════════════════════════════════
#  CRM – RouteInsertionRule
# ═══════════════════════════════════════════════

TriggerType = Literal["after_poi_type", "time_slot", "nearby"]
RuleStatus  = Literal["active", "paused", "archived"]


class RouteRuleCreate(BaseModel):
    partner_place_id: int
    trigger_type: TriggerType
    trigger_value: str
    max_detour_minutes: Optional[int] = None
    max_detour_km: Optional[float] = None
    daily_cap: Optional[int] = None
    trip_cap: Optional[int] = None
    priority_boost: float = 0.0
    status: RuleStatus = "active"


class RouteRuleUpdate(BaseModel):
    trigger_type: Optional[TriggerType] = None
    trigger_value: Optional[str] = None
    max_detour_minutes: Optional[int] = None
    max_detour_km: Optional[float] = None
    daily_cap: Optional[int] = None
    trip_cap: Optional[int] = None
    priority_boost: Optional[float] = None
    status: Optional[RuleStatus] = None


class RouteRuleOut(BaseModel):
    id: int
    partner_id: Optional[int]
    partner_place_id: Optional[int]
    trigger_type: str
    trigger_value: str
    max_detour_minutes: Optional[int]
    max_detour_km: Optional[float]
    daily_cap: Optional[int]
    trip_cap: Optional[int]
    priority_boost: float
    status: str

    class Config:
        orm_mode = True


# ═══════════════════════════════════════════════
#  CRM – EventLog
# ═══════════════════════════════════════════════

EventType = Literal["impression", "click", "lead", "booking"]


class EventCreate(BaseModel):
    event_type: EventType
    user_id: Optional[int] = None
    trip_id: Optional[int] = None
    route_id: Optional[int] = None
    partner_id: Optional[int] = None
    place_id: Optional[str] = None
    partner_place_id: Optional[int] = None
    event_ts: Optional[datetime] = None
    attribution_key: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class EventOut(BaseModel):
    id: int
    event_type: str
    user_id: Optional[int]
    trip_id: Optional[int]
    route_id: Optional[int]
    partner_id: Optional[int]
    place_id: Optional[str]
    partner_place_id: Optional[int]
    event_ts: Optional[datetime]
    attribution_key: Optional[str]
    metadata_json: Optional[Dict[str, Any]]

    class Config:
        orm_mode = True


class EventListOut(BaseModel):
    items: List[EventOut]
    total: int
    page: int
    limit: int


# ═══════════════════════════════════════════════
#  CRM – Settlement
# ═══════════════════════════════════════════════

SettlementStatus = Literal["draft", "approved", "paid"]


class SettlementGenerateRequest(BaseModel):
    period_start: date
    period_end: date
    partner_id: Optional[int] = None


class SettlementUpdate(BaseModel):
    status: Optional[SettlementStatus] = None
    adjustment_amount: Optional[Decimal] = None
    comment: Optional[str] = None


class SettlementOut(BaseModel):
    id: int
    partner_id: int
    period_start: date
    period_end: date
    leads_count: int
    bookings_count: int
    gross_amount: Decimal
    payout_amount: Decimal
    currency: str
    status: str
    generated_at: Optional[datetime]

    class Config:
        orm_mode = True


class SettlementListOut(BaseModel):
    items: List[SettlementOut]
    total: int
    page: int
    limit: int


# ═══════════════════════════════════════════════
#  Runtime – Recommendations & Route Insert
# ═══════════════════════════════════════════════

class RecommendationItem(BaseModel):
    partner_place_id: int
    partner_id: int
    place_id: str
    place_name: Optional[str]
    score: float
    reason: str
    commission_type: Optional[str]


class RecommendationsOut(BaseModel):
    items: List[RecommendationItem]


class RouteInsertRequest(BaseModel):
    trip_id: int
    day: int
    route_id: Optional[int] = None
    partner_place_id: int
    position_hint: Optional[int] = None


class RouteInsertOut(BaseModel):
    status: str
    message: str
    partner_place_id: int
    trip_id: int
    day: int