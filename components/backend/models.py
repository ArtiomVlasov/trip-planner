from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, TIMESTAMP, JSON, ARRAY, UniqueConstraint
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
    searchQueries = relationship("SearchQuery", back_populates="user")
    main_type_weights = relationship("UserMainTypeWeight", back_populates="user", cascade="all, delete-orphan")
    subtype_weights = relationship("UserSubtypeWeight", back_populates="user", cascade="all, delete-orphan")


class Preferences(Base):
    __tablename__ = "preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    max_walking_distance_meters = Column(Integer)
    budget_level = Column(Integer)
    rating_threshold = Column(Float)
    likes_breakfast_outside = Column(Boolean)
    transport_mode = Column(String)

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
    
class MainType(Base):
    __tablename__ = "main_types"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)

    subtypes = relationship("Subtype", back_populates="main_type")


class Subtype(Base):
    __tablename__ = "subtypes"

    id = Column(Integer, primary_key=True)
    main_type_id = Column(Integer, ForeignKey("main_types.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)

    main_type = relationship("MainType", back_populates="subtypes")

    __table_args__ = (
        UniqueConstraint("main_type_id", "name", name="uq_main_subtype"),
    )


class Place(Base):
    __tablename__ = "places"

    place_id = Column(Text, primary_key=True)     
    name = Column(Text)
    formatted_address = Column(Text)
    location = Column(Geometry(geometry_type="POINT", srid=4326))
    types = Column(ARRAY(Text))
    rating = Column(Float)
    user_ratings_total = Column(Integer)
    price_level = Column(Text) 
    google_maps_uri = Column(Text)
    website_uri = Column(Text)
    photo_refs = Column(JSON)
    opening_hours = Column(JSON)

    query_links = relationship("SearchQueryPlace", back_populates="place")


class SearchQuery(Base):
    __tablename__ = "search_queries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    query_text = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default="now()")
    raw_params = Column(JSON, nullable=False)
    hash = Column(Text, nullable=False, unique=True)

    places = relationship("SearchQueryPlace", back_populates="query")
    user = relationship("User", back_populates="searchQueries")


class SearchQueryPlace(Base):
    __tablename__ = "search_query_places"

    query_id = Column(Integer, ForeignKey("search_queries.id", ondelete="CASCADE"), primary_key=True)
    place_id = Column(String, ForeignKey("places.place_id", ondelete="CASCADE"), primary_key=True)

    query = relationship("SearchQuery", back_populates="places")
    place = relationship("Place", back_populates="query_links")

class UserMainTypeWeight(Base):
    __tablename__ = "user_main_type_weights"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    main_type_id = Column(Integer, ForeignKey("main_types.id", ondelete="CASCADE"), primary_key=True)
    weight = Column(Float, nullable=False)
    
    user = relationship("User", back_populates="main_type_weights")


class UserSubtypeWeight(Base):
    __tablename__ = "user_subtype_weights"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    subtype_id = Column(Integer, ForeignKey("subtypes.id", ondelete="CASCADE"), primary_key=True)
    weight = Column(Float, nullable=False)
    
    user = relationship("User", back_populates="subtype_weights")