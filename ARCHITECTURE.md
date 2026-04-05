# Nexora MVP Architecture

## Overview

Nexora is built as a clean MVP with a decoupled backend and frontend:

- `backend/` — FastAPI service for upload, conversion, comparison, and history persistence
- `frontend/` — Next.js application for upload, conversion UI, comparison, and history browsing
- `docker/` — container definitions for backend and frontend, plus compose orchestration

## Backend Architecture

### Services

- `app/main.py` — FastAPI entrypoint with CORS middleware
- `app/routes/upload.py` — file upload and conversion endpoints
- `app/routes/history.py` — history retrieval and clear operations
- `app/routes/status.py` — health check endpoint

### Business logic

- `app/services/conversion.py` — MVP conversion engine using pattern-based code transformation
- `app/services/comparison.py` — syntax-aware comparison using `difflib`, similarity score, diff lines, and line metrics
- `app/services/history.py` — JSON-backed persistence for conversion history, stored under `backend/app/data/history.json`

### Data models

- `app/models/schemas.py` — Pydantic response models for conversion and comparison results

## Frontend Architecture

### Pages

- `pages/index.js` — app entry and navigation
- `pages/compare.js` — core conversion UI
- `pages/history.js` — history browser for saved conversions

### Components

- `components/CodeEditor.js` — reusable code editor component with read-only comparison mode

### Services

- `services/api.js` — frontend API adapter for backend conversion requests
- `services/history.js` — frontend adapter for backend history endpoints and local fallback storage

### Next.js configuration

- `next.config.js` — rewrite proxy for local frontend-to-backend API forwarding

## Deployment Architecture

### Docker

- `docker/Dockerfile.backend` — Python container for the FastAPI backend
- `docker/Dockerfile.frontend` — Node container for the Next.js frontend
- `docker/docker-compose.yml` — orchestrates backend and frontend services in local development

## Completion Status

### Implemented MVP features

- Upload file handling
- Convert code with a conversion engine
- Compare original and converted code results
- Compute comparison metrics and diff preview
- Persist conversion history in backend storage
- Browse and clear history from the frontend
- Buildable Next.js frontend with API proxy rewrites
- Docker scaffolding for local orchestration

## Recommended next steps

1. Replace JSON history storage with a database (SQLite/PostgreSQL)
2. Add authentication and tenant-aware history isolation
3. Add a pipeline generation service and semantic conversion engine
4. Add syntax-aware diff highlighting and code mapping
5. Add observability and metrics collection
6. Add CI/CD pipelines and containerized deployment automation

## Design principles

- Backend-first implementation
- API-driven UX
- Clear separation of concerns
- Incremental enterprise extensibility

This architecture is ready for the next step toward a production-grade SaaS platform.
