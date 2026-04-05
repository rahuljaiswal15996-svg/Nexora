from fastapi import APIRouter, HTTPException, Header
from typing import List, Dict, Any
from app.services.cloud_connections import CloudConnectionsService

router = APIRouter()
connections_service = CloudConnectionsService()

@router.post("/connections")
async def create_connection(
    connection: Dict[str, Any],
    x_tenant_id: str | None = Header(None)
):
    """Create a new cloud connection."""
    tenant_id = x_tenant_id or "default"

    try:
        result = connections_service.create_connection(connection, tenant_id)
        return {"status": "success", "connection": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create connection: {str(e)}")

@router.get("/connections")
async def list_connections(
    x_tenant_id: str | None = Header(None)
) -> List[Dict[str, Any]]:
    """List all connections for the tenant."""
    tenant_id = x_tenant_id or "default"

    try:
        connections = connections_service.list_connections(tenant_id)
        return connections
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list connections: {str(e)}")

@router.get("/connections/{connection_id}")
async def get_connection(
    connection_id: str,
    x_tenant_id: str | None = Header(None)
):
    """Get a specific connection."""
    tenant_id = x_tenant_id or "default"

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
    x_tenant_id: str | None = Header(None)
):
    """Update a connection."""
    tenant_id = x_tenant_id or "default"

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
    x_tenant_id: str | None = Header(None)
):
    """Delete a connection."""
    tenant_id = x_tenant_id or "default"

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
    x_tenant_id: str | None = Header(None)
):
    """Test a connection."""
    tenant_id = x_tenant_id or "default"

    try:
        result = connections_service.test_connection(connection_id, tenant_id)
        return {"status": "success", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test connection: {str(e)}")

@router.get("/connections/stats")
async def get_connection_stats(
    x_tenant_id: str | None = Header(None)
):
    """Get connection statistics."""
    tenant_id = x_tenant_id or "default"

    try:
        stats = connections_service.get_connection_stats(tenant_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get connection stats: {str(e)}")