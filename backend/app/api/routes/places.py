from fastapi import APIRouter, Query, Request


router = APIRouter(prefix="/places", tags=["place search"])


@router.get("/search")
def search_places(
    request: Request,
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=15, ge=1, le=30),
) -> dict:
    return request.app.state.services.places.search(q, limit=limit)
