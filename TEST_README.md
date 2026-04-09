# Nexora Comprehensive Test Suite

This test script provides end-to-end testing for the Nexora Data Transformation Platform, covering all API endpoints, ingestion workflows, and UI functionality.

## Prerequisites

1. **Python 3.8+** installed
2. **Backend service** running on `http://127.0.0.1:8000`
3. **Frontend service** running on `http://localhost:3000`
4. **Dependencies** installed

## Installation

```bash
pip install -r test_requirements.txt
```

## Running the Tests

```bash
python test_nexora_comprehensive.py
```

## What the Test Script Covers

### 1. API Endpoint Testing
- **GET /status** - System health check
- **GET /metrics** - System performance metrics
- **GET /history** - Conversion history
- **POST /auth/token** - Development token issuance for local validation
- **GET /projects** - Project portfolio inventory
- **GET /catalog/datasets** - Catalog dataset inventory
- **GET /jobs** - Runtime control-plane queue
- **GET /shadow** - Shadow review inventory
- **POST /shadow** - Create a shadow comparison run
- **POST /upload** - File upload endpoint
- **POST /convert** - Code conversion with AI
- **POST /parse** - Code parsing to UIR format
- **POST /pipelines** - Pipeline creation
- **GET /pipelines/{id}** - Pipeline retrieval
- **POST /pipelines/{id}/runs** - Pipeline execution
- **GET /pipelines/runs/{run_id}** - Run status checking
- **POST /notebooks** - Notebook creation
- **GET /notebooks** - List all notebooks
- **GET /notebooks/{id}** - Get specific notebook
- **PUT /notebooks/{id}** - Update notebook
- **PUT /notebooks/{id}/cells/{cell_id}** - Update notebook cell content
- **POST /notebooks/{id}/cells/{cell_id}/execute** - Execute a notebook cell
- **GET /connections** - Data connections
- **POST /validate** - Code validation
- **POST /deploy** - Code deployment

### 2. Ingestion Workflow Testing

#### File Upload Process
- **Started**: When user selects file and clicks upload button
- **Method**: POST /upload
- **Data**: Multipart form data with file
- **Response**: Filename and file size
- **Ended**: Server confirms successful upload

#### Code Parsing Process
- **Started**: After successful file upload or direct code input
- **Method**: POST /parse
- **Data**: File content or raw code
- **Processing**: Converts to Universal Intermediate Representation (UIR)
- **Response**: UIR ID and creation timestamp
- **Ended**: UIR saved to database

#### Code Conversion Process
- **Started**: After parsing or directly from upload
- **Method**: POST /convert
- **Processing**: AI-powered transformation using rules + LLM fallback
- **Features**: Idempotency support, tenant isolation
- **Response**: Original code, converted code, comparison metrics
- **Ended**: Result returned and history entry created

### 3. Pipeline Operations

#### Pipeline Creation
- **Method**: POST /pipelines
- **Data**: DAG JSON with nodes and edges
- **Response**: Pipeline ID and creation timestamp

#### Pipeline Execution
- **Method**: POST /pipelines/{id}/runs
- **Modes**: Local execution or remote queuing
- **Response**: Run ID
- **Status Tracking**: GET /pipelines/runs/{run_id}

### 4. Notebook Operations
- **CRUD Operations**: Create, Read, Update, Delete notebooks
- **Cell Execution**: Individual cell execution support
- **Collaboration**: Real-time editing features

### 5. UI Button Functionality

#### Home Summary
- **Start Modernization Batch**: Navigates to `/migration-studio`
- **Open Flow Builder**: Navigates to `/flow`
- **Launch Jupyter Workspace**: Navigates to `/notebooks?mode=new`
- **Open Runtime Ops**: Navigates to `/runtime`

#### Migration Studio
- **Upload File Button**: Triggers file selection dialog
- **Convert Button**: Sends POST /convert request
- **Parse Button**: Sends POST /parse request

#### Flow Builder Buttons
- **Validate Graph Button**: Sends POST /pipelines/validate request
- **Run Flow Button**: Executes the saved production flow
- **Save Flow Button**: Persists pipeline graph changes
- **Open Jupyter Workspace**: Opens node-linked notebook context

#### Notebook Workspace Buttons
- **Create Notebook Button**: Creates new notebook
- **Execute Cell Button**: Runs individual notebook cells through POST /notebooks/{id}/cells/{cell_id}/execute
- **Save Notebook Button**: Saves notebook content
- **Attach To Flow Button**: Persists notebook-to-flow linkage through POST /notebooks/{id}/flow-binding

## Test Results

The script generates a comprehensive report showing:
- Total completed tests run, excluding RUNNING and INFO log lines
- Pass/fail/warning counts
- Detailed results for each test
- Created resources during testing
- Workflow timing and status information

## Troubleshooting

### Backend Not Accessible
- Ensure backend is running: `cd backend && python -m uvicorn app.main:app --reload`
- Check port 8000 is not blocked
- Verify CORS settings allow frontend connections

### Frontend Not Accessible
- Ensure frontend is running: `cd frontend && npm run dev`
- Check port 3000 is available
- Verify Next.js build completed successfully

### Test Failures
- Some endpoints may require authentication
- Pipeline execution may need proper DAG structure
- File uploads require valid file content

## Extending the Tests

To add new test cases:
1. Add endpoint to the `endpoints` list in `test_api_endpoints_comprehensive()`
2. Create specific test methods for complex workflows
3. Add UI component tests for new pages
4. Include authentication headers where required

## Integration with CI/CD

This test script can be integrated into CI/CD pipelines:
```yaml
- name: Run API Tests
  run: |
    cd backend
    python ../test_nexora_comprehensive.py
```

The script returns appropriate exit codes for CI/CD integration.