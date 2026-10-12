"""/api/items — CRUD for donated stock plus dashboard statistics."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Distribution, Donor, StockItem
from app.observability import STOCK_EVENTS
from app.schemas import (
    Category,
    ErrorResponse,
    StockItemCreate,
    StockItemRead,
    StockItemUpdate,
    StockStats,
    StockStatus,
)
from app.services import stock_status, to_item_read

router = APIRouter(prefix="/api/items", tags=["stock items"])

NOT_FOUND = {404: {"model": ErrorResponse, "description": "Item not found"}}


def _get_item_or_404(db: Session, item_id: int) -> StockItem:
    item = db.get(StockItem, item_id, options=[selectinload(StockItem.donor)])
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Stock item {item_id} not found")
    return item


def _ensure_donor_exists(db: Session, donor_id: int | None) -> None:
    if donor_id is not None and db.get(Donor, donor_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Donor {donor_id} does not exist")


@router.get("", response_model=list[StockItemRead])
def list_items(
    db: Session = Depends(get_db),
    category: Category | None = None,
    status_filter: StockStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=80, description="Search name or location"),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[StockItemRead]:
    stmt = select(StockItem).options(selectinload(StockItem.donor))
    if category:
        stmt = stmt.where(StockItem.category == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(StockItem.name.ilike(like), StockItem.location.ilike(like)))
    # Soonest expiry first; items without an expiry date go last.
    stmt = stmt.order_by(StockItem.expiry_date.is_(None), StockItem.expiry_date, StockItem.id)
    items = [to_item_read(i) for i in db.scalars(stmt.limit(limit))]
    if status_filter:
        items = [i for i in items if i.status == status_filter]
    return items


@router.get("/stats", response_model=StockStats)
def item_stats(db: Session = Depends(get_db)) -> StockStats:
    items = db.scalars(select(StockItem)).all()
    statuses = [stock_status(i)[0] for i in items]
    by_category: dict[str, int] = {}
    for item in items:
        by_category[item.category] = by_category.get(item.category, 0) + item.quantity
    since = date.today() - timedelta(days=30)
    distributed = db.scalar(
        select(func.coalesce(func.sum(Distribution.quantity), 0)).where(Distribution.distributed_on >= since)
    )
    return StockStats(
        total_items=len(items),
        total_units=sum(i.quantity for i in items),
        expiring_soon=statuses.count("expiring"),
        expired=statuses.count("expired"),
        out_of_stock=statuses.count("out_of_stock"),
        donors=db.scalar(select(func.count(Donor.id))) or 0,
        distributed_units_30d=int(distributed or 0),
        by_category=dict(sorted(by_category.items())),
    )


@router.get("/{item_id}", response_model=StockItemRead, responses=NOT_FOUND)
def get_item(item_id: int, db: Session = Depends(get_db)) -> StockItemRead:
    return to_item_read(_get_item_or_404(db, item_id))


@router.post("", response_model=StockItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: StockItemCreate, db: Session = Depends(get_db)) -> StockItemRead:
    _ensure_donor_exists(db, payload.donor_id)
    item = StockItem(**payload.model_dump())
    db.add(item)
    db.commit()
    STOCK_EVENTS.labels(action="created").inc()
    return to_item_read(_get_item_or_404(db, item.id))


@router.put("/{item_id}", response_model=StockItemRead, responses=NOT_FOUND)
def update_item(item_id: int, payload: StockItemUpdate, db: Session = Depends(get_db)) -> StockItemRead:
    item = _get_item_or_404(db, item_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        changes["name"] = changes["name"].strip()
        if not changes["name"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "name must not be blank")
    for field in ("name", "category", "quantity", "unit"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{field} cannot be null")
    if "donor_id" in changes:
        _ensure_donor_exists(db, changes["donor_id"])
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    STOCK_EVENTS.labels(action="updated").inc()
    db.expire(item)
    return to_item_read(_get_item_or_404(db, item_id))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_item(item_id: int, db: Session = Depends(get_db)) -> Response:
    item = _get_item_or_404(db, item_id)
    db.delete(item)
    db.commit()
    STOCK_EVENTS.labels(action="deleted").inc()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
