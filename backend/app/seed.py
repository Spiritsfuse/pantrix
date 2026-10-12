"""Demo records for the Pantrix demo hub. Only inserted into empty tables.

All organisations below are fictional and exist only for the Pantrix demo.
"""

import logging
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Distribution, Donor, StockItem

log = logging.getLogger("pantrix.seed")

DONORS = [
    ("Spiritsfuse Community Kitchen", "community", "kitchen@pantrix.example", "Pilani"),
    ("Greenrow Organic Farm", "farm", "harvest@greenrow.example", "Jaipur"),
    ("Daily Crust Bakery", "business", "orders@dailycrust.example", "Jaipur"),
    ("Northgate Wholesale Foods", "business", "csr@northgate.example", "Delhi"),
    ("Dhruv Sharma (founder pledge)", "individual", None, "Pilani"),
]

# name, category, quantity, unit, days until expiry (None = non-perishable), location, donor index
ITEMS = [
    ("Basmati rice 5kg bags", "grains", 42, "packs", 240, "A1-03", 3),
    ("Whole wheat atta", "grains", 30, "kg", 75, "A1-05", 3),
    ("Red lentils (masoor dal)", "grains", 55, "kg", 180, "A2-01", 3),
    ("Fresh tomatoes", "produce", 18, "kg", 3, "COLD-1", 1),
    ("Spinach bunches", "produce", 12, "units", 1, "COLD-1", 1),
    ("Bananas", "produce", 25, "kg", 5, "COLD-2", 1),
    ("Toned milk 1L", "dairy", 36, "litres", 4, "COLD-3", 3),
    ("Paneer blocks", "dairy", 8, "packs", -1, "COLD-3", 3),
    ("Multigrain bread loaves", "bakery", 20, "units", 2, "B2-02", 2),
    ("Chickpeas (canned)", "canned", 64, "cans", 400, "C1-01", 3),
    ("Mixed vegetable curry (canned)", "canned", 0, "cans", 300, "C1-02", 0),
    ("Peanut butter jars", "protein", 15, "units", 120, "C2-04", 0),
    ("Soya chunks", "protein", 22, "packs", 210, "C2-05", 4),
    ("Infant formula stage 1", "baby", 6, "boxes", 60, "D1-01", 4),
    ("Bath soap bars", "hygiene", 80, "units", None, "H1-01", 0),
    ("Sanitary pad packs", "hygiene", 40, "packs", None, "H1-02", 4),
]

DISTRIBUTIONS = [
    (0, 6, "Shelter Home Ward 4", 2),
    (3, 4, "Evening Meal Program", 1),
    (9, 12, "Migrant Workers Relief Camp", 6),
    (14, 20, "Girls' Hostel Outreach", 9),
]


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(func.count(StockItem.id))):
        return False
    today = date.today()
    donors = [Donor(name=n, donor_type=t, contact_email=e, city=c) for n, t, e, c in DONORS]
    db.add_all(donors)
    db.flush()
    items = [
        StockItem(
            name=name,
            category=cat,
            quantity=qty,
            unit=unit,
            expiry_date=today + timedelta(days=days) if days is not None else None,
            location=loc,
            donor_id=donors[d].id,
        )
        for name, cat, qty, unit, days, loc, d in ITEMS
    ]
    db.add_all(items)
    db.flush()
    db.add_all(
        Distribution(
            item_id=items[i].id,
            quantity=qty,
            recipient=recipient,
            distributed_on=today - timedelta(days=ago),
        )
        for i, qty, recipient, ago in DISTRIBUTIONS
    )
    db.commit()
    log.info("seeded demo data", extra={"extra_fields": {"donors": len(donors), "items": len(items)}})
    return True
