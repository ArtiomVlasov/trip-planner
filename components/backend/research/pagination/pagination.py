import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("FOURSQUARE_API_KEY")

url = "https://places-api.foursquare.com/places/search"

# Correct version header for Foursquare Places API.
# The version is important to ensure compatibility with the API's expected format.
headers = {
    "authorization": f"Bearer {api_key}",
    "accept": "application/json",
    "X-Places-Api-Version": "2025-06-17"
}


params = {
    "ll": "40.18733549949229,44.51515940228367",
    "radius" : 1000,
    "limit" : 50, # Maximum possible with pagination. If set to 49, the next page will have only 1 result (pagination ends at 50).
    # "fields" : "price" - Available only in paid version of the API.
    "min_price" : 2, # Prices range, where 1 - cheap and 4 - expensive. 
    "max_price" : 3,
    # "sort": "relevance, rating, distance, popularity", Params of sorting order, relevance set as default variable
    # "open_now" : True, # Return only currently open POIs by working hours
    "open_at" : "3T0700", # Return only working POIs in provided time
} 

response = requests.request("GET", url, headers=headers, params=params)
data = response.json()

for idx, place in enumerate(data["results"]):
    print(idx + 1, place["location"])

# All POI's features:
'''
- fsq_place_id
- latitude
- longitude
- categories
- date_created
- date_refreshed
- distance
- extended_location
- link
- location
- name
- placemaker_url
- related_places
- social_media
'''