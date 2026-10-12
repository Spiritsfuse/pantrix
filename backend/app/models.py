"""ORM models. The schema itself is owned by Alembic (see alembic/versions)."""

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Donor(Base):
    __tablename__ = "donors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    donor_type: Mapped[str] = mapped_column(String(20), nullable=False, default="business")
    contact_email: Mapped[str | None] = mapped_column(String(160))
    city: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    items: Mapped[list["StockItem"]] = relationship(back_populates="donor")


class StockItem(Base):
    __tablename__ = "stock_items"
    __table_args__ = (CheckConstraint("quantity >= 0", name="ck_stock_items_quantity_non_negative"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="units")
    expiry_date: Mapped[date | None] = mapped_column(Date, index=True)
    location: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)
    donor_id: Mapped[int | None] = mapped_column(ForeignKey("donors.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    donor: Mapped[Donor | None] = relationship(back_populates="items")
    distributions: Mapped[list["Distribution"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )


class Distribution(Base):
    """Stock handed out to a partner organisation. Creating one decrements stock."""

    __tablename__ = "distributions"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_distributions_quantity_positive"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(
        ForeignKey("stock_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    recipient: Mapped[str] = mapped_column(String(120), nullable=False)
    distributed_on: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    item: Mapped[StockItem] = relationship(back_populates="distributions")
