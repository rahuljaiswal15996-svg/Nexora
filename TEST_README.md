# Nexora Comprehensive Test Suite

This test script provides end-to-end testing for the Nexora Data Transformation Platform, covering all API endpoints, ingestion workflows, and UI functionality.

## Prerequisites

1. **Python 3.8+** installed
2. **Backend service** running on `http://127.0.0.1:8000`
3. **Frontend service** running on `http://localhost:3009`
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
- **GET /connections** - Data connections
- **POST /auth/login** - User authentication
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

#### Home Page Buttons
- **Notebooks Button**: Navigates to `/notebooks` page
- **Pipelines Button**: Navigates to `/pipelines` page
- **Connections Button**: Navigates to `/connections` page

#### Upload Page Buttons
- **Upload File Button**: Triggers file selection dialog
- **Convert Button**: Sends POST /convert request
- **Parse Button**: Sends POST /parse request

#### Pipeline Page Buttons
- **Create Pipeline Button**: Opens DAG editor interface
- **Run Pipeline Button**: Executes pipeline with current configuration
- **Save Pipeline Button**: Persists pipeline changes

#### Notebook Page Buttons
- **Create Notebook Button**: Creates new notebook
- **Execute Cell Button**: Runs individual notebook cells
- **Save Notebook Button**: Saves notebook content

## Test Results

The script generates a comprehensive report showing:
- Total tests run
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
- Check port 3009 is available
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