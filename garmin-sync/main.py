import logging
import threading
import time

import schedule
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from sync import run_sync

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Forma Garmin Sync")

# ── background scheduler ────────────────────────────────────────────────────


def scheduled_sync():
    try:
        result = run_sync(days=30)
        logger.info("Scheduled sync complete: %s", result)
    except Exception as exc:
        logger.error("Scheduled sync failed: %s", exc, exc_info=True)


def run_scheduler():
    schedule.every(6).hours.do(scheduled_sync)
    # Also run once at startup
    scheduled_sync()
    while True:
        schedule.run_pending()
        time.sleep(60)


threading.Thread(target=run_scheduler, daemon=True).start()


# ── HTTP endpoints ──────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/sync")
def trigger_sync(days: int = 30):
    try:
        result = run_sync(days=days)
        return JSONResponse(result)
    except Exception as exc:
        logger.error("Manual sync failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
