from typing import Any, Dict


def update_user_dataset(original: Dict[str, Any], processed_user_message: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in processed_user_message.items():
        if isinstance(value, dict):
            original[key] = update_user_dataset(original.get(key, {}), value)
        elif value is not None:
            original[key] = value
    return original
