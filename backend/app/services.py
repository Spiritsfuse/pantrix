"""Domain logic shared by the routers: stock status and response mapping."""

from datetime import date

from app.config import get_settings
from app.models import Distribution, StockItem
from app.schemas import DistributionRead, StockItemRead, StockStatus


def stock_status(item: StockItem, today: date | None = None) -> tuple[StockStatus, int | None]:
    """Classify an item. Out-of-stock wins, then expired, then expiring soon."""
    today = today or date.today()
    days = (item.expiry_date - today).days if item.expiry_date else None
    if item.quantity == 0:
        return "out_of_stock", days
    if days is not None and days < 0:
        return "expired", days
    if days is not None and days <= get_settings().expiry_warning_days:
        return "expiring", days
    return "ok", days


def to_item_read(item: StockItem) -> StockItemRead:
    status, days = stock_status(item)
    return StockItemRead(
        id=item.id,
        name=item.name,
        category=item.category,
        quantity=item.quantity,
        unit=item.unit,
        expiry_date=item.expiry_date,
        location=item.location,
        notes=item.notes,
        donor_id=item.donor_id,
        donor_name=item.donor.name if item.donor else None,
        status=status,
        days_to_expiry=days,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def to_distribution_read(dist: Distribution) -> DistributionRead:
    return DistributionRead(
        id=dist.id,
        item_id=dist.item_id,
        item_name=dist.item.name,
        quantity=dist.quantity,
        recipient=dist.recipient,
        distributed_on=dist.distributed_on,
        created_at=dist.created_at,
    )
