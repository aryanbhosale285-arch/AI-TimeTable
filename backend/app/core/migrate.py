"""Tiny idempotent startup migrations.

create_all() creates missing TABLES but never adds COLUMNS to existing ones.
Deployed databases predate some model columns, so on every boot we diff the
SQLAlchemy models against the live schema and ADD any column that's missing.
New columns are added nullable (no default backfill) — models must tolerate
NULL in them, which ours do.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.core.database import Base


def run_startup_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # create_all already made it, complete with all columns
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing_cols:
                continue
            col_type = column.type.compile(engine.dialect)
            with engine.begin() as conn:
                conn.execute(
                    text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}')
                )
