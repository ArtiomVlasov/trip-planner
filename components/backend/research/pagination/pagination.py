import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("FOURSQUARE_API_KEY")

url = "https://places-api.foursquare.com/places/search"

headers = {
    "authorization": f"Bearer {api_key}",
    "accept": "application/json",
    "X-Places-Api-Version": "2025-06-17"
}

params = {
    "ll": "40.18733549949229,44.51515940228367",
    "radius" : 1000,
    "limit" : 20,
    "categories": "13065", 
}

response = requests.request("GET", url, headers=headers)
data = response.json()

print(data)