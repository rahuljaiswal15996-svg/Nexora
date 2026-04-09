import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import get_cors_configuration, validate_runtime_configuration
from app.routes import (
    agent,
    auth,
    catalog,
    collaboration,
    connections,
    deploy,
    finops,
    governance,
    history,
    metrics,
    ml,
    notebook,
    optimization,
    parse,
    pipelines,
    projects,
    scenarios,
    shadow,
    status,
    upload,
    validate,
)
from app.services.db import init_db
from app.middleware.auth_middleware import AuthMiddleware
from app.middleware.tenant_middleware import TenantMiddleware
from app.services.notebook import backfill_notebook_scope_columns
from app.services.observability import PrometheusMiddleware, configure_logging
from app.services.pipeline_runner import backfill_pipeline_scope_columns
from app.services.work_maintenance import start_work_maintenance, stop_work_maintenance


logger = logging.getLogger("nexora.startup")


ALLOWED_ORIGINS, ALLOWED_ORIGIN_REGEX = get_cors_configuration()


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_runtime_configuration()
    init_db()
    backfill_summary = backfill_pipeline_scope_columns()
    if backfill_summary.get("updated"):
        logger.info("Backfilled pipeline scope columns", extra=backfill_summary)
    notebook_backfill_summary = backfill_notebook_scope_columns()
    if notebook_backfill_summary.get("updated"):
        logger.info("Backfilled notebook scope columns", extra=notebook_backfill_summary)
    start_work_maintenance()
    try:
        yield
    finally:
        stop_work_maintenance()


app = FastAPI(title="Nexora Platform API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# configure logging for services
configure_logging()

# observability, auth and tenant middlewares
app.add_middleware(PrometheusMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(TenantMiddleware)

app.include_router(upload.router)
app.include_router(history.router)
app.include_router(status.router)
app.include_router(parse.router)
app.include_router(pipelines.router)
app.include_router(metrics.router)
app.include_router(auth.router)
app.include_router(validate.router)
app.include_router(deploy.router)
app.include_router(agent.router)
app.include_router(shadow.router)
app.include_router(notebook.router)
app.include_router(optimization.router)
app.include_router(connections.router)
app.include_router(projects.router)
app.include_router(catalog.router)
app.include_router(scenarios.router)
app.include_router(governance.router)
app.include_router(finops.router)
app.include_router(collaboration.router)
app.include_router(ml.router)
