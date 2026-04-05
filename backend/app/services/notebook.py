import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from app.services.db import get_connection
from app.services.llm_adapter import get_adapter

class NotebookService:
    """Service for managing interactive notebooks with code execution capabilities."""

    def __init__(self):
        self.notebook_dir = Path(__file__).resolve().parents[1] / "data" / "notebooks"
        self.notebook_dir.mkdir(parents=True, exist_ok=True)

    def create_notebook(self, title: str, tenant_id: str = "default", user_id: str = "anonymous") -> Dict[str, Any]:
        """Create a new notebook with default structure."""
        notebook_id = str(uuid.uuid4())

        notebook = {
            "id": notebook_id,
            "title": title,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "cells": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "markdown",
                    "content": "# Welcome to Nexora Notebook\n\nThis notebook integrates with Nexora's conversion and pipeline capabilities.",
                    "execution_count": None,
                    "outputs": [],
                    "metadata": {}
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "code",
                    "content": "# Import Nexora services\nimport requests\n\n# Example: Convert some code\ncode = \"\"\"PROC SQL;\nSELECT * FROM users;\nQUIT;\"\"\"\n\n# Use Nexora API for conversion\n# response = requests.post('http://localhost:8000/convert', \n#                         files={'file': ('code.sql', code)})\n# print(response.json())",
                    "execution_count": None,
                    "outputs": [],
                    "metadata": {"language": "python"}
                }
            ],
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3",
                    "language": "python",
                    "name": "python3"
                },
                "language_info": {
                    "name": "python",
                    "version": "3.9.0"
                }
            }
        }

        # Save to database
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO notebooks (id, tenant_id, user_id, title, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            notebook_id,
            tenant_id,
            user_id,
            title,
            json.dumps(notebook),
            notebook["created_at"],
            notebook["updated_at"]
        ))

        conn.commit()
        conn.close()

        return notebook

    def get_notebook(self, notebook_id: str, tenant_id: str = "default") -> Optional[Dict[str, Any]]:
        """Retrieve a notebook by ID."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT content FROM notebooks
            WHERE id = ? AND tenant_id = ?
        """, (notebook_id, tenant_id))

        result = cursor.fetchone()
        conn.close()

        if result:
            return json.loads(result[0])
        return None

    def update_notebook(self, notebook_id: str, updates: Dict[str, Any], tenant_id: str = "default") -> Optional[Dict[str, Any]]:
        """Update a notebook with new content."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            return None

        # Apply updates
        notebook.update(updates)
        notebook["updated_at"] = datetime.utcnow().isoformat()

        # Save to database
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE notebooks
            SET content = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
        """, (
            json.dumps(notebook),
            notebook["updated_at"],
            notebook_id,
            tenant_id
        ))

        conn.commit()
        conn.close()

        return notebook

    def list_notebooks(self, tenant_id: str = "default", user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all notebooks for a tenant/user."""
        conn = get_connection()
        cursor = conn.cursor()

        if user_id:
            cursor.execute("""
                SELECT id, title, created_at, updated_at FROM notebooks
                WHERE tenant_id = ? AND user_id = ?
                ORDER BY updated_at DESC
            """, (tenant_id, user_id))
        else:
            cursor.execute("""
                SELECT id, title, created_at, updated_at FROM notebooks
                WHERE tenant_id = ?
                ORDER BY updated_at DESC
            """, (tenant_id,))

        notebooks = []
        for row in cursor.fetchall():
            notebooks.append({
                "id": row[0],
                "title": row[1],
                "created_at": row[2],
                "updated_at": row[3]
            })

        conn.close()
        return notebooks

    def delete_notebook(self, notebook_id: str, tenant_id: str = "default") -> bool:
        """Delete a notebook."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM notebooks
            WHERE id = ? AND tenant_id = ?
        """, (notebook_id, tenant_id))

        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()

        return deleted

    def execute_cell(self, notebook_id: str, cell_id: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Execute a notebook cell and return results."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            raise ValueError("Notebook not found")

        # Find the cell
        cell = None
        for c in notebook["cells"]:
            if c["id"] == cell_id:
                cell = c
                break

        if not cell:
            raise ValueError("Cell not found")

        if cell["type"] != "code":
            raise ValueError("Can only execute code cells")

        # Execute the code (simplified - in production, use Jupyter kernel)
        code = cell["content"]
        outputs = []

        try:
            # Basic Python execution (simplified)
            if "import requests" in code or "requests.post" in code:
                # Mock API call for Nexora integration
                outputs.append({
                    "output_type": "stream",
                    "name": "stdout",
                    "text": "Mock Nexora API call executed successfully\nConverted code would appear here..."
                })
            else:
                # Simple eval for basic expressions
                try:
                    result = eval(code)
                    outputs.append({
                        "output_type": "execute_result",
                        "execution_count": cell.get("execution_count", 0) + 1,
                        "data": {
                            "text/plain": str(result)
                        }
                    })
                except:
                    outputs.append({
                        "output_type": "stream",
                        "name": "stdout",
                        "text": f"Code executed: {code[:50]}..."
                    })

            cell["execution_count"] = cell.get("execution_count", 0) + 1
            cell["outputs"] = outputs

        except Exception as e:
            outputs.append({
                "output_type": "error",
                "ename": type(e).__name__,
                "evalue": str(e),
                "traceback": [str(e)]
            })
            cell["outputs"] = outputs

        # Update the notebook
        self.update_notebook(notebook_id, notebook, tenant_id)

        return {
            "cell_id": cell_id,
            "execution_count": cell["execution_count"],
            "outputs": outputs
        }

    def add_cell(self, notebook_id: str, cell_type: str = "code", content: str = "", after_cell_id: Optional[str] = None, tenant_id: str = "default") -> Dict[str, Any]:
        """Add a new cell to a notebook."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            raise ValueError("Notebook not found")

        new_cell = {
            "id": str(uuid.uuid4()),
            "type": cell_type,
            "content": content,
            "execution_count": None,
            "outputs": [],
            "metadata": {}
        }

        if after_cell_id:
            # Insert after specific cell
            for i, cell in enumerate(notebook["cells"]):
                if cell["id"] == after_cell_id:
                    notebook["cells"].insert(i + 1, new_cell)
                    break
            else:
                # Cell not found, append
                notebook["cells"].append(new_cell)
        else:
            # Append to end
            notebook["cells"].append(new_cell)

        self.update_notebook(notebook_id, notebook, tenant_id)
        return new_cell

    def update_cell(self, notebook_id: str, cell_id: str, updates: Dict[str, Any], tenant_id: str = "default") -> bool:
        """Update a cell's content or metadata."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            return False

        for cell in notebook["cells"]:
            if cell["id"] == cell_id:
                cell.update(updates)
                break
        else:
            return False

        self.update_notebook(notebook_id, notebook, tenant_id)
        return True

    def delete_cell(self, notebook_id: str, cell_id: str, tenant_id: str = "default") -> bool:
        """Delete a cell from a notebook."""
        notebook = self.get_notebook(notebook_id, tenant_id)
        if not notebook:
            return False

        original_length = len(notebook["cells"])
        notebook["cells"] = [cell for cell in notebook["cells"] if cell["id"] != cell_id]

        if len(notebook["cells"]) < original_length:
            self.update_notebook(notebook_id, notebook, tenant_id)
            return True

        return False