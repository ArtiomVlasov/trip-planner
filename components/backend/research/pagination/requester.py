import json 
import os
import requests
from datetime  import date
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("FOURSQUARE_API_KEY")
url = "https://places-api.foursquare.com/places/search"

headers = {
    "authorization": f"Bearer {api_key}",
    "accept": "application/json",
    "X-Places-Api-Version": "2025-06-17"
}

with open("components/backend/research/data_base/user_dataset.json", "r") as file:
    user_data = json.load(file)

params = {
    "ll" : f"{user_data['user']['startingPoint']['location']['latitude']},{user_data['user']['startingPoint']['location']['longitude']}",
    "radius" : f"{user_data['user']['preferences']['maxWalkingDistanceMeters']}",
    "max_price": f"{user_data['user']['preferences']['budgetLevel']}",
    "open_now" : True, 
    "close_at" : f"{date.today().weekday() + 1}T{user_data['user']['availability']['endTime'][0:2]}{user_data['user']['availability']['endTime'][3:5]}",
    "sort" : "rating",
    "limit" : 50,
}

response = requests.request("GET", url, headers=headers, params=params)
data = response.json()

for idx, place in enumerate(data["results"]):
    print(idx + 1, place["name"])