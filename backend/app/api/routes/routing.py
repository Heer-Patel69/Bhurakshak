from fastapi import APIRouter, Request

from ...models.schemas import RouteCompareRequest


router = APIRouter(prefix="/routes", tags=["routing"])


@router.post("/compare")
def compare_routes(payload: RouteCompareRequest, request: Request) -> dict:
    return request.app.state.services.routing.compare(payload.source_node, payload.destination_node)

