import os
import logging
from datetime import date, timedelta

import garminconnect
import psycopg2

logger = logging.getLogger(__name__)


def get_garmin_client(email: str = None, password: str = None) -> garminconnect.Garmin:
    email = email or os.environ.get("GARMIN_EMAIL")
    password = password or os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        raise ValueError("Garmin credentials required (pass email/password or set GARMIN_EMAIL/GARMIN_PASSWORD)")
    client = garminconnect.Garmin(email=email, password=password)
    client.login()
    return client


def get_db_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def categorize_activity(type_key: str) -> str:
    """Map Garmin's many activityType typeKeys into a small set of buckets.

    Garmin has dozens of typeKeys (running, trail_running, road_biking,
    indoor_cycling, strength_training, …); substring matching keeps us robust
    to ones we haven't seen without an exhaustive list.
    """
    k = (type_key or "").lower()
    if "swim" in k:
        return "swim"
    if "run" in k:
        return "run"
    if "walk" in k or "hik" in k:
        return "walk"
    if "cycl" in k or "bik" in k or k == "bmx":
        return "ride"
    if "strength" in k or "weight" in k:
        return "strength"
    return "other"


def sync_activities(garmin: garminconnect.Garmin, conn, days: int = 30, user_id: str = None) -> int:
    activities = garmin.get_activities(start=0, limit=100)

    synced = 0
    with conn.cursor() as cur:
        for a in activities:
            activity_id = str(a.get("activityId", ""))
            start_time = a.get("startTimeLocal", "")
            activity_date = start_time[:10] if start_time else None
            if not activity_date or not activity_id:
                continue

            if (date.today() - date.fromisoformat(activity_date)).days > days:
                continue

            type_key = a.get("activityType", {}).get("typeKey", "")
            activity_type = categorize_activity(type_key)
            name = a.get("activityName")

            distance = a.get("distance")
            duration = a.get("duration")
            avg_speed = a.get("averageSpeed")
            avg_hr = a.get("averageHR")
            max_hr = a.get("maxHR")
            calories = a.get("calories")
            elevation = a.get("elevationGain")

            avg_pace = int(1000 / avg_speed) if avg_speed and avg_speed > 0 else None

            cur.execute(
                """
                INSERT INTO activities
                    (garmin_activity_id, date, user_id, activity_type, name,
                     distance_meters, duration_seconds,
                     avg_pace_seconds_per_km, avg_heart_rate, max_heart_rate,
                     calories, elevation_gain_meters)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (garmin_activity_id) DO UPDATE SET
                    date                    = EXCLUDED.date,
                    user_id                 = EXCLUDED.user_id,
                    activity_type           = EXCLUDED.activity_type,
                    name                    = EXCLUDED.name,
                    distance_meters         = EXCLUDED.distance_meters,
                    duration_seconds        = EXCLUDED.duration_seconds,
                    avg_pace_seconds_per_km = EXCLUDED.avg_pace_seconds_per_km,
                    avg_heart_rate          = EXCLUDED.avg_heart_rate,
                    max_heart_rate          = EXCLUDED.max_heart_rate,
                    calories                = EXCLUDED.calories,
                    elevation_gain_meters   = EXCLUDED.elevation_gain_meters
                """,
                (
                    activity_id,
                    activity_date,
                    user_id,
                    activity_type,
                    name,
                    distance,
                    int(duration) if duration is not None else None,
                    avg_pace,
                    int(avg_hr) if avg_hr is not None else None,
                    int(max_hr) if max_hr is not None else None,
                    int(calories) if calories is not None else None,
                    elevation,
                ),
            )
            synced += 1

    conn.commit()
    return synced


def extract_sleep_score(daily: dict) -> int | None:
    candidates = [
        daily.get("sleepScore"),
        (daily.get("sleepScores") or {}).get("overall", {}).get("value"),
        (daily.get("sleepScores") or {}).get("totalScore"),
    ]
    for v in candidates:
        if isinstance(v, (int, float)) and v > 0:
            return int(v)
    return None


