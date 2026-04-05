from fastapi import APIRouter, HTTPException, Header
from typing import Dict, Any, List
from app.services.pipeline_optimizer import PipelineOptimizerService

router = APIRouter()
optimizer_service = PipelineOptimizerService()

@router.get("/pipelines/{pipeline_id}/metrics")
async def get_pipeline_metrics(
    pipeline_id: str,
    x_tenant_id: str | None = Header(None)
):
    """Get performance metrics for a pipeline."""
    tenant_id = x_tenant_id or "default"

    try:
        metrics = optimizer_service.get_metrics(pipeline_id, tenant_id)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")

@router.post("/pipelines/{pipeline_id}/optimize")
async def optimize_pipeline(
    pipeline_id: str,
    x_tenant_id: str | None = Header(None)
):
    """Run optimization analysis on a pipeline."""
    tenant_id = x_tenant_id or "default"

    try:
        result = optimizer_service.optimize_pipeline(pipeline_id, tenant_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to optimize pipeline: {str(e)}")

@router.get("/optimization/cost-analysis")
async def get_cost_analysis(
    x_tenant_id: str | None = Header(None)
):
    """Get cost analysis for all pipelines."""
    tenant_id = x_tenant_id or "default"

    try:
        analysis = optimizer_service.get_cost_analysis(tenant_id)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cost analysis: {str(e)}")

@router.post("/optimization/auto-scale")
async def auto_scale_resources(
    pipeline_id: str,
    target_metrics: Dict[str, Any],
    x_tenant_id: str | None = Header(None)
):
    """Automatically scale resources based on target metrics."""
    tenant_id = x_tenant_id or "default"

    try:
        result = optimizer_service.auto_scale(pipeline_id, target_metrics, tenant_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-scale: {str(e)}")