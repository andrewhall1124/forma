import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  garminActivityId: text("garmin_activity_id").unique(),
  date: date("date").notNull(),
  distanceMeters: real("distance_meters"),
  durationSeconds: integer("duration_seconds"),
  avgPaceSecondsPerKm: integer("avg_pace_seconds_per_km"),
  avgHeartRate: integer("avg_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  calories: integer("calories"),
  elevationGainMeters: real("elevation_gain_meters"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sleepLogs = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  date: date("date").notNull().unique(),
  totalSleepSeconds: integer("total_sleep_seconds"),
  deepSleepSeconds: integer("deep_sleep_seconds"),
  lightSleepSeconds: integer("light_sleep_seconds"),
  remSleepSeconds: integer("rem_sleep_seconds"),
  awakeSleepSeconds: integer("awake_sleep_seconds"),
  sleepScore: integer("sleep_score"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bodyComposition = pgTable("body_composition", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  date: date("date").notNull().unique(),
  weightKg: real("weight_kg"),
  bodyFatPct: real("body_fat_pct"),
  muscleMassKg: real("muscle_mass_kg"),
  bmi: real("bmi"),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const garminConnections = pgTable("garmin_connections", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
