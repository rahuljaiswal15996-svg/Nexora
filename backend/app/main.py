from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import upload, history, status, parse, pipelines, metrics, auth, validate, deploy, agent, shadow, notebook, optimization, connections
from app.services.db import init_db
from app.middleware.auth_middleware import AuthMiddleware
from app.middleware.tenant_middleware import TenantMiddleware
from app.services.observability import PrometheusMiddleware, configure_logging

app = FastAPI(title="Nexora MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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

@app.on_event("startup")
async def startup_event() -> None:
    init_db()

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
