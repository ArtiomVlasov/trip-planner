from contextvars import ContextVar

current_client_ip: ContextVar[str | None] = ContextVar(
    "current_client_ip",
    default=None
)