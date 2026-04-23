from core.request_context import current_client_ip
from services.gemini_route_planner import parse_route_prompt
from services.route_context import build_context_key, save_context


def handle_prompt(prompt: str, user_id: int):
    parsed_prompt = parse_route_prompt(prompt)
    context_key = build_context_key(user_id=user_id)
    save_context(context_key, parsed_prompt)
    return parsed_prompt


def handle_prompt_guest(prompt: str):
    client_ip = current_client_ip.get()
    context_key = build_context_key(client_ip=client_ip)
    parsed_prompt = parse_route_prompt(prompt)
    save_context(context_key, parsed_prompt)
    return parsed_prompt
