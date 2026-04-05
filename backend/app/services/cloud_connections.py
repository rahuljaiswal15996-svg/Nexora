import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.services.db import get_connection

class CloudConnectionsService:
    """Service for managing cloud provider connections."""

    def __init__(self):
        pass

    def create_connection(self, connection_data: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        """Create a new cloud connection."""
        connection_id = str(uuid.uuid4())

        connection = {
            "id": connection_id,
            "tenant_id": tenant_id,
            "name": connection_data["name"],
            "type": connection_data["type"],
            "config": connection_data["config"],
            "status": "created",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "last_tested": None,
            "last_test_result": None
        }

        # Save to database
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO connections (id, tenant_id, name, type, config, status, created_at, updated_at, last_tested, last_test_result)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            connection_id,
            tenant_id,
            connection["name"],
            connection["type"],
            json.dumps(connection["config"]),
            connection["status"],
            connection["created_at"],
            connection["updated_at"],
            connection["last_tested"],
            json.dumps(connection["last_test_result"]) if connection["last_test_result"] else None
        ))

        conn.commit()
        conn.close()

        return connection

    def get_connection(self, connection_id: str, tenant_id: str = "default") -> Optional[Dict[str, Any]]:
        """Retrieve a connection by ID."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, type, config, status, created_at, updated_at, last_tested, last_test_result
            FROM connections
            WHERE id = ? AND tenant_id = ?
        """, (connection_id, tenant_id))

        result = cursor.fetchone()
        conn.close()

        if result:
            return {
                "id": result[0],
                "name": result[1],
                "type": result[2],
                "config": json.loads(result[3]),
                "status": result[4],
                "created_at": result[5],
                "updated_at": result[6],
                "last_tested": result[7],
                "last_test_result": json.loads(result[8]) if result[8] else None
            }
        return None

    def list_connections(self, tenant_id: str = "default") -> List[Dict[str, Any]]:
        """List all connections for a tenant."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, type, status, created_at, updated_at, last_tested, last_test_result
            FROM connections
            WHERE tenant_id = ?
            ORDER BY created_at DESC
        """, (tenant_id,))

        connections = []
        for row in cursor.fetchall():
            connections.append({
                "id": row[0],
                "name": row[1],
                "type": row[2],
                "status": row[3],
                "created_at": row[4],
                "updated_at": row[5],
                "last_tested": row[6],
                "last_test_result": json.loads(row[7]) if row[7] else None
            })

        conn.close()
        return connections

    def update_connection(self, connection_id: str, updates: Dict[str, Any], tenant_id: str = "default") -> bool:
        """Update a connection."""
        connection = self.get_connection(connection_id, tenant_id)
        if not connection:
            return False

        # Apply updates
        connection.update(updates)
        connection["updated_at"] = datetime.utcnow().isoformat()

        # Save to database
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE connections
            SET name = ?, type = ?, config = ?, status = ?, updated_at = ?, last_tested = ?, last_test_result = ?
            WHERE id = ? AND tenant_id = ?
        """, (
            connection["name"],
            connection["type"],
            json.dumps(connection["config"]),
            connection["status"],
            connection["updated_at"],
            connection["last_tested"],
            json.dumps(connection["last_test_result"]) if connection["last_test_result"] else None,
            connection_id,
            tenant_id
        ))

        updated = cursor.rowcount > 0
        conn.commit()
        conn.close()

        return updated

    def delete_connection(self, connection_id: str, tenant_id: str = "default") -> bool:
        """Delete a connection."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM connections
            WHERE id = ? AND tenant_id = ?
        """, (connection_id, tenant_id))

        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()

        return deleted

    def test_connection(self, connection_id: str, tenant_id: str = "default") -> Dict[str, Any]:
        """Test a connection and return the result."""
        connection = self.get_connection(connection_id, tenant_id)
        if not connection:
            raise ValueError("Connection not found")

        # Simulate connection testing (in production, this would actually test the connection)
        test_result = {
            "success": True,
            "message": "Connection test successful",
            "timestamp": datetime.utcnow().isoformat(),
            "details": {
                "connection_type": connection["type"],
                "response_time": "150ms",
                "status_code": 200
            }
        }

        # For demo purposes, randomly fail some tests
        import random
        if random.random() < 0.2:  # 20% chance of failure
            test_result = {
                "success": False,
                "message": "Connection failed: Invalid credentials or network error",
                "timestamp": datetime.utcnow().isoformat(),
                "details": {
                    "error": "Authentication failed",
                    "status_code": 401
                }
            }

        # Update connection with test results
        self.update_connection(connection_id, {
            "last_tested": test_result["timestamp"],
            "last_test_result": test_result,
            "status": "connected" if test_result["success"] else "error"
        }, tenant_id)

        return test_result

    def get_connection_stats(self, tenant_id: str = "default") -> Dict[str, Any]:
        """Get connection statistics for a tenant."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                COUNT(*) as total_connections,
                SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as active_connections,
                SUM(CASE WHEN last_test_result LIKE '%success%' THEN 1 ELSE 0 END) as successful_tests
            FROM connections
            WHERE tenant_id = ?
        """, (tenant_id,))

        result = cursor.fetchone()
        conn.close()

        return {
            "total_connections": result[0] if result else 0,
            "active_connections": result[1] if result else 0,
            "successful_tests": result[2] if result else 0,
            "generated_at": datetime.utcnow().isoformat()
        }