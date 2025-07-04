import json 
import os
import requests
from datetime  import date
from dotenv import load_dotenv

load_dotenv()
foursquare_api_key = os.getenv("FOURSQUARE_API_KEY")
routes_api_key = os.getenv("GOOGLE_PLACES_API_KEY")

fsq_url = "https://places-api.foursquare.com/places/search"
rts_url = "https://routes.googleapis.com/directions/v2:computeRoutes"

fsq_headers = {
    "authorization": f"Bearer {foursquare_api_key}",
    "accept": "application/json",
    "X-Places-Api-Version": "2025-06-17"
}

with open("components/backend/research/data_base/user_dataset.json", "r") as file:
    user_data = json.load(file)

start_point_longitude = user_data['user']['startingPoint']['location']['longitude']
start_point_latitude =  user_data['user']['startingPoint']['location']['latitude']

fsq_params = {
    "ll" : f"{user_data['user']['startingPoint']['location']['latitude']},{start_point_longitude}",
    "radius" : f"{user_data['user']['preferences']['maxWalkingDistanceMeters']}",
    "max_price": f"{user_data['user']['preferences']['budgetLevel']}",
    "open_now" : True, 
    "close_at" : f"{date.today().weekday() + 1}T{user_data['user']['availability']['endTime'][0:2]}{user_data['user']['availability']['endTime'][3:5]}",
    "sort" : "rating",
    "limit" : 1,
}

response = requests.request("GET", fsq_url, headers=fsq_headers, params=fsq_params)

data = response.json()

rts_header = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": routes_api_key,
    "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
}

rts_body = {
    "origin": {
        "location": {
            "latLng": {"latitude": start_point_latitude, "longitude": start_point_longitude}
        }
    },
    "destination": {
        "location": {
            "latLng": {"latitude": data['results'][0]['latitude'], "longitude": data['results'][0]['longitude']}
        }
    },
    "travelMode": "DRIVE"
}

rts_response = requests.post(rts_url, headers=rts_header, json=rts_body)

with open("components/backend/research/data_base/route_output.json", "w") as rts_output:
    json.dump(rts_response.json(), rts_output, indent=4)