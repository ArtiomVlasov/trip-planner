from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, List, Literal, Optional
from datetime import date, datetime
from decimal import Decimal



class UserLogin(BaseModel):
    email: EmailStr
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


class PartnerRegistration(BaseModel):
    partnerName: str
    partnerCategory: str
    contactEmail: Optional[EmailStr] = None


class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str
    accountType: Literal["user", "partner"] = "user"
    partner: Optional[PartnerRegistration] = None
    preferences: Optional[Preferences] = None
    startingPoint: Optional[StartingPoint] = None
    availability: Optional[Availability] = None
    preferredTypes: Optional[list] = None


class SavedRouteMessage(BaseModel):
    id: str
    text: str
    isUser: bool
    timestamp: datetime
    isSent: Optional[bool] = None


class SavedRouteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    routeQueries: List[str] = Field(default_factory=list)
    messages: List[SavedRouteMessage] = Field(..., min_length=1)
    metadata: Optional[Dict[str, Any]] = None


class SavedRouteOut(BaseModel):
    id: int
    title: str
    route_queries: List[str]
    messages: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    created_at: Optional[datetime]

    class Config:
        orm_mode = True


class RouteGenerationRequest(BaseModel):
    routeDescription: str = ""
    startingPointAddress: str = ""
    requiredPlaces: List[str] = Field(default_factory=list)
    routeQueries: List[str] = Field(default_factory=list)
    currentRouteQueries: List[str] = Field(default_factory=list)
    removedRouteQueries: List[str] = Field(default_factory=list)
    addedRouteQueries: List[str] = Field(default_factory=list)
    accommodationPreference: Optional[str] = None
    contextMessages: List[str] = Field(default_factory=list)
    latestUserMessage: str = ""


class RouteRenderDataRequest(BaseModel):
    routeQueries: List[str] = Field(default_factory=list)


class RoutePointOut(BaseModel):
    query: str
    address: str
    coordinates: Location
    source: str = "unknown"
    displayName: Optional[str] = None
    googleMapsUri: Optional[str] = None
    photoUrl: Optional[str] = None
    placeId: Optional[str] = None


class RouteSegmentOut(BaseModel):
    coordinates: List[Location] = Field(default_factory=list)
    source: str = "straight"


class RouteRenderDataResponse(BaseModel):
    routePoints: List[RoutePointOut] = Field(default_factory=list)
    routeSegments: List[RouteSegmentOut] = Field(default_factory=list)


class RouteGenerationResponse(BaseModel):
    routeQueries: List[str] = Field(default_factory=list)
    source: str = "database_fallback"


class MapsGeocodeResponseItem(BaseModel):
    address: str
    lat: float
    lng: float
    city: Optional[str] = None
    country: Optional[str] = None


class MapsReverseGeocodeRequest(BaseModel):
    latitude: float
    longitude: float


class MapsReverseGeocodeResponse(BaseModel):
    address: str
    lat: float
    lng: float
    city: Optional[str] = None
    country: Optional[str] = None
    
    
class PlaceCreate(BaseModel):
    placeId: str
    name: str 
    formatted_address: Optional[str] = None
    location: Optional[Location] = None
    types: List[str]
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None 
    price_level: Optional[int] = None
    map_uri: Optional[str] = None
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
    login: str
    password: str
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
    login: Optional[str]
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


class PartnerLogin(BaseModel):
    login: str
    password: str


class PartnerLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    partner_id: int
    login: str


# ═══════════════════════════════════════════════
#  CRM – Place (CRM-side create, search uses existing Place model)
# ═══════════════════════════════════════════════

PlaceSource = Literal["external", "foursquare", "manual", "partner"]


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


class CrmPlaceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None


class CrmPlaceOut(BaseModel):
    place_id: str
    name: Optional[str]
    formatted_address: Optional[str]
    rating: Optional[float]
    types: Optional[List[str]]

    class Config:
        orm_mode = True


class CrmPlaceManageOut(BaseModel):
    place_id: str
    name: Optional[str]
    category: Optional[str]
    formatted_address: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    types: Optional[List[str]]


class GeneratedExternalIdOut(BaseModel):
    external_id: str


# ═══════════════════════════════════════════════
#  CRM – PartnerPlace
# ═══════════════════════════════════════════════

RelationshipType = Literal["owner", "reseller", "sponsor"]
CommissionType   = Literal["cpa", "cpl", "fixed"]
PartnerPlaceStatus = Literal["active", "paused", "archived"]


class PartnerPlaceCreate(BaseModel):
    partner_id: Optional[int] = None
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


class PartnerManagedPlaceOut(BaseModel):
    partner_place_id: int
    partner_id: int
    place_id: str
    name: Optional[str]
    category: Optional[str]
    formatted_address: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    types: Optional[List[str]]
    relationship_type: str
    priority_weight: float
    commission_type: Optional[str]
    commission_value: Optional[Decimal]
    is_promotable: bool
    start_date: Optional[date]
    end_date: Optional[date]
    status: str


class PartnerPlacePerformanceStatsOut(BaseModel):
    impressions_count: int = 0
    clicks_count: int = 0
    leads_count: int = 0
    bookings_count: int = 0
    unique_users_count: int = 0
    unique_trips_count: int = 0
    click_through_rate: float = 0.0
    lead_conversion_rate: float = 0.0
    booking_conversion_rate: float = 0.0
    last_event_at: Optional[datetime] = None
    impressions_daily: List[Dict[str, Any]] = Field(default_factory=list)
    clicks_daily: List[Dict[str, Any]] = Field(default_factory=list)


class PartnerPlacesSummaryOut(PartnerPlacePerformanceStatsOut):
    total_places: int = 0
    active_places: int = 0
    paused_places: int = 0
    archived_places: int = 0
    promotable_places: int = 0


class PartnerManagedPlaceWithStatsOut(PartnerManagedPlaceOut):
    stats: PartnerPlacePerformanceStatsOut


class PartnerPlacesDashboardOut(BaseModel):
    summary: PartnerPlacesSummaryOut
    items: List[PartnerManagedPlaceWithStatsOut]


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
