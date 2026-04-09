#!/usr/bin/env python3
"""
Comprehensive Test Script for Nexora Data Transformation Platform

This script tests all API endpoints, ingestion workflows, and UI functionality
to ensure the platform works end-to-end.

Test Coverage:
- API Endpoints (GET/POST)
- File Ingestion Workflow
- Pipeline Creation and Execution
- Notebook Operations
- History Tracking
- UI Component Functionality
"""

import requests
import time
from typing import Any, Dict, List, Optional, cast

# Configuration
BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"

class NexoraTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.frontend_url = FRONTEND_URL
        self.test_results: List[Dict[str, Any]] = []
        self.created_resources: List[Dict[str, str]] = []
        self.default_headers: Dict[str, str] = {
            "X-Tenant-Id": "default",
            "X-User-Id": "comprehensive-tester",
            "X-User-Role": "admin",
        }
        self.auth_token: Optional[str] = None

    def log_test(self, test_name: str, status: str, details: str = "", error: str = ""):
        """Log test results"""
        result: Dict[str, Any] = {
            "test": test_name,
            "status": status,
            "details": details,
            "error": error,
            "timestamp": time.time()
        }
        self.test_results.append(result)
        print(f"[{status.upper()}] {test_name}")
        if details:
            print(f"  Details: {details}")
        if error:
            print(f"  Error: {error}")

    def _error_text(self, result: Dict[str, Any]) -> str:
        return str(result.get("error") or "Unknown error")

    def _response_as_list(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        response = result.get("response")
        if isinstance(response, list):
            items: List[Dict[str, Any]] = []
            for item in cast(List[Any], response):
                if isinstance(item, dict):
                    items.append(cast(Dict[str, Any], item))
            return items
        return []

    def _notebook_payload(self, result: Dict[str, Any]) -> Dict[str, Any]:
        response = result.get("response")
        if not isinstance(response, dict):
            return {}
        response_dict = cast(Dict[str, Any], response)
        notebook = response_dict.get("notebook")
        if not isinstance(notebook, dict):
            return {}
        return cast(Dict[str, Any], notebook)

    def test_api_endpoint(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Test an API endpoint"""
        url = f"{self.base_url}{endpoint}"
        request_headers = {**self.default_headers}
        if self.auth_token:
            request_headers["Authorization"] = f"Bearer {self.auth_token}"
        if headers:
            request_headers.update(headers)
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=request_headers, timeout=20)
            elif method.upper() == "POST":
                if files:
                    response = requests.post(url, data=data, files=files, headers=request_headers, timeout=20)
                else:
                    response = requests.post(url, json=data, headers=request_headers, timeout=20)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=request_headers, timeout=20)
            else:
                raise ValueError(f"Unsupported method: {method}")

            return {
                "status_code": response.status_code,
                "response": response.json() if 'application/json' in response.headers.get('content-type', '') else response.text,
                "headers": dict(response.headers),
                "success": response.status_code < 400
            }
        except Exception as e:
            return {
                "status_code": None,
                "response": None,
                "error": str(e),
                "success": False
            }

    def test_ingestion_workflow(self):
        """Test complete file ingestion workflow"""
        print("\n=== TESTING INGESTION WORKFLOW ===")

        # Test 1: Upload endpoint
        self.log_test("Upload Endpoint", "running")
        result = self.test_api_endpoint("POST", "/upload", files={"file": ("test.sql", "SELECT * FROM users;")})
        if result["success"]:
            self.log_test("Upload Endpoint", "passed", f"Response: {result['response']}")
        else:
            self.log_test("Upload Endpoint", "failed", error=result.get("error", "Unknown error"))

        # Test 2: Convert endpoint
        self.log_test("Convert Endpoint", "running")
        result = self.test_api_endpoint("POST", "/convert", files={"file": ("test.sql", "SELECT * FROM users;")})
        if result["success"]:
            self.log_test("Convert Endpoint", "passed", f"Converted code with status: {result['response'].get('status', 'unknown')}")
            if "comparison" in result["response"]:
                self.log_test("Convert Endpoint", "info", f"Code changes: {result['response']['comparison']}")
        else:
            self.log_test("Convert Endpoint", "failed", error=result.get("error", "Unknown error"))

        # Test 3: Parse endpoint
        self.log_test("Parse Endpoint", "running")
        result = self.test_api_endpoint("POST", "/parse", files={"file": ("test.py", "def hello(): return 'world'")})
        if result["success"]:
            self.log_test("Parse Endpoint", "passed", f"UIR created with ID: {result['response'].get('uir_id', 'unknown')}")
            self.created_resources.append({"type": "uir", "id": result["response"].get("uir_id")})
        else:
            self.log_test("Parse Endpoint", "failed", error=result.get("error", "Unknown error"))

    def test_pipeline_operations(self):
        """Test pipeline creation and execution"""
        print("\n=== TESTING PIPELINE OPERATIONS ===")

        # Test 1: Create pipeline
        self.log_test("Create Pipeline", "running")
        pipeline_dag: Dict[str, Any] = {
            "nodes": [
                {"id": "1", "type": "input", "data": {"label": "Input"}},
                {"id": "2", "type": "transform", "data": {"label": "Transform"}},
                {"id": "3", "type": "output", "data": {"label": "Output"}}
            ],
            "edges": [
                {"source": "1", "target": "2"},
                {"source": "2", "target": "3"}
            ]
        }

        result = self.test_api_endpoint("POST", "/pipelines", data={"name": "Test Pipeline", "dag": pipeline_dag})
        if result["success"]:
            pipeline_id = result["response"].get("pipeline_id")
            self.log_test("Create Pipeline", "passed", f"Pipeline ID: {pipeline_id}")
            self.created_resources.append({"type": "pipeline", "id": pipeline_id})

            # Test 2: Get pipeline
            self.log_test("Get Pipeline", "running")
            result = self.test_api_endpoint("GET", f"/pipelines/{pipeline_id}")
            if result["success"]:
                self.log_test("Get Pipeline", "passed", f"Retrieved pipeline: {result['response'].get('name')}")
            else:
                self.log_test("Get Pipeline", "failed", error=self._error_text(result))

            # Test 3: Start pipeline run
            self.log_test("Start Pipeline Run", "running")
            result = self.test_api_endpoint("POST", f"/pipelines/{pipeline_id}/runs", data={"run_config": {}})
            if result["success"]:
                run_id = result["response"].get("run_id")
                self.log_test("Start Pipeline Run", "passed", f"Run ID: {run_id}")
                self.created_resources.append({"type": "run", "id": run_id})

                # Test 4: Get run status
                self.log_test("Get Run Status", "running")
                time.sleep(2)  # Wait for run to process
                result = self.test_api_endpoint("GET", f"/pipelines/runs/{run_id}")
                if result["success"]:
                    self.log_test("Get Run Status", "passed", f"Status: {result['response'].get('status')}")
                else:
                    self.log_test("Get Run Status", "failed", error=self._error_text(result))
            else:
                self.log_test("Start Pipeline Run", "failed", error=self._error_text(result))
        else:
            self.log_test("Create Pipeline", "failed", error=self._error_text(result))

    def test_notebook_operations(self):
        """Test notebook CRUD operations"""
        print("\n=== TESTING NOTEBOOK OPERATIONS ===")

        # Test 1: Create notebook
        self.log_test("Create Notebook", "running")
        result = self.test_api_endpoint("POST", "/notebooks", data={"title": "Test Notebook"})
        if result["success"]:
            notebook_payload = self._notebook_payload(result)
            notebook_id = notebook_payload.get("id")
            self.log_test("Create Notebook", "passed", f"Notebook ID: {notebook_id}")
            if notebook_id:
                self.created_resources.append({"type": "notebook", "id": str(notebook_id)})

            # Test 2: List notebooks
            self.log_test("List Notebooks", "running")
            result = self.test_api_endpoint("GET", "/notebooks")
            if result["success"]:
                notebooks = self._response_as_list(result)
                self.log_test("List Notebooks", "passed", f"Found {len(notebooks)} notebooks")
            else:
                self.log_test("List Notebooks", "failed", error=self._error_text(result))

            # Test 3: Get notebook
            self.log_test("Get Notebook", "running")
            result = self.test_api_endpoint("GET", f"/notebooks/{notebook_id}")
            if result["success"]:
                notebook_detail = cast(Dict[str, Any], result["response"])
                self.log_test("Get Notebook", "passed", f"Title: {notebook_detail.get('title')}")
            else:
                self.log_test("Get Notebook", "failed", error=self._error_text(result))
                notebook_detail = {}

            # Test 4: Update notebook
            self.log_test("Update Notebook", "running")
            result = self.test_api_endpoint("PUT", f"/notebooks/{notebook_id}",
                                          data={"title": "Updated Test Notebook", "metadata": {"runtime_defaults": {"target": "local", "profile": "local"}}})
            if result["success"]:
                self.log_test("Update Notebook", "passed", "Notebook updated successfully")
            else:
                self.log_test("Update Notebook", "failed", error=self._error_text(result))

            code_cell_id = ""
            for cell in cast(List[Any], notebook_detail.get("cells") or []):
                if isinstance(cell, dict):
                    notebook_cell = cast(Dict[str, Any], cell)
                    if notebook_cell.get("type") != "code":
                        continue
                    code_cell_id = str(notebook_cell.get("id") or "")
                    break

            if code_cell_id:
                self.log_test("Update Notebook Cell", "running")
                result = self.test_api_endpoint(
                    "PUT",
                    f"/notebooks/{notebook_id}/cells/{code_cell_id}",
                    data={"content": "1 + 1", "metadata": {"language": "python"}},
                )
                if result["success"]:
                    self.log_test("Update Notebook Cell", "passed", f"Updated code cell: {code_cell_id}")
                else:
                    self.log_test("Update Notebook Cell", "failed", error=self._error_text(result))

                self.log_test("Execute Notebook Cell", "running")
                result = self.test_api_endpoint(
                    "POST",
                    f"/notebooks/{notebook_id}/executions",
                    data={"mode": "cell", "cell_id": code_cell_id, "runtime_target": "local"},
                )
                if result["success"]:
                    response = cast(Dict[str, Any], result["response"])
                    execution_notebook = cast(Dict[str, Any], response.get("notebook") or {})
                    execution_cells: Dict[str, Dict[str, Any]] = {}
                    for item in cast(List[Any], execution_notebook.get("cells") or []):
                        if not isinstance(item, dict):
                            continue
                        cell_payload = cast(Dict[str, Any], item)
                        execution_cells[str(cell_payload.get("id") or "")] = cell_payload
                    executed_cell = execution_cells.get(code_cell_id, {})
                    outputs = cast(List[Any], executed_cell.get("outputs") or [])
                    run_id = str(response.get("run_id") or "")
                    self.log_test(
                        "Execute Notebook Cell",
                        "passed",
                        f"Run ID: {run_id or 'n/a'} · Execution count: {executed_cell.get('execution_count')} · Outputs: {len(outputs)}",
                    )

                    if run_id:
                        self.log_test("Get Notebook Execution Run Status", "running")
                        terminal_status = "queued"
                        for _ in range(40):
                            run_result = self.test_api_endpoint("GET", f"/pipelines/runs/{run_id}")
                            if not run_result["success"]:
                                break
                            run_payload = cast(Dict[str, Any], run_result.get("response") or {})
                            terminal_status = str(run_payload.get("status") or "unknown")
                            if terminal_status not in {"queued", "running", "queued_remote", "running_remote"}:
                                break
                            time.sleep(0.2)

                        if terminal_status == "success":
                            self.log_test("Get Notebook Execution Run Status", "passed", f"Status: {terminal_status}")
                        else:
                            self.log_test("Get Notebook Execution Run Status", "failed", error=f"Unexpected notebook run status: {terminal_status}")
                else:
                    self.log_test("Execute Notebook Cell", "failed", error=self._error_text(result))
            else:
                self.log_test("Execute Notebook Cell", "failed", error="Created notebook did not include a code cell to execute")
        else:
            self.log_test("Create Notebook", "failed", error=self._error_text(result))

    def test_history_operations(self):
        """Test history tracking"""
        print("\n=== TESTING HISTORY OPERATIONS ===")

        # Test 1: Get history
        self.log_test("Get History", "running")
        result = self.test_api_endpoint("GET", "/history")
        if result["success"]:
            history_items = self._response_as_list(result)
            self.log_test("Get History", "passed", f"Found {len(history_items)} history items")
        else:
            self.log_test("Get History", "failed", error=self._error_text(result))

    def test_frontend_pages(self):
        """Test frontend page accessibility"""
        print("\n=== TESTING FRONTEND PAGES ===")

        pages = [
            "/",
            "/home",
            "/migration-studio",
            "/flow",
            "/notebooks",
            "/catalog",
            "/runtime",
            "/connections",
            "/governance/policies",
            "/pipelines",
            "/upload",
            "/history",
            "/compare",
            "/review"
        ]

        for page in pages:
            self.log_test(f"Frontend Page: {page}", "running")
            try:
                response = requests.get(f"{self.frontend_url}{page}", timeout=10)
                if response.status_code == 200:
                    self.log_test(f"Frontend Page: {page}", "passed", f"Status: {response.status_code}")
                else:
                    self.log_test(f"Frontend Page: {page}", "warning", f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Frontend Page: {page}", "failed", error=str(e))

    def test_ui_buttons_functionality(self):
        """Test UI button functionality descriptions"""
        print("\n=== UI BUTTON FUNCTIONALITY MAPPING ===")

        ui_components = {
            "Home Summary": {
                "Start Modernization Batch": "GET /migration-studio - Open the migration intake workspace",
                "Open Flow Builder": "GET /flow - Continue production graph authoring",
                "Launch Jupyter Workspace": "GET /notebooks?mode=new - Open a new notebook-first workbench",
                "Open Runtime Ops": "GET /runtime - Inspect jobs, runs, agents, and deployments"
            },
            "Migration Studio": {
                "Upload File": "POST /upload - Upload file for processing",
                "Convert": "POST /convert - Convert code using AI engine",
                "Parse": "POST /parse - Parse code to UIR format"
            },
            "Flow Builder": {
                "Validate Graph": "POST /pipelines/validate - Validate the current authoring DAG",
                "Run Flow": "POST /pipelines/{id}/runs - Execute the saved production flow",
                "Save Flow Draft": "PUT /pipelines/{id} - Persist the current flow graph",
                "Open Jupyter Workspace": "GET /notebooks?node={node_id}&pipeline={pipeline_id} - Open node-linked notebook context"
            },
            "Notebook Workspace": {
                "Create Notebook": "POST /notebooks - Create new notebook",
                "Run Cell": "POST /notebooks/{id}/executions - Run the selected notebook cell through the shared pipeline runtime",
                "Run All": "POST /notebooks/{id}/executions - Run the active notebook through the shared pipeline runtime",
                "Save Notebook": "PUT /notebooks/{id} - Save notebook changes",
                "Attach To Flow": "POST /notebooks/{id}/flow-binding - Persist notebook-to-flow linkage"
            },
            "Runtime Ops": {
                "Retry Job": "POST /jobs/{id}/retry - Requeue terminal control-plane work",
                "Rollback Deployment": "POST /deployments/{id}/rollback - Queue a rollback job for a deployment"
            }
        }

        for component, buttons in ui_components.items():
            print(f"\n{component}:")
            for button, functionality in buttons.items():
                print(f"  • {button}: {functionality}")

    def test_api_endpoints_comprehensive(self):
        """Test all API endpoints comprehensively"""
        print("\n=== COMPREHENSIVE API ENDPOINT TESTING ===")

        endpoints: List[Dict[str, Any]] = [
            {"method": "GET", "endpoint": "/status", "description": "System status check", "expected_statuses": [200]},
            {"method": "GET", "endpoint": "/metrics", "description": "System metrics", "expected_statuses": [200]},
            {"method": "GET", "endpoint": "/history", "description": "Conversion history", "expected_statuses": [200]},
            {
                "method": "POST",
                "endpoint": "/auth/token",
                "description": "Development auth token issuance",
                "data": {"tenant_id": "default", "user": "comprehensive@test.local", "role": "admin"},
                "expected_statuses": [200],
            },
            {"method": "GET", "endpoint": "/projects", "description": "Project portfolio", "expected_statuses": [200]},
            {"method": "GET", "endpoint": "/catalog/datasets", "description": "Catalog dataset inventory", "expected_statuses": [200]},
            {"method": "GET", "endpoint": "/jobs", "description": "Runtime job queue", "expected_statuses": [200]},
            {"method": "POST", "endpoint": "/validate", "description": "Code validation", "expect_validation_error": True},
            {"method": "POST", "endpoint": "/deploy", "description": "Code deployment", "expect_validation_error": True},
            {"method": "GET", "endpoint": "/shadow", "description": "Shadow run inventory", "expected_statuses": [200]},
            {
                "method": "POST",
                "endpoint": "/shadow",
                "description": "Create shadow comparison run",
                "data": {"input_type": "code", "input": "SELECT 1;", "threshold": 0.8},
                "expected_statuses": [200],
            },
            {"method": "GET", "endpoint": "/connections", "description": "List data connections", "expected_statuses": [200]},
            {"method": "POST", "endpoint": "/connections", "description": "Create data connection", "expect_validation_error": True},
        ]

        for spec in endpoints:
            method = str(spec["method"])
            endpoint = str(spec["endpoint"])
            description = str(spec["description"])
            self.log_test(f"{method} {endpoint}", "running", description)
            result = self.test_api_endpoint(
                method,
                endpoint,
                data=cast(Optional[Dict[str, Any]], spec.get("data")),
                files=cast(Optional[Dict[str, Any]], spec.get("files")),
                headers=cast(Optional[Dict[str, str]], spec.get("headers")),
            )
            expected_statuses = cast(List[int], spec.get("expected_statuses") or [])
            expect_validation_error = bool(spec.get("expect_validation_error"))

            if result["status_code"] in expected_statuses:
                if endpoint == "/auth/token" and isinstance(result.get("response"), dict):
                    auth_response = cast(Dict[str, Any], result["response"])
                    access_token = auth_response.get("access_token")
                    if isinstance(access_token, str) and access_token:
                        self.auth_token = access_token
                self.log_test(f"{method} {endpoint}", "passed", f"Status: {result['status_code']}")
            elif expect_validation_error and result["status_code"] in [400, 422] and "detail" in str(result.get("response", "")):
                self.log_test(f"{method} {endpoint}", "passed", "Expected validation error for missing data")
            elif result["success"]:
                self.log_test(f"{method} {endpoint}", "passed", f"Status: {result['status_code']}")
            else:
                self.log_test(f"{method} {endpoint}", "failed", f"Status: {result['status_code']}", self._error_text(result))

    def generate_test_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*80)
        print("NEXORA COMPREHENSIVE TEST REPORT")
        print("="*80)

        terminal_results = [r for r in self.test_results if r["status"] in {"passed", "failed", "warning"}]
        info_results = [r for r in self.test_results if r["status"] == "info"]
        passed = len([r for r in terminal_results if r["status"] == "passed"])
        failed = len([r for r in terminal_results if r["status"] == "failed"])
        warning = len([r for r in terminal_results if r["status"] == "warning"])
        total = len(terminal_results)
        success_rate = (passed / total * 100) if total else 0.0

        print(f"\nTest Summary:")
        print(f"  Total Tests: {total}")
        print(f"  Passed: {passed}")
        print(f"  Failed: {failed}")
        print(f"  Warnings: {warning}")
        print(f"  Success Rate: {success_rate:.1f}%")
        print("\nDetailed Results:")
        for result in terminal_results:
            status_icon = "✓" if result["status"] == "passed" else "✗" if result["status"] == "failed" else "⚠"
            print(f"  {status_icon} {result['test']}: {result['status'].upper()}")
            if result.get("details"):
                print(f"    Details: {result['details']}")
            if result.get("error"):
                print(f"    Error: {result['error']}")

        if info_results:
            print("\nSupplemental Info:")
            for result in info_results:
                print(f"  • {result['test']}: {result.get('details', '')}")

        print(f"\nCreated Resources:")
        for resource in self.created_resources:
            print(f"  • {resource['type'].upper()}: {resource['id']}")

        print(f"\nIngestion Workflow Details:")
        print("  1. File Upload (POST /upload)")
        print("     - Accepts multipart/form-data with 'file' field")
        print("     - Returns filename and size")
        print("     - Endpoint: /upload")
        print("     - Method: POST")
        print("     - Started: When file is selected and upload button clicked")
        print("     - Ended: When server responds with upload confirmation")

        print(f"\n  2. Code Parsing (POST /parse)")
        print("     - Converts code to Universal Intermediate Representation (UIR)")
        print("     - Supports Python, SQL, SAS files")
        print("     - Returns UIR ID and creation timestamp")
        print("     - Endpoint: /parse")
        print("     - Method: POST")
        print("     - Started: After successful upload")
        print("     - Ended: When UIR is saved to database")

        print(f"\n  3. Code Conversion (POST /convert)")
        print("     - Applies AI-powered transformation rules")
        print("     - Supports idempotency with x-idempotency-key header")
        print("     - Returns original, converted code and comparison metrics")
        print("     - Endpoint: /convert")
        print("     - Method: POST")
        print("     - Started: After parsing or directly from upload")
        print("     - Ended: When conversion result is returned and history logged")

        print(f"\nPipeline Operations:")
        print("  • Create Pipeline (POST /pipelines)")
        print("    - Accepts DAG JSON with nodes and edges")
        print("    - Returns pipeline ID")
        print("  • Start Run (POST /pipelines/{id}/runs)")
        print("    - Supports local and remote execution modes")
        print("    - Returns run ID")
        print("  • Get Status (GET /pipelines/runs/{run_id})")
        print("    - Returns execution status and results")

        print(f"\nNotebook Operations:")
        print("  • CRUD operations for interactive notebook authoring")
        print("  • Shared notebook execution support through POST /notebooks/{id}/executions")
        print("  • Flow attachment support through POST /notebooks/{id}/flow-binding")

        print(f"\nUI Button Functionality:")
        print("  • Start Modernization Batch: Opens Migration Studio")
        print("  • Open Flow Builder: Opens the execution-aware DAG workspace")
        print("  • Launch Jupyter Workspace: Opens a new notebook-first workbench")
        print("  • Validate Graph: Sends POST /pipelines/validate")
        print("  • Run Flow: Executes the saved production flow")
        print("  • Run Cell / Run All: Sends POST /notebooks/{id}/executions")

    def run_all_tests(self):
        """Run all test suites"""
        print("Starting Nexora Comprehensive Testing Suite...")
        print(f"Backend URL: {self.base_url}")
        print(f"Frontend URL: {self.frontend_url}")

        # Check if services are running
        try:
            response = requests.get(f"{self.base_url}/status", timeout=5)
            print(f"✓ Backend service is running (Status: {response.status_code})")
        except:
            print("✗ Backend service is not accessible")
            return

        try:
            response = requests.get(f"{self.frontend_url}", timeout=5)
            print(f"✓ Frontend service is running (Status: {response.status_code})")
        except:
            print("✗ Frontend service is not accessible")
            return

        # Run test suites
        self.test_api_endpoints_comprehensive()
        self.test_ingestion_workflow()
        self.test_pipeline_operations()
        self.test_notebook_operations()
        self.test_history_operations()
        self.test_frontend_pages()
        self.test_ui_buttons_functionality()

        # Generate report
        self.generate_test_report()

def main():
    """Main test execution"""
    tester = NexoraTester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()