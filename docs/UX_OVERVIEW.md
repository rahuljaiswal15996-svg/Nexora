# Nexora UX & Platform Overview

This document captures the intended UX / platform mockup for Nexora and maps the main UI regions to the current implementation files in the repository.

> To display the visual mockup, place the platform image at `docs/assets/nexora_overview.png` (not included here). The markdown below will render the image when the file is present:

![Nexora Platform Overview](docs/assets/nexora_overview.png)

## Quick mapping (what you can interact with now)

> The visual mockup is available as an SVG placeholder at `docs/assets/nexora_overview.svg`.

## What the mockup represents

- Left rail: global navigation for Home, Runtime Ops, Connections Hub, and Governance Desk.
- Main center: migration, flow, notebook, or runtime workspace depending on the current route.
- Right rail: inspectors for node config, runtime controls, governance context, or deployment state.
- Bottom / widgets: notebook outputs, run telemetry, monitoring cards, and recent activity.

## How this maps to the current repo state

- The core backend routes and services for parse, convert, notebooks, pipelines, jobs, deployments, governance, connections, and ML are implemented under `backend/app/`.
- The frontend now uses split workspaces under `frontend/pages/` including `home`, `flow`, `runtime`, `notebooks`, `connections`, `catalog`, `ml`, and `governance/*`.
- Browser API traffic uses same-origin `/api`, forwarded by `frontend/pages/api/[...path].js` to the backend.
- The agent scaffold in `agent/agent.py` demonstrates the remote-run and platform-job lifecycle (claim, heartbeat, execute, report).

## Next steps to fully match the mockup

1. Add the visual mockup image to `docs/assets/nexora_overview.png` to render the preview above.
2. Deepen the summary surfaces with live operational and governance widgets without turning Home back into a mixed control-plane hub.
3. Continue moving notebook execution toward the shared pipeline telemetry model described in `docs/NOTEBOOK_FLOW_WORKSPACE_ARCHITECTURE.md`.
4. Add production-grade auth, secrets integration, and environment-specific Terraform wrappers around the current Helm installer.

---
If you want, I can: (a) copy the attached mockup image into `docs/assets/` for you, or (b) generate a lightweight static HTML preview that embeds the image and the live review UI side-by-side. Which would you prefer?
