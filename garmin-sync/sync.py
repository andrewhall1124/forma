import os
import json
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


def sync_activity_laps(garmin: garminconnect.Garmin, conn, activity_id: str, user_id: str = None) -> int:
    """Fetch and store the per-lap (split) breakdown for a single activity.

    Garmin's splits endpoint returns a ``lapDTOs`` list; each lap carries the
    same shape of metrics we already store on the activity summary. Laps are
    upserted on (garmin_activity_id, lap_index) so re-syncing is idempotent.
    """
    try:
        data = garmin.get_activity_splits(activity_id)
    except Exception as exc:
        logger.warning("Lap fetch failed for %s: %s", activity_id, exc)
        return 0

    # The splits endpoint returns laps under "lapDTOs"; fall back to "splits"
    # in case a future API/library version reshapes the payload.
    laps = (data or {}).get("lapDTOs") or (data or {}).get("splits") or []
    if not laps:
        return 0

    with conn.cursor() as cur:
        for i, lap in enumerate(laps, start=1):
            avg_speed = lap.get("averageSpeed")
            max_speed = lap.get("maxSpeed")
            avg_hr = lap.get("averageHR")
            max_hr = lap.get("maxHR")
            duration = lap.get("duration")
            calories = lap.get("calories")
            cadence = lap.get("averageRunCadence") or lap.get("averageBikeCadence")
            avg_pace = int(1000 / avg_speed) if avg_speed and avg_speed > 0 else None

            cur.execute(
                """
                INSERT INTO activity_laps
                    (garmin_activity_id, lap_index, user_id, distance_meters,
                     duration_seconds, avg_pace_seconds_per_km, avg_speed_mps,
                     max_speed_mps, avg_heart_rate, max_heart_rate, avg_cadence,
                     calories, elevation_gain_meters, elevation_loss_meters)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (garmin_activity_id, lap_index) DO UPDATE SET
                    user_id                 = EXCLUDED.user_id,
                    distance_meters         = EXCLUDED.distance_meters,
                    duration_seconds        = EXCLUDED.duration_seconds,
                    avg_pace_seconds_per_km = EXCLUDED.avg_pace_seconds_per_km,
                    avg_speed_mps           = EXCLUDED.avg_speed_mps,
                    max_speed_mps           = EXCLUDED.max_speed_mps,
                    avg_heart_rate          = EXCLUDED.avg_heart_rate,
                    max_heart_rate          = EXCLUDED.max_heart_rate,
                    avg_cadence             = EXCLUDED.avg_cadence,
                    calories                = EXCLUDED.calories,
                    elevation_gain_meters   = EXCLUDED.elevation_gain_meters,
                    elevation_loss_meters   = EXCLUDED.elevation_loss_meters
                """,
                (
                    activity_id,
                    i,
                    user_id,
                    lap.get("distance"),
                    int(duration) if duration is not None else None,
                    avg_pace,
                    avg_speed,
                    max_speed,
                    int(avg_hr) if avg_hr is not None else None,
                    int(max_hr) if max_hr is not None else None,
                    int(cadence) if cadence is not None else None,
                    int(calories) if calories is not None else None,
                    lap.get("elevationGain"),
                    lap.get("elevationLoss"),
                ),
            )

    conn.commit()
    return len(laps)


def fetch_hr_zones(garmin: garminconnect.Garmin, activity_id: str):
    """Time spent in each heart-rate zone, normalized to a small shape."""
    try:
        data = garmin.get_activity_hr_in_timezones(activity_id)
    except Exception as exc:
        logger.warning("HR zones fetch failed for %s: %s", activity_id, exc)
        return None

    zones = []
    for z in data or []:
        secs = z.get("secsInZone")
        if secs is None:
            continue
        zones.append(
            {
                "zoneNumber": z.get("zoneNumber"),
                "secsInZone": round(secs),
                "zoneLowBoundary": z.get("zoneLowBoundary"),
            }
        )
    return zones or None


def fetch_exercise_sets(garmin: garminconnect.Garmin, activity_id: str):
    """Per-set exercise breakdown for a strength activity (active sets only)."""
    try:
        data = garmin.get_activity_exercise_sets(activity_id)
    except Exception as exc:
        logger.warning("Exercise sets fetch failed for %s: %s", activity_id, exc)
        return None

    out = []
    for s in (data or {}).get("exerciseSets") or []:
        if s.get("setType") != "ACTIVE":
            continue
        exercises = s.get("exercises") or []
        first = exercises[0] if exercises else {}
        weight_g = s.get("weight")
        duration = s.get("duration")
        out.append(
            {
                "exercise": first.get("name"),
                "category": first.get("category"),
                "reps": s.get("repetitionCount"),
                "weightKg": round(weight_g / 1000, 1) if weight_g else None,
                "durationSeconds": round(duration) if duration else None,
            }
        )
    return out or None


