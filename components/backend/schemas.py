from pydantic import BaseModel, EmailStr, Field
from typing import List, Literal, Optional



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
    price_level: Optional[str] = None
    google_maps_uri: Optional[str] = None
    website_uri: Optional[str] = None
    photo_refs: Optional[List[dict]] = None
    opening_hours: Optional[dict] = None

    class Config:
        orm_mode = True
        allow_population_by_field_name = True