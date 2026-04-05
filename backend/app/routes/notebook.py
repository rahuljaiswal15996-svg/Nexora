from fastapi import APIRouter, Body, Depends, HTTPException, Request
from typing import List, Dict, Any, Optional
from app.core.authz import require_editor, require_viewer
from app.services.notebook import NotebookService

router = APIRouter()
notebook_service = NotebookService()

@router.post("/notebooks")
async def create_notebook(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Create a new notebook."""
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Notebook title is required")

    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))
    user_id = str(principal.get("user_id") or "anonymous")

    try:
        notebook = notebook_service.create_notebook(title, tenant_id, user_id)
        return {"status": "success", "notebook": notebook}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create notebook: {str(e)}")

@router.get("/notebooks")
async def list_notebooks(
    request: Request,
    principal: Dict[str, Any] = Depends(require_viewer),
) -> List[Dict[str, Any]]:
    """List all notebooks for the tenant/user."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))
    user_id = principal.get("user_id")
    user_id = str(user_id) if user_id else None

    try:
        notebooks = notebook_service.list_notebooks(tenant_id, user_id)
        return notebooks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list notebooks: {str(e)}")

@router.get("/notebooks/{notebook_id}")
async def get_notebook(
    notebook_id: str,
    request: Request,
    principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    """Get a specific notebook."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

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
    request: Request,
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Update a notebook."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

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
    request: Request,
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Delete a notebook."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

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
    request: Request,
    cell_type: str = "code",
    content: str = "",
    after_cell_id: Optional[str] = None,
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Add a new cell to a notebook."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

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
    request: Request,
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Update a cell in a notebook."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

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
    request: Request,
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Delete a cell from a notebook."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

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
    request: Request,
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Execute a notebook cell."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

    try:
        result = notebook_service.execute_cell(notebook_id, cell_id, tenant_id)
        return {"status": "success", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute cell: {str(e)}")