# Time-series keys we pull from the details payload, mapped to our stream names.
_STREAM_KEYS = {
    "sumDistance": "distance",   # meters
    "directHeartRate": "hr",     # bpm
    "directSpeed": "speed",      # m/s
    "directElevation": "elevation",  # meters
}


def fetch_streams(garmin: garminconnect.Garmin, activity_id: str):
    """Downsampled time series (distance/HR/speed/elevation) for charts."""
    try:
        data = garmin.get_activity_details(activity_id, maxchart=200, maxpoly=0)
    except Exception as exc:
        logger.warning("Details fetch failed for %s: %s", activity_id, exc)
        return None

    descriptors = (data or {}).get("metricDescriptors") or []
    rows = (data or {}).get("activityDetailMetrics") or []
    if not descriptors or not rows:
        return None

    # Map the Garmin metric key -> its column index in each row's "metrics".
    index_for = {}
    for d in descriptors:
        key = d.get("key")
        if key in _STREAM_KEYS:
            index_for[key] = d.get("metricsIndex")

    streams = {}
    for key, name in _STREAM_KEYS.items():
        i = index_for.get(key)
        if i is None:
            continue
        series = []
        for r in rows:
            metrics = r.get("metrics") or []
            series.append(metrics[i] if i < len(metrics) else None)
        if any(v is not None for v in series):
            streams[name] = series

    # Distance is the x-axis; without it the series aren't chartable here.
    return streams if "distance" in streams else None


def sync_activity_details(
    garmin: garminconnect.Garmin, conn, activity_id: str, activity_type: str, user_id: str = None
) -> bool:
    """Fetch and upsert HR zones, strength sets, and time-series streams.

    Sets are only fetched for strength; streams only for non-strength (the
    elevation/pace series is meaningless for lifting). HR zones apply to all.
    """
    hr_zones = fetch_hr_zones(garmin, activity_id)
    exercise_sets = fetch_exercise_sets(garmin, activity_id) if activity_type == "strength" else None
    streams = fetch_streams(garmin, activity_id) if activity_type != "strength" else None

    if hr_zones is None and exercise_sets is None and streams is None:
        return False

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO activity_details
                (garmin_activity_id, user_id, hr_zones, exercise_sets, streams)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (garmin_activity_id) DO UPDATE SET
                user_id       = EXCLUDED.user_id,
                hr_zones      = EXCLUDED.hr_zones,
                exercise_sets = EXCLUDED.exercise_sets,
                streams       = EXCLUDED.streams
            """,
            (
                activity_id,
                user_id,
                json.dumps(hr_zones) if hr_zones is not None else None,
                json.dumps(exercise_sets) if exercise_sets is not None else None,
                json.dumps(streams) if streams is not None else None,
            ),
        )
    conn.commit()
    return True


def sync_activities(garmin: garminconnect.Garmin, conn, days: int = 30, user_id: str = None) -> int:
    activities = garmin.get_activities(start=0, limit=100)

    synced = 0
    synced_ids: list[tuple[str, str]] = []
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

            # Cadence key differs by sport; running is in steps/min, cycling in
            # rev/min. Store whichever is present.
            cadence = (
                a.get("averageRunningCadenceInStepsPerMinute")
                or a.get("averageBikingCadenceInRevPerMinute")
            )
            moving_duration = a.get("movingDuration")
            avg_power = a.get("avgPower")
            aerobic_te = a.get("aerobicTrainingEffect")
            anaerobic_te = a.get("anaerobicTrainingEffect")
            stride = a.get("avgStrideLength")  # centimeters

            cur.execute(
                """
                INSERT INTO activities
                    (garmin_activity_id, date, user_id, activity_type, name,
                     distance_meters, duration_seconds,
                     avg_pace_seconds_per_km, avg_heart_rate, max_heart_rate,
                     calories, elevation_gain_meters, avg_cadence,
                     moving_duration_seconds, avg_power_watts,
                     aerobic_training_effect, anaerobic_training_effect,
                     avg_stride_length_cm)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s)
                ON CONFLICT (garmin_activity_id) DO UPDATE SET
                    date                      = EXCLUDED.date,
                    user_id                   = EXCLUDED.user_id,
                    activity_type             = EXCLUDED.activity_type,
                    name                      = EXCLUDED.name,
                    distance_meters           = EXCLUDED.distance_meters,
                    duration_seconds          = EXCLUDED.duration_seconds,
                    avg_pace_seconds_per_km   = EXCLUDED.avg_pace_seconds_per_km,
                    avg_heart_rate            = EXCLUDED.avg_heart_rate,
                    max_heart_rate            = EXCLUDED.max_heart_rate,
                    calories                  = EXCLUDED.calories,
                    elevation_gain_meters     = EXCLUDED.elevation_gain_meters,
                    avg_cadence               = EXCLUDED.avg_cadence,
                    moving_duration_seconds   = EXCLUDED.moving_duration_seconds,
                    avg_power_watts           = EXCLUDED.avg_power_watts,
                    aerobic_training_effect   = EXCLUDED.aerobic_training_effect,
                    anaerobic_training_effect = EXCLUDED.anaerobic_training_effect,
                    avg_stride_length_cm      = EXCLUDED.avg_stride_length_cm
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
                    int(cadence) if cadence is not None else None,
                    int(moving_duration) if moving_duration is not None else None,
                    avg_power,
                    aerobic_te,
                    anaerobic_te,
                    stride,
                ),
            )
            synced += 1
            synced_ids.append((activity_id, activity_type))

    conn.commit()

    # Each of these makes extra per-activity Garmin requests, so they run after
    # the summary upserts commit. Splits/streams are skipped for strength (just
    # sets/rest); HR zones and exercise sets are handled inside the details sync.
    for aid, atype in synced_ids:
        if atype != "strength":
            sync_activity_laps(garmin, conn, aid, user_id=user_id)
        sync_activity_details(garmin, conn, aid, atype, user_id=user_id)

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
                    ON CONFLICT (user_id, date) DO UPDATE SET
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


