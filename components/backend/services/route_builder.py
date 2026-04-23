from core.request_context import current_client_ip
from services.gemini_route_planner import plan_day_route
from services.route_context import build_context_key, load_context


def build_photo_url(photo_refs: list | None) -> None:
    return None


def build_route(user_id: int) -> dict:
    parsed_prompt = load_context(build_context_key(user_id=user_id))
    if not parsed_prompt:
        raise RuntimeError("Сначала отправьте запрос в /prompt/.")

    return plan_day_route(parsed_prompt, mode="user")


def build_route_guest() -> dict:
    parsed_prompt = load_context(build_context_key(client_ip=current_client_ip.get()))
    if not parsed_prompt:
        raise RuntimeError("Сначала отправьте запрос в /prompt/.")

    return plan_day_route(parsed_prompt, mode="guest")
