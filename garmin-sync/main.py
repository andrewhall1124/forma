import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from sync import run_sync

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Forma Garmin Sync")


class SyncRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    days: int = 30


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/sync")
def trigger_sync(body: SyncRequest = None):
    if body is None:
        body = SyncRequest()
    try:
        result = run_sync(days=body.days, email=body.email, password=body.password)
        return JSONResponse(result)
    except Exception as exc:
        logger.error("Sync failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
