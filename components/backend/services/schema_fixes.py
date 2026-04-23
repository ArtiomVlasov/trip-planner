from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine


def _users_username_index_exists(connection: Connection) -> bool:
    return bool(connection.execute(text("""
        SELECT EXISTS (
            SELECT 1
            FROM pg_class index_rel
            JOIN pg_namespace namespace ON namespace.oid = index_rel.relnamespace
            JOIN pg_index index_meta ON index_meta.indexrelid = index_rel.oid
            JOIN pg_class table_rel ON table_rel.oid = index_meta.indrelid
            WHERE namespace.nspname = current_schema()
              AND index_rel.relname = 'ix_users_username'
              AND table_rel.relname = 'users'
        )
    """)).scalar())


def _relation_named_users_username_index_exists(connection: Connection) -> bool:
    return bool(connection.execute(text("""
        SELECT EXISTS (
            SELECT 1
            FROM pg_class relation_rel
            JOIN pg_namespace namespace ON namespace.oid = relation_rel.relnamespace
            WHERE namespace.nspname = current_schema()
              AND relation_rel.relname = 'ix_users_username'
        )
    """)).scalar())


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

        if _users_username_index_exists(connection):
            return

        # A relation with the target name may already exist in the schema
        # because of an earlier deploy or manual migration. In that case we
        # avoid crashing app startup and leave the existing object untouched.
        if _relation_named_users_username_index_exists(connection):
            return

        connection.execute(text(
            "CREATE INDEX ix_users_username ON users (username)"
        ))