def sync_sleep(garmin: garminconnect.Garmin, conn, days: int = 14, user_id: str = None) -> int:
    today = date.today()
    synced = 0

    with conn.cursor() as cur:
        for i in range(days):
            target = today - timedelta(days=i)
            date_str = target.isoformat()
            try:
                data = garmin.get_sleep_data(date_str)
                daily = data.get("dailySleepDTO") or {}
                total = daily.get("sleepTimeSeconds")
                if not total:
                    continue

                cur.execute(
                    """
                    INSERT INTO sleep_logs
                        (date, user_id, total_sleep_seconds, deep_sleep_seconds,
                         light_sleep_seconds, rem_sleep_seconds,
                         awake_sleep_seconds, sleep_score)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date) DO UPDATE SET
                        user_id             = EXCLUDED.user_id,
                        total_sleep_seconds = EXCLUDED.total_sleep_seconds,
                        deep_sleep_seconds  = EXCLUDED.deep_sleep_seconds,
                        light_sleep_seconds = EXCLUDED.light_sleep_seconds,
                        rem_sleep_seconds   = EXCLUDED.rem_sleep_seconds,
                        awake_sleep_seconds = EXCLUDED.awake_sleep_seconds,
                        sleep_score         = EXCLUDED.sleep_score
                    """,
                    (
                        date_str,
                        user_id,
                        total,
                        daily.get("deepSleepSeconds"),
                        daily.get("lightSleepSeconds"),
                        daily.get("remSleepSeconds"),
                        daily.get("awakeSleepSeconds"),
                        extract_sleep_score(daily),
                    ),
                )
                synced += 1
            except Exception as exc:
                logger.warning("Sleep sync failed for %s: %s", date_str, exc)

    conn.commit()
    return synced


def sync_body_composition(garmin: garminconnect.Garmin, conn, days: int = 30, user_id: str = None) -> int:
    today = date.today()
    start = (today - timedelta(days=days)).isoformat()
    end = today.isoformat()

    try:
        data = garmin.get_body_composition(start, end)
        measurements = data.get("dateWeightList") or []
    except Exception as exc:
        logger.warning("Body composition fetch failed: %s", exc)
        return 0

    with conn.cursor() as cur:
        for m in measurements:
            cal_date = m.get("calendarDate")
            weight_g = m.get("weight")
            if not cal_date or weight_g is None:
                continue

            muscle_g = m.get("muscleMass")

            cur.execute(
                """
                INSERT INTO body_composition
                    (date, user_id, weight_kg, body_fat_pct, muscle_mass_kg, bmi)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (date) DO UPDATE SET
                    user_id        = EXCLUDED.user_id,
                    weight_kg      = EXCLUDED.weight_kg,
                    body_fat_pct   = EXCLUDED.body_fat_pct,
                    muscle_mass_kg = EXCLUDED.muscle_mass_kg,
                    bmi            = EXCLUDED.bmi
                """,
                (
                    cal_date,
                    user_id,
                    weight_g / 1000,
                    m.get("bodyFat"),
                    muscle_g / 1000 if muscle_g is not None else None,
                    m.get("bmi"),
                ),
            )

    conn.commit()
    return len(measurements)


def run_sync(days: int = 30, email: str = None, password: str = None, user_id: str = None) -> dict:
    logger.info("Starting Garmin sync (last %d days, user=%s)…", days, user_id)
    garmin = get_garmin_client(email=email, password=password)
    conn = get_db_conn()
    try:
        n_activities = sync_activities(garmin, conn, days=days, user_id=user_id)
        logger.info("Activities synced: %d", n_activities)

        sleep = sync_sleep(garmin, conn, days=min(days, 14), user_id=user_id)
        logger.info("Sleep nights synced: %d", sleep)

        body = sync_body_composition(garmin, conn, days=days, user_id=user_id)
        logger.info("Body composition records synced: %d", body)

        return {"status": "ok", "activities": n_activities, "sleep": sleep, "body": body}
    finally:
        conn.close()
