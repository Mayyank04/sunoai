from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from backend.app.core.config import settings
from typing import AsyncGenerator
import os

db_url = settings.get_database_url()
engine_kwargs = {"echo": False, "future": True}

if db_url.startswith("sqlite"):
    db_file_path = db_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    if db_file_path and not db_file_path.startswith(":memory:"):
        os.makedirs(os.path.dirname(os.path.abspath(db_file_path)) or ".", exist_ok=True)
else:
    # PostgreSQL connection pool settings
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    })

async_engine = create_async_engine(db_url, **engine_kwargs)

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