def sync_daily_summaries(garmin: garminconnect.Garmin, conn, days: int = 30, user_id: str = None) -> int:
    """Daily wellness totals (steps, floors climbed) from the user summary.

    One Garmin request per day, same as sleep. Days the watch hasn't synced
    yet come back with totalSteps=None and are skipped rather than stored as
    zeros.
    """
    today = date.today()
    synced = 0

    with conn.cursor() as cur:
        # Self-migrating: matches the drizzle definition in src/db/schema.ts.
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_summaries (
                id serial PRIMARY KEY,
                user_id text,
                date date NOT NULL UNIQUE,
                steps integer,
                step_goal integer,
                floors_ascended integer,
                floors_descended integer,
                floors_goal integer,
                created_at timestamp DEFAULT now()
            )
            """
        )
        for i in range(days):
            date_str = (today - timedelta(days=i)).isoformat()
            try:
                data = garmin.get_user_summary(date_str) or {}
                steps = data.get("totalSteps")
                if steps is None:
                    continue

                floors_up = data.get("floorsAscended")
                floors_down = data.get("floorsDescended")

                cur.execute(
                    """
                    INSERT INTO daily_summaries
                        (date, user_id, steps, step_goal, floors_ascended,
                         floors_descended, floors_goal)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, date) DO UPDATE SET
                        steps            = EXCLUDED.steps,
                        step_goal        = EXCLUDED.step_goal,
                        floors_ascended  = EXCLUDED.floors_ascended,
                        floors_descended = EXCLUDED.floors_descended,
                        floors_goal      = EXCLUDED.floors_goal
                    """,
                    (
                        date_str,
                        user_id,
                        int(steps),
                        data.get("dailyStepGoal"),
                        round(floors_up) if floors_up is not None else None,
                        round(floors_down) if floors_down is not None else None,
                        data.get("userFloorsAscendedGoal"),
                    ),
                )
                synced += 1
            except Exception as exc:
                logger.warning("Daily summary sync failed for %s: %s", date_str, exc)

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
                ON CONFLICT (user_id, date) DO UPDATE SET
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

        daily = sync_daily_summaries(garmin, conn, days=days, user_id=user_id)
        logger.info("Daily summaries synced: %d", daily)

        return {
            "status": "ok",
            "activities": n_activities,
            "sleep": sleep,
            "body": body,
            "daily": daily,
        }
    finally:
        conn.close()
