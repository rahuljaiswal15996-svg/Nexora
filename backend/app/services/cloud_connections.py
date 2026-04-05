import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.services.db import get_connection

class CloudConnectionsService:
    """Service for managing cloud provider connections."""

    def __init__(self):
        pass

    def create_connection(self, connection_data: Dict[str, Any], tenant_id: str = "default") -> Dict[str, Any]:
        """Create a new cloud connection."""
        connection_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        connection: Dict[str, Any] = {
            "id": connection_id,
            "tenant_id": tenant_id,
            "name": connection_data["name"],
            "type": connection_data["type"],
            "config": connection_data["config"],
            "status": "created",
            "created_at": timestamp,
            "updated_at": timestamp,
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

        connections: List[Dict[str, Any]] = []
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
        connection["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Save to database
        conn = get_connection()
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

    def _dataset_catalog(self, connection: Dict[str, Any]) -> List[Dict[str, Any]]:
        connection_type = connection["type"]
        config = connection.get("config", {})
        bucket_name = config.get("bucket_name") or connection["name"].lower().replace(" ", "-")
        warehouse_name = connection["name"].upper().replace(" ", "_")

        base_catalog: Dict[str, List[Dict[str, Any]]] = {
            "aws_s3": [
                {
                    "name": f"{bucket_name}/orders.csv",
                    "kind": "file",
                    "description": "Transactional order feed",
                    "columns": [
                        {"name": "order_id", "type": "string"},
                        {"name": "customer_id", "type": "string"},
                        {"name": "region", "type": "string"},
                        {"name": "amount", "type": "double"},
                        {"name": "order_date", "type": "date"},
                    ],
                    "rows": [
                        {"order_id": "SO-1001", "customer_id": "C-001", "region": "NA", "amount": 1840.5, "order_date": "2026-03-01"},
                        {"order_id": "SO-1002", "customer_id": "C-002", "region": "EMEA", "amount": 920.0, "order_date": "2026-03-03"},
                        {"order_id": "SO-1003", "customer_id": "C-003", "region": "APAC", "amount": 125.75, "order_date": "2026-03-05"},
                    ],
                    "row_count_estimate": 14820,
                },
                {
                    "name": f"{bucket_name}/customers.parquet",
                    "kind": "file",
                    "description": "Customer dimension snapshot",
                    "columns": [
                        {"name": "customer_id", "type": "string"},
                        {"name": "segment", "type": "string"},
                        {"name": "status", "type": "string"},
                        {"name": "lifetime_value", "type": "double"},
                    ],
                    "rows": [
                        {"customer_id": "C-001", "segment": "Enterprise", "status": "active", "lifetime_value": 15420.2},
                        {"customer_id": "C-002", "segment": "Mid Market", "status": "active", "lifetime_value": 8140.0},
                        {"customer_id": "C-003", "segment": "SMB", "status": "prospect", "lifetime_value": 640.7},
                    ],
                    "row_count_estimate": 8420,
                },
            ],
            "snowflake": [
                {
                    "name": f"RAW.{warehouse_name}.ORDERS",
                    "kind": "table",
                    "description": "Snowflake landing table for orders",
                    "columns": [
                        {"name": "ORDER_ID", "type": "VARCHAR"},
                        {"name": "CUSTOMER_ID", "type": "VARCHAR"},
                        {"name": "AMOUNT", "type": "NUMBER"},
                        {"name": "LOAD_TS", "type": "TIMESTAMP"},
                    ],
                    "rows": [
                        {"ORDER_ID": "SO-1001", "CUSTOMER_ID": "C-001", "AMOUNT": 1840.5, "LOAD_TS": "2026-04-05T09:00:00Z"},
                        {"ORDER_ID": "SO-1002", "CUSTOMER_ID": "C-002", "AMOUNT": 920.0, "LOAD_TS": "2026-04-05T09:05:00Z"},
                    ],
                    "row_count_estimate": 240512,
                },
                {
                    "name": f"CURATED.{warehouse_name}.CUSTOMER_360",
                    "kind": "view",
                    "description": "Curated customer mart",
                    "columns": [
                        {"name": "CUSTOMER_ID", "type": "VARCHAR"},
                        {"name": "TIER", "type": "VARCHAR"},
                        {"name": "ARR", "type": "NUMBER"},
                    ],
                    "rows": [
                        {"CUSTOMER_ID": "C-001", "TIER": "gold", "ARR": 54200},
                        {"CUSTOMER_ID": "C-002", "TIER": "silver", "ARR": 22300},
                    ],
                    "row_count_estimate": 18005,
                },
            ],
            "bigquery": [
                {
                    "name": f"analytics.{bucket_name.replace('-', '_')}_sessions",
                    "kind": "table",
                    "description": "Sessionized clickstream data",
                    "columns": [
                        {"name": "session_id", "type": "STRING"},
                        {"name": "user_id", "type": "STRING"},
                        {"name": "channel", "type": "STRING"},
                        {"name": "session_revenue", "type": "FLOAT"},
                    ],
                    "rows": [
                        {"session_id": "S-101", "user_id": "U-11", "channel": "paid_search", "session_revenue": 199.0},
                        {"session_id": "S-102", "user_id": "U-12", "channel": "organic", "session_revenue": 0.0},
                    ],
                    "row_count_estimate": 930122,
                },
            ],
            "redshift": [
                {
                    "name": "public.fact_orders",
                    "kind": "table",
                    "description": "Warehouse fact table",
                    "columns": [
                        {"name": "order_id", "type": "varchar"},
                        {"name": "warehouse_id", "type": "varchar"},
                        {"name": "shipped_qty", "type": "integer"},
                    ],
                    "rows": [
                        {"order_id": "SO-1001", "warehouse_id": "WH-01", "shipped_qty": 12},
                        {"order_id": "SO-1002", "warehouse_id": "WH-02", "shipped_qty": 3},
                    ],
                    "row_count_estimate": 56128,
                },
            ],
        }

        return base_catalog.get(connection_type, [
            {
                "name": f"{connection['name'].lower().replace(' ', '_')}_sample",
                "kind": "table",
                "description": "Sample dataset generated from connection metadata",
                "columns": [
                    {"name": "record_id", "type": "string"},
                    {"name": "status", "type": "string"},
                    {"name": "updated_at", "type": "timestamp"},
                ],
                "rows": [
                    {"record_id": "R-001", "status": "active", "updated_at": "2026-04-06T10:00:00Z"},
                    {"record_id": "R-002", "status": "draft", "updated_at": "2026-04-06T10:05:00Z"},
                ],
                "row_count_estimate": 2500,
            }
        ])

    def list_datasets(self, connection_id: str, tenant_id: str = "default") -> List[Dict[str, Any]]:
        connection = self.get_connection(connection_id, tenant_id)
        if not connection:
            raise ValueError("Connection not found")

        datasets: List[Dict[str, Any]] = []
        for dataset in self._dataset_catalog(connection):
            datasets.append({
                "name": dataset["name"],
                "kind": dataset["kind"],
                "description": dataset["description"],
                "column_count": len(dataset["columns"]),
                "row_count_estimate": dataset["row_count_estimate"],
            })
        return datasets

    def get_dataset_schema(self, connection_id: str, dataset_name: str, tenant_id: str = "default") -> Dict[str, Any]:
        connection = self.get_connection(connection_id, tenant_id)
        if not connection:
            raise ValueError("Connection not found")

        for dataset in self._dataset_catalog(connection):
            if dataset["name"] == dataset_name:
                return {
                    "dataset_name": dataset_name,
                    "columns": dataset["columns"],
                    "kind": dataset["kind"],
                    "description": dataset["description"],
                }
        raise ValueError("Dataset not found")

    def preview_dataset(
        self,
        connection_id: str,
        dataset_name: str,
        limit: int = 20,
        tenant_id: str = "default",
    ) -> Dict[str, Any]:
        connection = self.get_connection(connection_id, tenant_id)
        if not connection:
            raise ValueError("Connection not found")

        for dataset in self._dataset_catalog(connection):
            if dataset["name"] == dataset_name:
                rows = dataset["rows"][: max(1, min(limit, 100))]
                return {
                    "connection_id": connection_id,
                    "connection_name": connection["name"],
                    "dataset_name": dataset_name,
                    "kind": dataset["kind"],
                    "description": dataset["description"],
                    "columns": dataset["columns"],
                    "rows": rows,
                    "row_count_estimate": dataset["row_count_estimate"],
                    "sample_size": len(rows),
                }
        raise ValueError("Dataset not found")

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
        test_result: Dict[str, Any] = {
            "success": True,
            "message": "Connection test successful",
                "timestamp": datetime.now(timezone.utc).isoformat(),
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
                "timestamp": datetime.now(timezone.utc).isoformat(),
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
            "generated_at": datetime.now(timezone.utc).isoformat()
        }