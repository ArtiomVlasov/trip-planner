from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_users_username_is_non_unique(engine: Engine) -> None:
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key"
        ))
        connection.execute(text(
            "ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_username"
        ))
        connection.execute(text(
            "DROP INDEX IF EXISTS ix_users_username"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_users_username ON users (username)"
        ))
