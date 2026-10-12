"""initial schema: donors, stock_items, distributions

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-10-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "donors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("donor_type", sa.String(20), nullable=False),
        sa.Column("contact_email", sa.String(160)),
        sa.Column("city", sa.String(80)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "stock_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("expiry_date", sa.Date()),
        sa.Column("location", sa.String(40)),
        sa.Column("notes", sa.Text()),
        sa.Column("donor_id", sa.Integer(), sa.ForeignKey("donors.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity >= 0", name="ck_stock_items_quantity_non_negative"),
    )
    op.create_index("ix_stock_items_name", "stock_items", ["name"])
    op.create_index("ix_stock_items_category", "stock_items", ["category"])
    op.create_index("ix_stock_items_expiry_date", "stock_items", ["expiry_date"])
    op.create_index("ix_stock_items_donor_id", "stock_items", ["donor_id"])
    op.create_table(
        "distributions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "item_id",
            sa.Integer(),
            sa.ForeignKey("stock_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("recipient", sa.String(120), nullable=False),
        sa.Column("distributed_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_distributions_quantity_positive"),
    )
    op.create_index("ix_distributions_item_id", "distributions", ["item_id"])


def downgrade() -> None:
    op.drop_index("ix_distributions_item_id", table_name="distributions")
    op.drop_table("distributions")
    for ix in ("donor_id", "expiry_date", "category", "name"):
        op.drop_index(f"ix_stock_items_{ix}", table_name="stock_items")
    op.drop_table("stock_items")
    op.drop_table("donors")
