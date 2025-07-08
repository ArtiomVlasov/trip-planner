import google.generativeai as genai
from typing import Dict
import json


def send_context(chat: genai.ChatSession, system_prompt: str) -> None:
    chat.send_message(system_prompt)


def send_user_prompt(chat: genai.ChatSession, user_input: str) -> Dict:
    response = chat.send_message(user_input)

    try:
        json_output = response.text
        if json_output.startswith("```"):
            json_output = json_output.split("```")[1].strip("json").strip()

        return json.loads(json_output)
    
    except Exception as e: 
        return {}