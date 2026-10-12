"""Pydantic request/response schemas and validation rules."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Category = Literal["produce", "dairy", "grains", "canned", "protein", "bakery", "hygiene", "baby"]
Unit = Literal["units", "kg", "litres", "packs", "boxes", "cans"]
DonorType = Literal["individual", "business", "farm", "community"]
StockStatus = Literal["out_of_stock", "expired", "expiring", "ok"]


def _strip_required(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("must not be blank")
    return value


# --- Donors ------------------------------------------------------------------


class DonorBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    donor_type: DonorType = "business"
    contact_email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=80)

    _strip_name = field_validator("name")(_strip_required)


class DonorCreate(DonorBase):
    pass


class DonorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    donor_type: DonorType | None = None
    contact_email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=80)


class DonorRead(DonorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    item_count: int = 0


# --- Stock items -------------------------------------------------------------


class StockItemBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: Category
    quantity: int = Field(ge=0, le=100_000)
    unit: Unit = "units"
    expiry_date: date | None = None
    location: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=2000)
    donor_id: int | None = None

    _strip_name = field_validator("name")(_strip_required)


class StockItemCreate(StockItemBase):
    pass


class StockItemUpdate(BaseModel):
    """Every field optional: PUT accepts a partial update of an existing item."""

    name: str | None = Field(default=None, min_length=2, max_length=120)
    category: Category | None = None
    quantity: int | None = Field(default=None, ge=0, le=100_000)
    unit: Unit | None = None
    expiry_date: date | None = None
    location: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=2000)
    donor_id: int | None = None


class StockItemRead(StockItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: StockStatus
    days_to_expiry: int | None
    donor_name: str | None = None
    created_at: datetime
    updated_at: datetime


class StockStats(BaseModel):
    total_items: int
    total_units: int
    expiring_soon: int
    expired: int
    out_of_stock: int
    donors: int
    distributed_units_30d: int
    by_category: dict[str, int]


# --- Distributions -----------------------------------------------------------


class DistributionCreate(BaseModel):
    item_id: int
    quantity: int = Field(gt=0, le=100_000)
    recipient: str = Field(min_length=2, max_length=120)
    distributed_on: date | None = None

    _strip_recipient = field_validator("recipient")(_strip_required)


class DistributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    item_name: str
    quantity: int
    recipient: str
    distributed_on: date
    created_at: datetime


class ErrorResponse(BaseModel):
    detail: str
