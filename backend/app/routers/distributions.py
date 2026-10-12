"""/api/distributions — record stock handed out; decrements item quantity."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Distribution, StockItem
from app.observability import STOCK_EVENTS, UNITS_DISTRIBUTED
from app.schemas import DistributionCreate, DistributionRead, ErrorResponse
from app.services import stock_status, to_distribution_read

router = APIRouter(prefix="/api/distributions", tags=["distributions"])


@router.get("", response_model=list[DistributionRead])
def list_distributions(
    db: Session = Depends(get_db), limit: int = Query(default=20, ge=1, le=200)
) -> list[DistributionRead]:
    stmt = (
        select(Distribution)
        .options(selectinload(Distribution.item))
        .order_by(Distribution.distributed_on.desc(), Distribution.id.desc())
        .limit(limit)
    )
    return [to_distribution_read(d) for d in db.scalars(stmt)]


@router.post(
    "",
    response_model=DistributionRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"model": ErrorResponse, "description": "Item not found"},
        409: {"model": ErrorResponse, "description": "Insufficient or expired stock"},
    },
)
def create_distribution(payload: DistributionCreate, db: Session = Depends(get_db)) -> DistributionRead:
    # Row lock so two concurrent hand-outs cannot oversell (no-op on SQLite).
    item = db.scalar(select(StockItem).where(StockItem.id == payload.item_id).with_for_update())
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Stock item {payload.item_id} not found")
    if stock_status(item)[0] == "expired":
        raise HTTPException(status.HTTP_409_CONFLICT, f"'{item.name}' is expired and cannot be distributed")
    if payload.quantity > item.quantity:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Only {item.quantity} {item.unit} of '{item.name}' in stock",
        )
    item.quantity -= payload.quantity
    dist = Distribution(
        item_id=item.id,
        quantity=payload.quantity,
        recipient=payload.recipient,
        distributed_on=payload.distributed_on or date.today(),
    )
    db.add(dist)
    db.commit()
    STOCK_EVENTS.labels(action="distributed").inc()
    UNITS_DISTRIBUTED.inc(payload.quantity)
    db.refresh(dist)
    return to_distribution_read(dist)
