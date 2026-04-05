from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Any, Dict, List
from app.core.authz import require_editor, require_viewer
from app.services.cloud_connections import CloudConnectionsService

router = APIRouter()
connections_service = CloudConnectionsService()


def _tenant_id(request: Request) -> str:
    return getattr(request.state, "tenant_id", "default")


@router.get("/connections/stats")
async def get_connection_stats(
    request: Request,
    _principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    """Get connection statistics."""
    tenant_id = _tenant_id(request)

    try:
        stats = connections_service.get_connection_stats(tenant_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get connection stats: {str(e)}")


@router.post("/connections")
async def create_connection(
    connection: Dict[str, Any],
    request: Request,
    _principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Create a new cloud connection."""
    tenant_id = _tenant_id(request)

    try:
        result = connections_service.create_connection(connection, tenant_id)
        return {"status": "success", "connection": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create connection: {str(e)}")

@router.get("/connections")
async def list_connections(
    request: Request,
    _principal: Dict[str, Any] = Depends(require_viewer),
) -> List[Dict[str, Any]]:
    """List all connections for the tenant."""
    tenant_id = _tenant_id(request)

    try:
        connections = connections_service.list_connections(tenant_id)
        return connections
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list connections: {str(e)}")

@router.get("/connections/{connection_id}/datasets")
async def list_connection_datasets(
    connection_id: str,
    request: Request,
    _principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    """List datasets discoverable from a connection."""
    tenant_id = _tenant_id(request)

    try:
        datasets = connections_service.list_datasets(connection_id, tenant_id)
        return {"connection_id": connection_id, "datasets": datasets}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list datasets: {str(e)}")


@router.get("/connections/{connection_id}/datasets/preview")
async def preview_connection_dataset(
    connection_id: str,
    request: Request,
    dataset_name: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    _principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    """Return a tabular preview for a dataset exposed by a connection."""
    tenant_id = _tenant_id(request)

    try:
        preview = connections_service.preview_dataset(connection_id, dataset_name, limit, tenant_id)
        return preview
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview dataset: {str(e)}")


@router.get("/connections/{connection_id}/datasets/schema")
async def get_connection_dataset_schema(
    connection_id: str,
    request: Request,
    dataset_name: str = Query(...),
    _principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    """Return schema metadata for a dataset exposed by a connection."""
    tenant_id = _tenant_id(request)

    try:
        schema = connections_service.get_dataset_schema(connection_id, dataset_name, tenant_id)
        return schema
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dataset schema: {str(e)}")


@router.get("/connections/{connection_id}")
async def get_connection(
    connection_id: str,
    request: Request,
    _principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    """Get a specific connection."""
    tenant_id = _tenant_id(request)

    try:
        connection = connections_service.get_connection(connection_id, tenant_id)
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        return connection
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get connection: {str(e)}")

@router.put("/connections/{connection_id}")
async def update_connection(
    connection_id: str,
    updates: Dict[str, Any],
    request: Request,
    _principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Update a connection."""
    tenant_id = _tenant_id(request)

    try:
        updated = connections_service.update_connection(connection_id, updates, tenant_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Connection not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update connection: {str(e)}")

@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    request: Request,
    _principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Delete a connection."""
    tenant_id = _tenant_id(request)

    try:
        deleted = connections_service.delete_connection(connection_id, tenant_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Connection not found")
        return {"status": "success", "message": "Connection deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete connection: {str(e)}")

@router.post("/connections/{connection_id}/test")
async def test_connection(
    connection_id: str,
    request: Request,
    _principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Test a connection."""
    tenant_id = _tenant_id(request)

    try:
        result = connections_service.test_connection(connection_id, tenant_id)
        return {"status": "success", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test connection: {str(e)}")
