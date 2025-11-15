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
    
    
class PlaceCreate(BaseModel):
    placeId: str
    name: str 
    formatted_address: str
    location: Location
    types: List[str]
    rating: float
    user_ratings_total: int 
    price_level: str 
    google_maps_uri: str
    website_uri: str
    photo_refs: List[dict]
    opening_hours: dict

    class Config:
        orm_mode = True
        allow_population_by_field_name = True