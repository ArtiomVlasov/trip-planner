import json
from typing import Any


def send_context(chat: Any, system_prompt: str) -> None:
    chat.send_message(system_prompt)


def send_user_prompt(chat: Any, user_input: str) -> dict:
    response = chat.send_message(user_input)

    try:
        json_output = (response.text or "").strip()

        if json_output.startswith("```"):
            parts = json_output.split("```")
            if len(parts) >= 3:
                json_output = parts[1]
            else:
                json_output = json_output.strip("`")

            if json_output.lstrip().startswith("json"):
                json_output = json_output.lstrip()[4:].strip()

        return json.loads(json_output)

    except Exception:
        return {}
