import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  date,
  json,
  unique,
} from "drizzle-orm/pg-core";

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  garminActivityId: text("garmin_activity_id").unique(),
  // Normalized category: run | walk | ride | strength | swim | other
  activityType: text("activity_type"),
  name: text("name"),
  date: date("date").notNull(),
  distanceMeters: real("distance_meters"),
  durationSeconds: integer("duration_seconds"),
  avgPaceSecondsPerKm: integer("avg_pace_seconds_per_km"),
  avgHeartRate: integer("avg_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  calories: integer("calories"),
  elevationGainMeters: real("elevation_gain_meters"),
  // Extra summary metrics Garmin already returns on the activity list.
  avgCadence: integer("avg_cadence"),
  movingDurationSeconds: integer("moving_duration_seconds"),
  avgPowerWatts: real("avg_power_watts"),
  aerobicTrainingEffect: real("aerobic_training_effect"),
  anaerobicTrainingEffect: real("anaerobic_training_effect"),
  avgStrideLengthCm: real("avg_stride_length_cm"),
  // User-authored note (optional title + body) on the activity. Never touched
  // by the Garmin sync.
  notesTitle: text("notes_title"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Detail-only data fetched per activity via extra Garmin requests. Kept out of
// the activities row so the list query stays lean; loaded only on the detail
// page. All three payloads are stored as JSON:
//   hrZones      — [{ zoneNumber, secsInZone, zoneLowBoundary }]
//   exerciseSets — strength sets [{ exercise, category, reps, weightKg, durationSeconds }]
//   streams      — downsampled time series { distance[], hr[], speed[], elevation[] }
export const activityDetails = pgTable("activity_details", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  garminActivityId: text("garmin_activity_id").unique(),
  hrZones: json("hr_zones"),
  exerciseSets: json("exercise_sets"),
  streams: json("streams"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Per-lap (split) breakdown for a synced activity. Linked to the parent by
// garmin_activity_id so the Python sync can upsert laps without knowing our
// internal serial ids. lap_index is 1-based and preserves Garmin's order.
export const activityLaps = pgTable(
  "activity_laps",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    garminActivityId: text("garmin_activity_id"),
    lapIndex: integer("lap_index").notNull(),
    distanceMeters: real("distance_meters"),
    durationSeconds: integer("duration_seconds"),
    avgPaceSecondsPerKm: integer("avg_pace_seconds_per_km"),
    avgSpeedMps: real("avg_speed_mps"),
    maxSpeedMps: real("max_speed_mps"),
    avgHeartRate: integer("avg_heart_rate"),
    maxHeartRate: integer("max_heart_rate"),
    avgCadence: integer("avg_cadence"),
    calories: integer("calories"),
    elevationGainMeters: real("elevation_gain_meters"),
    elevationLossMeters: real("elevation_loss_meters"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.garminActivityId, t.lapIndex)],
);

export const sleepLogs = pgTable(
  "sleep_logs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    date: date("date").notNull(),
    totalSleepSeconds: integer("total_sleep_seconds"),
    deepSleepSeconds: integer("deep_sleep_seconds"),
    lightSleepSeconds: integer("light_sleep_seconds"),
    remSleepSeconds: integer("rem_sleep_seconds"),
    awakeSleepSeconds: integer("awake_sleep_seconds"),
    sleepScore: integer("sleep_score"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.userId, t.date)],
);

export const bodyComposition = pgTable(
  "body_composition",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    date: date("date").notNull(),
    weightKg: real("weight_kg"),
    bodyFatPct: real("body_fat_pct"),
    muscleMassKg: real("muscle_mass_kg"),
    bmi: real("bmi"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.userId, t.date)],
);

// One row per calendar day of Garmin wellness data (steps, floors climbed).
// Goals are stored per-day because Garmin's auto step goal changes over time.
export const dailySummaries = pgTable(
  "daily_summaries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    date: date("date").notNull(),
    steps: integer("steps"),
    stepGoal: integer("step_goal"),
    floorsAscended: integer("floors_ascended"),
    floorsDescended: integer("floors_descended"),
    floorsGoal: integer("floors_goal"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.userId, t.date)],
);

export const meals = pgTable("meals", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  date: date("date").notNull(),
  mealType: text("meal_type"),
  name: text("name").notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  calories: real("calories"),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  fiberG: real("fiber_g"),
  servings: real("servings").default(1),
  ingredients: json("ingredients"),
  openFoodFactsId: text("open_food_facts_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const waterLogs = pgTable("water_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  date: date("date").notNull(),
  amountMl: integer("amount_ml").notNull(),
  loggedAt: timestamp("logged_at").defaultNow(),
});

// Coach ↔ athlete relationship. The athlete generates an invite code (row
// starts with coach_user_id null + status "pending"); a coach redeems the
// code, which sets coach_user_id and flips status to "active". Being a coach
// is purely relational — there is no separate role concept.
export const coachLinks = pgTable("coach_links", {
  id: serial("id").primaryKey(),
  athleteUserId: text("athlete_user_id").notNull(),
  coachUserId: text("coach_user_id"),
  inviteCode: text("invite_code").unique(),
  // pending | active | revoked
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// A prescribed workout: what a coach (or the athlete themself, coach_user_id
// null) plans for a given day — distinct from `activities`, which records
// what Garmin actually synced.
export const plannedWorkouts = pgTable("planned_workouts", {
  id: serial("id").primaryKey(),
  athleteUserId: text("athlete_user_id").notNull(),
  coachUserId: text("coach_user_id"),
  date: date("date").notNull(),
  // Same normalized categories as activities, plus "rest" for off days.
  activityType: text("activity_type"),
  title: text("title").notNull(),
  description: text("description"),
  durationSeconds: integer("duration_seconds"),
  distanceMeters: real("distance_meters"),
  // planned | completed | skipped
  status: text("status").notNull().default("planned"),
  // The Garmin-synced activity that fulfilled this workout, once linked.
  linkedActivityId: integer("linked_activity_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// A free-form note attached to a day of the plan, independent of any workout.
// Lets an athlete (or coach) jot context on a date without faking an "other"
// workout. coach_user_id is null when the athlete wrote it themselves.
export const planNotes = pgTable("plan_notes", {
  id: serial("id").primaryKey(),
  athleteUserId: text("athlete_user_id").notNull(),
  coachUserId: text("coach_user_id"),
  date: date("date").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// A goal race on the athlete's plan. Drives the countdown on the plan page and
// a marker on the calendar. coach_user_id is null when self-added.
export const races = pgTable("races", {
  id: serial("id").primaryKey(),
  athleteUserId: text("athlete_user_id").notNull(),
  coachUserId: text("coach_user_id"),
  date: date("date").notNull(),
  name: text("name").notNull(),
  distanceMeters: real("distance_meters"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// A reusable workout that can be dropped into any plan. Rows are created by
// saving an already-planned workout ("add to catalog") and are owned by
// whoever saved them, so a coach's catalog follows them across athletes.
// Re-saving the same title overwrites the template (upsert on owner+title).
export const workoutTemplates = pgTable(
  "workout_templates",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    activityType: text("activity_type"),
    title: text("title").notNull(),
    description: text("description"),
    durationSeconds: integer("duration_seconds"),
    distanceMeters: real("distance_meters"),
    // Bumped when the template is applied to a plan; drives "Recent" ordering.
    lastUsedAt: timestamp("last_used_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [unique().on(t.ownerUserId, t.title)],
);

export const garminConnections = pgTable("garmin_connections", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
