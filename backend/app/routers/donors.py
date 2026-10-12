"""/api/donors — CRUD for the organisations and people who donate stock."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Donor, StockItem
from app.schemas import DonorCreate, DonorRead, DonorUpdate, ErrorResponse

router = APIRouter(prefix="/api/donors", tags=["donors"])

NOT_FOUND = {404: {"model": ErrorResponse, "description": "Donor not found"}}


def _get_donor_or_404(db: Session, donor_id: int) -> Donor:
    donor = db.get(Donor, donor_id)
    if donor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Donor {donor_id} not found")
    return donor


def _to_read(db: Session, donor: Donor) -> DonorRead:
    count = db.scalar(select(func.count(StockItem.id)).where(StockItem.donor_id == donor.id))
    return DonorRead.model_validate(donor).model_copy(update={"item_count": count or 0})


def _commit_unique(db: Session, name: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Donor '{name}' already exists") from exc


@router.get("", response_model=list[DonorRead])
def list_donors(db: Session = Depends(get_db)) -> list[DonorRead]:
    counts = dict(
        db.execute(select(StockItem.donor_id, func.count(StockItem.id)).group_by(StockItem.donor_id)).all()
    )
    donors = db.scalars(select(Donor).order_by(Donor.name)).all()
    return [
        DonorRead.model_validate(d).model_copy(update={"item_count": counts.get(d.id, 0)}) for d in donors
    ]


@router.get("/{donor_id}", response_model=DonorRead, responses=NOT_FOUND)
def get_donor(donor_id: int, db: Session = Depends(get_db)) -> DonorRead:
    return _to_read(db, _get_donor_or_404(db, donor_id))


@router.post("", response_model=DonorRead, status_code=status.HTTP_201_CREATED)
def create_donor(payload: DonorCreate, db: Session = Depends(get_db)) -> DonorRead:
    donor = Donor(**payload.model_dump())
    db.add(donor)
    _commit_unique(db, payload.name)
    return _to_read(db, donor)


@router.put("/{donor_id}", response_model=DonorRead, responses=NOT_FOUND)
def update_donor(donor_id: int, payload: DonorUpdate, db: Session = Depends(get_db)) -> DonorRead:
    donor = _get_donor_or_404(db, donor_id)
    changes = payload.model_dump(exclude_unset=True)
    for field in ("name", "donor_type"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{field} cannot be null")
    for field, value in changes.items():
        setattr(donor, field, value.strip() if isinstance(value, str) else value)
    _commit_unique(db, donor.name)
    return _to_read(db, donor)


@router.delete("/{donor_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_donor(donor_id: int, db: Session = Depends(get_db)) -> Response:
    donor = _get_donor_or_404(db, donor_id)
    # Items keep their history; the FK is ON DELETE SET NULL.
    for item in donor.items:
        item.donor_id = None
    db.delete(donor)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
