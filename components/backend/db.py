import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

backend_dir = os.path.dirname(__file__)
repo_root = os.path.abspath(os.path.join(backend_dir, "..", ".."))

# Support both the current repo-level .env and the older backend-local .env layout.
load_dotenv(dotenv_path=os.path.join(repo_root, ".env"))
load_dotenv(dotenv_path=os.path.join(backend_dir, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST", "db")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME")

    missing = [
        name for name, value in {
            "DB_USER": db_user,
            "DB_PASSWORD": db_password,
            "DB_NAME": db_name,
        }.items()
        if not value
    ]

    if missing:
        raise RuntimeError(
            "Missing required database settings: "
            + ", ".join(missing)
            + ". Define them in the root .env file or via environment variables."
        )

    DATABASE_URL = (
        f"postgresql+psycopg2://{db_user}:{db_password}"
        f"@{db_host}:{db_port}/{db_name}"
    )

engine = create_engine(DATABASE_URL, echo=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()
