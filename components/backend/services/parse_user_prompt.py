import google.generativeai as genai
from typing import Dict


def send_context(chat: genai.ChatSession, system_prompt: str) -> None:
    chat.send_message(system_prompt, role="system")


def send_user_promt(chat: genai.ChatSession, user_input: str) -> Dict:
    response = chat.send_message(user_input)

    try:
        json_output = response.text.strip()

        if json_output.startswith("```"):
            json_output = json_output.strip("`").strip("json").strip()

        return eval(json_output) if json_output.startswith("{") else {}
    except Exception as e:
        return {}