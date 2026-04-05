# Nexora UX & Platform Overview

This document captures the intended UX / platform mockup for Nexora and maps the main UI regions to the current implementation files in the repository.

> To display the visual mockup, place the platform image at `docs/assets/nexora_overview.png` (not included here). The markdown below will render the image when the file is present:

![Nexora Platform Overview](docs/assets/nexora_overview.png)

## Quick mapping (what you can interact with now)

> The visual mockup is available as an SVG placeholder at `docs/assets/nexora_overview.svg`.

## What the mockup represents

- Left rail: global navigation (Projects, Pipelines, Notebooks, HITL Review).
- Main center: code comparison / validation widgets and pipeline visualizer area.
- Right rail: pipeline canvas, run controls, model/feature panels.
- Bottom / widgets: notebook previews, monitoring cards, recent activity.

## How this maps to the current repo state

- The core backend routes and services (parse/convert/history/shadow/pipelines) are implemented under `backend/app/` and are exercised by the smoke test (`backend/scripts/smoke_test.py`).
- The frontend implements MVP pages (upload/compare/history/pipelines/review) under `frontend/pages/` with small components in `frontend/components/` and API helpers in `frontend/services/api.js`.
- The agent scaffold is in `agent/agent.py` and demonstrates the remote-run lifecycle (claim → execute → report).

## Next steps to fully match the mockup

1. Add the visual mockup image to `docs/assets/nexora_overview.png` to render the preview above.
2. Expand dashboard widgets in `frontend/pages/index.js` and implement dataset / model cards.
3. Improve pipeline visualizer to use a full `react-flow` canvas and persist nodes to the pipeline store.
4. Add RBAC, session management, and a production-grade auth flow (remove HMAC fallback).

---
If you want, I can: (a) copy the attached mockup image into `docs/assets/` for you, or (b) generate a lightweight static HTML preview that embeds the image and the live review UI side-by-side. Which would you prefer?
