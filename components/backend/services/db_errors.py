from sqlalchemy.exc import IntegrityError


EMAIL_CONSTRAINT_NAMES = {
    "ix_users_email",
    "users_email_key",
}

USERNAME_CONSTRAINT_NAMES = {
    "ix_users_username",
    "users_username_key",
}


def get_duplicate_user_registration_detail(error: IntegrityError) -> str | None:
    constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
    raw_message = str(error.orig).lower()

    if (
        constraint_name in EMAIL_CONSTRAINT_NAMES
        or "key (email)=" in raw_message
        or "users.email" in raw_message
    ):
        return "An account with this email already exists."

    if (
        constraint_name in USERNAME_CONSTRAINT_NAMES
        or "key (username)=" in raw_message
        or "users.username" in raw_message
    ):
        return "This username is already taken."

    return None
