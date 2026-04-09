import json
from typing import Any, Dict, List, Optional, cast

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.core.authz import require_editor, require_viewer
from app.services.notebook import NotebookService

router = APIRouter()
notebook_service = NotebookService()


@router.post("/notebooks/open")
async def open_notebook_workspace(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    """Open Notebook Workspace from a dataset, flow node, or notebook context."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))
    user_id = str(principal.get("user_id") or "anonymous")
    raw_source = payload.get("source")
    if isinstance(raw_source, dict):
        source: Dict[str, Any] = cast(Dict[str, Any], raw_source).copy()
    else:
        source = {key: value for key, value in payload.items()}

    try:
        return notebook_service.open_workspace(source, tenant_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to open notebook workspace: {str(exc)}") from exc

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
    metadata = dict(payload.get("metadata") or {})
    if payload.get("project_id"):
        metadata["project_id"] = str(payload.get("project_id"))
    if payload.get("workspace_id"):
        metadata["workspace_id"] = str(payload.get("workspace_id"))

    try:
        notebook = notebook_service.create_notebook(title, tenant_id, user_id, metadata=metadata)
        return {"status": "success", "notebook": notebook}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create notebook: {str(e)}")


@router.post("/notebooks/{notebook_id}/flow-binding")
async def bind_notebook_to_flow(
    notebook_id: str,
    request: Request,
    payload: Dict[str, Any] = Body(...),
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Attach or update a notebook node inside an existing flow pipeline."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

    try:
        return notebook_service.attach_to_flow(notebook_id, payload, tenant_id)
    except ValueError as exc:
        detail = str(exc)
        if detail.startswith("{"):
            try:
                raise HTTPException(status_code=400, detail=json.loads(detail))
            except json.JSONDecodeError:
                pass
        status_code = 404 if "not found" in detail.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to bind notebook to flow: {str(exc)}") from exc

@router.get("/notebooks")
async def list_notebooks(
    request: Request,
    project_id: str | None = Query(None),
    workspace_id: str | None = Query(None),
    principal: Dict[str, Any] = Depends(require_viewer),
) -> List[Dict[str, Any]]:
    """List all notebooks for the tenant/user."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))
    user_id = principal.get("user_id")
    user_id = str(user_id) if user_id else None

    try:
        notebooks = notebook_service.list_notebooks(
            tenant_id,
            user_id,
            project_id=(project_id or "").strip() or None,
            workspace_id=(workspace_id or "").strip() or None,
        )
        return notebooks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list notebooks: {str(e)}")


@router.post("/notebooks/backfill-scope")
async def backfill_notebook_scope(
    request: Request,
    include_existing: bool = False,
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

    try:
        result = notebook_service.backfill_scope_columns(tenant_id=tenant_id, include_existing=include_existing)
        return {"status": "ok", **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to backfill notebook scope: {str(exc)}") from exc


@router.get("/notebooks/scope-gaps")
async def get_notebook_scope_gaps(
    request: Request,
    limit: int = Query(100, ge=1, le=500),
    principal: Dict[str, Any] = Depends(require_viewer),
) -> Dict[str, Any]:
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

    try:
        return notebook_service.list_scope_gaps(tenant_id, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list notebook scope gaps: {str(exc)}") from exc

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


@router.post("/notebooks/{notebook_id}/executions")
async def execute_notebook(
    notebook_id: str,
    request: Request,
    payload: Dict[str, Any] = Body(...),
    principal: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Compile notebook cells into a transient pipeline and execute them through the shared runtime."""
    tenant_id = str(principal.get("tenant_id") or getattr(request.state, "tenant_id", "default"))

    try:
        result = notebook_service.execute_notebook(notebook_id, payload, tenant_id)
        return result
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if "not found" in detail.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to execute notebook: {str(exc)}") from exc