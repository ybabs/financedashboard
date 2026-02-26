from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.middleware import (
    RateLimitMiddleware,
    RequestBodyLimitMiddleware,
    RequestTimeoutMiddleware,
    SecurityHeadersMiddleware,
)
from api.routers.companies import router as companies_router
from api.routers.workspace import router as workspace_router
from api.routers.v1_companies import router as v1_companies_router
from api.routers.v1_financials import router as v1_financials_router
from api.routers.v1_lists import router as v1_lists_router
from api.routers.v1_system import router as v1_system_router

app = FastAPI(title="CapitalBase API")

app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestBodyLimitMiddleware)
app.add_middleware(RequestTimeoutMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

@app.get("/")
async def root():
    return {"status": "CapitalBase API is running"}

app.include_router(companies_router)
app.include_router(workspace_router)
app.include_router(v1_companies_router)
app.include_router(v1_financials_router)
app.include_router(v1_lists_router)
app.include_router(v1_system_router)
