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
    preferredTypes: List[str]
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