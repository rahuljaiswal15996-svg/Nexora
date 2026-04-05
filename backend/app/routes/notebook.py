from fastapi import APIRouter, HTTPException, Header
from typing import List, Dict, Any, Optional
from app.services.notebook import NotebookService

router = APIRouter()
notebook_service = NotebookService()

@router.post("/notebooks")
async def create_notebook(
    title: str,
    x_tenant_id: str | None = Header(None),
    x_user_id: str | None = Header(None)
):
    """Create a new notebook."""
    tenant_id = x_tenant_id or "default"
    user_id = x_user_id or "anonymous"

    try:
        notebook = notebook_service.create_notebook(title, tenant_id, user_id)
        return {"status": "success", "notebook": notebook}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create notebook: {str(e)}")

@router.get("/notebooks")
async def list_notebooks(
    x_tenant_id: str | None = Header(None),
    x_user_id: str | None = Header(None)
) -> List[Dict[str, Any]]:
    """List all notebooks for the tenant/user."""
    tenant_id = x_tenant_id or "default"
    user_id = x_user_id

    try:
        notebooks = notebook_service.list_notebooks(tenant_id, user_id)
        return notebooks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list notebooks: {str(e)}")

@router.get("/notebooks/{notebook_id}")
async def get_notebook(
    notebook_id: str,
    x_tenant_id: str | None = Header(None)
):
    """Get a specific notebook."""
    tenant_id = x_tenant_id or "default"

    try:
        notebook = notebook_service.get_notebook(notebook_id, tenant_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return notebook
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get notebook: {str(e)}")

@router.put("/notebooks/{notebook_id}")
async def update_notebook(
    notebook_id: str,
    updates: Dict[str, Any],
    x_tenant_id: str | None = Header(None)
):
    """Update a notebook."""
    tenant_id = x_tenant_id or "default"

    try:
        notebook = notebook_service.update_notebook(notebook_id, updates, tenant_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return {"status": "success", "notebook": notebook}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update notebook: {str(e)}")

@router.delete("/notebooks/{notebook_id}")
async def delete_notebook(
    notebook_id: str,
    x_tenant_id: str | None = Header(None)
):
    """Delete a notebook."""
    tenant_id = x_tenant_id or "default"

    try:
        deleted = notebook_service.delete_notebook(notebook_id, tenant_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return {"status": "success", "message": "Notebook deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete notebook: {str(e)}")

@router.post("/notebooks/{notebook_id}/cells")
async def add_cell(
    notebook_id: str,
    cell_type: str = "code",
    content: str = "",
    after_cell_id: Optional[str] = None,
    x_tenant_id: str | None = Header(None)
):
    """Add a new cell to a notebook."""
    tenant_id = x_tenant_id or "default"

    try:
        cell = notebook_service.add_cell(notebook_id, cell_type, content, after_cell_id, tenant_id)
        return {"status": "success", "cell": cell}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add cell: {str(e)}")

@router.put("/notebooks/{notebook_id}/cells/{cell_id}")
async def update_cell(
    notebook_id: str,
    cell_id: str,
    updates: Dict[str, Any],
    x_tenant_id: str | None = Header(None)
):
    """Update a cell in a notebook."""
    tenant_id = x_tenant_id or "default"

    try:
        updated = notebook_service.update_cell(notebook_id, cell_id, updates, tenant_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Notebook or cell not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update cell: {str(e)}")

@router.delete("/notebooks/{notebook_id}/cells/{cell_id}")
async def delete_cell(
    notebook_id: str,
    cell_id: str,
    x_tenant_id: str | None = Header(None)
):
    """Delete a cell from a notebook."""
    tenant_id = x_tenant_id or "default"

    try:
        deleted = notebook_service.delete_cell(notebook_id, cell_id, tenant_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Notebook or cell not found")
        return {"status": "success", "message": "Cell deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete cell: {str(e)}")

@router.post("/notebooks/{notebook_id}/cells/{cell_id}/execute")
async def execute_cell(
    notebook_id: str,
    cell_id: str,
    x_tenant_id: str | None = Header(None)
):
    """Execute a notebook cell."""
    tenant_id = x_tenant_id or "default"

    try:
        result = notebook_service.execute_cell(notebook_id, cell_id, tenant_id)
        return {"status": "success", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute cell: {str(e)}")