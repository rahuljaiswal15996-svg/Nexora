from fastapi import APIRouter, Response
from app.services.observability import metrics_response, metrics_content_type

router = APIRouter()

@router.get("/metrics")
async def metrics():
    data = metrics_response()
    return Response(content=data, media_type=metrics_content_type())
