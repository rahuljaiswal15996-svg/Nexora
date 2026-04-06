from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from app.services.observability import PrometheusMiddleware, configure_logging


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Nexora MVP", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
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
