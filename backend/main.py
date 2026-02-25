from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from api.routers.companies import router as companies_router
from api.routers.workspace import router as workspace_router

app = FastAPI(title="CapitalBase API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "CapitalBase API is running"}

app.include_router(companies_router)
app.include_router(workspace_router)
