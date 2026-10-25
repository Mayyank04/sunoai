from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from backend.app.core.config import settings
from typing import AsyncGenerator
import os

# Ensure local storage and db directories exist
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    db_file_path = db_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    if db_file_path and not db_file_path.startswith(":memory:"):
        os.makedirs(os.path.dirname(os.path.abspath(db_file_path)) or ".", exist_ok=True)

async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

async_session_maker = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db() -> None:
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
