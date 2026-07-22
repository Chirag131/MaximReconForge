from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.auth.routes import router as auth_router
from app.api.engagements import router as engagements_router
from app.api.websocket import router as websocket_router

app = FastAPI(title="MaximReconForge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(engagements_router)
app.include_router(websocket_router)

@app.get("/health")
async def health():
    return {"status": "ok"}
