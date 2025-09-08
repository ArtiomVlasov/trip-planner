from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from db import Base

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)  # автоинкремент
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    preferences = relationship("Preferences", uselist=False, back_populates="user", cascade="all, delete")
    starting_point = relationship("StartingPoint", uselist=False, back_populates="user", cascade="all, delete")
    availability = relationship("Availability", uselist=False, back_populates="user", cascade="all, delete")
    routes = relationship("Route", back_populates="user", cascade="all, delete")


class Preferences(Base):
    __tablename__ = "preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    max_walking_distance_meters = Column(Integer)
    budget_level = Column(Integer)
    rating_threshold = Column(Float)
    likes_breakfast_outside = Column(Boolean)
    transport_mode = Column(String)

    # Список типов мест как строка, например: "restaurant,cafe,bakery"
    preferred_types = Column(String)

    user = relationship("User", back_populates="preferences")


class StartingPoint(Base):
    __tablename__ = "starting_points"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String)
    location = Column(Geometry("POINT", srid=4326))  # PostGIS геоточка

    user = relationship("User", back_populates="starting_point")


class Availability(Base):
    __tablename__ = "availabilities"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    start_time = Column(Integer)  # В минутах, например 900
    end_time = Column(Integer)    # В минутах, например 1200

    user = relationship("User", back_populates="availability")


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    distance_meters = Column(Float)
    duration_seconds = Column(Integer)
    geom = Column(Geometry("LINESTRING", srid=4326))  # маршрут

    user = relationship("User", back_populates="routes")