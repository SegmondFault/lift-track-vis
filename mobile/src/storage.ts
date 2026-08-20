import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

import bodyWeightSeed from './seed/body-weight.weekly.seed.json';
import exerciseLibrarySeed from './seed/exercise-library.seed.json';
import historicWorkoutsSeed from './seed/historic-workouts.cleaned.json';
import strengthNormSeed from './seed/strength-norm.seed.json';
import workoutPlanSeed from './seed/workout-plan.seed.json';

export const SCHEMA_VERSION = 2;
export const dbPromise = SQLite.openDatabaseAsync('lifting-tracker.db');

export type SessionBoundaryMode = 'midnight' | '24h';

export type ExerciseVariation = {
  id: string;
  name: string;
  isDefault: boolean;
  muscleContributions?: { muscleGroupId: string; coefficient: number }[];
};

export type Exercise = {
  id: string;
  name: string;
  tags?: string[];
  variations: ExerciseVariation[];
};

export type PlannedExercise = {
  sourceName: string;
  exerciseId: string;
  variationId: string;
  targetSets: number;
  sortOrder: number;
};

export type WorkoutDay = {
  id: string;
  dayIndex: number;
  name: string;
  exercises: PlannedExercise[];
};

export type LoggedSet = {
  id: string;
  workoutSessionId?: string | null;
  dayIndex: number | null;
  exerciseId: string;
  variationId: string;
  reps: number;
  weight: number;
  loggedAt: Date;
};

export type BodyMetricEntry = {
  id: string;
  measuredAt: Date;
  bodyWeight: number | null;
  bodyFat: number | null;
  source: string;
};

export type UserSex = 'unspecified' | 'male' | 'female';
export type WeekStartDay = 'monday' | 'sunday';

export type AppSettings = {
  userSex: UserSex;
  weekStartDay: WeekStartDay;
};

type LiftSetRow = {
  day_index: number | null;
  exercise_id: string;
  id: string;
  logged_at: string;
  reps: number;
  variation_id: string;
  weight: number;
  workout_session_id?: string | null;
};

type BodyMetricRow = {
  body_fat: number | null;
  body_weight: number | null;
  id: string;
  measured_at: string;
  source: string;
};

type BodyWeightSeedEntry = {
  id: string;
  measuredAt: string;
  bodyWeight: number | null;
  bodyFat: number | null;
  source: string;
};

type HistoricSessionSeed = {
  id: string;
  started_at: string;
};

type HistoricLiftSetSeed = {
  id: string;
  workout_session_id: string;
  day_index: number | null;
  exercise_id: string;
  variation_id: string;
  reps: number;
  weight: number;
  weight_unit: string;
  logged_at: string;
};

export const activePlan = workoutPlanSeed.plans[0];
export const initialDays = activePlan.days as WorkoutDay[];
export const exercises = exerciseLibrarySeed.exercises as Exercise[];
export const muscleGroups = exerciseLibrarySeed.muscleGroups;

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function ensureColumn(tableName: string, columnName: string, definition: string) {
  const db = await dbPromise;
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);

  if (!columns.some((column) => column.name === columnName)) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }

  return lines.join('\n');
}

async function getAllRows(tableName: string) {
  const db = await dbPromise;
  return db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${tableName}`);
}

async function seedStaticData() {
  const db = await dbPromise;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO workout_plan (id, name, is_active, source, schema_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    activePlan.id,
    activePlan.name,
    activePlan.isActive ? 1 : 0,
    workoutPlanSeed.source,
    workoutPlanSeed.schemaVersion,
    now,
    now,
  );

  for (const day of initialDays) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_day (id, workout_plan_id, day_index, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      day.id,
      activePlan.id,
      day.dayIndex,
      day.name,
      now,
      now,
    );

    for (const lift of day.exercises) {
      await db.runAsync(
        `INSERT OR REPLACE INTO workout_day_exercise
          (id, workout_day_id, exercise_id, variation_id, target_sets, sort_order, source_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        `${day.id}__${lift.sortOrder}`,
        day.id,
        lift.exerciseId,
        lift.variationId,
        lift.targetSets,
        lift.sortOrder,
        lift.sourceName,
        now,
        now,
      );
    }
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO training_block (id, name, goal, started_at, ended_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'default-block',
    'Default Block',
    'general',
    new Date(new Date().getFullYear(), 0, 1).toISOString(),
    null,
    now,
    now,
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO plan_assignment
      (id, workout_plan_id, training_block_id, started_at, ended_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'default-assignment',
    activePlan.id,
    'default-block',
    new Date(new Date().getFullYear(), 0, 1).toISOString(),
    null,
    now,
    now,
  );

  for (const muscle of muscleGroups) {
    await db.runAsync(
      `INSERT OR REPLACE INTO muscle_group (id, name, parent_id, sort_order)
        VALUES (?, ?, ?, ?)`,
      muscle.id,
      muscle.name,
      muscle.parentId,
      muscle.sortOrder,
    );
  }

  for (const exercise of exercises) {
    await db.runAsync(
      `INSERT OR REPLACE INTO exercise (id, name, tags, aliases, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      exercise.id,
      exercise.name,
      JSON.stringify(exercise.tags ?? []),
      JSON.stringify((exercise as Exercise & { aliases?: string[] }).aliases ?? []),
      now,
      now,
    );

    for (const variation of exercise.variations) {
      await db.runAsync(
        `INSERT OR REPLACE INTO exercise_variation
          (id, exercise_id, name, is_default, aliases, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        variation.id,
        exercise.id,
        variation.name,
        variation.isDefault ? 1 : 0,
        JSON.stringify((variation as ExerciseVariation & { aliases?: string[] }).aliases ?? []),
        now,
        now,
      );

      for (const contribution of variation.muscleContributions ?? []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO exercise_muscle_contribution
            (id, exercise_id, variation_id, muscle_group_id, coefficient, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          `${variation.id}__${contribution.muscleGroupId}`,
          exercise.id,
          variation.id,
          contribution.muscleGroupId,
          contribution.coefficient,
          now,
          now,
        );
      }
    }
  }

  for (const norm of strengthNormSeed.norms) {
    await db.runAsync(
      `INSERT OR IGNORE INTO strength_norm
        (id, source, exercise_id, sex, bodyweight_min, bodyweight_max, level, metric, value, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      norm.id,
      norm.source,
      norm.exerciseId,
      norm.sex,
      norm.bodyweightMin,
      norm.bodyweightMax,
      norm.level,
      norm.metric,
      norm.value,
      `${norm.notes}${norm.sourceUrl ? ` Source URL: ${norm.sourceUrl}` : ''}`,
    );
  }
}

async function seedHistoricData() {
  const db = await dbPromise;
  const now = new Date().toISOString();

  for (const entry of bodyWeightSeed.entries as BodyWeightSeedEntry[]) {
    await db.runAsync(
      `INSERT OR IGNORE INTO body_metric_entry
        (id, measured_at, body_weight, body_fat, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      entry.id,
      entry.measuredAt,
      entry.bodyWeight,
      entry.bodyFat,
      entry.source,
      now,
      now,
    );
  }

  for (const session of historicWorkoutsSeed.sessions as HistoricSessionSeed[]) {
    await db.runAsync(
      `INSERT OR IGNORE INTO workout_session
        (id, workout_plan_id, workout_day_id, plan_assignment_id, day_index, mode, started_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      null,
      null,
      null,
      null,
      'historic-import',
      session.started_at,
      now,
      now,
    );
  }

  for (const set of historicWorkoutsSeed.liftSets as HistoricLiftSetSeed[]) {
    await db.runAsync(
      `INSERT OR IGNORE INTO lift_set
        (id, workout_session_id, day_index, exercise_id, variation_id, reps, weight, weight_unit, logged_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      set.id,
      set.workout_session_id,
      set.day_index,
      set.exercise_id,
      set.variation_id,
      set.reps,
      set.weight,
      set.weight_unit,
      set.logged_at,
      now,
      now,
    );
  }
}

export async function setupDatabase() {
  const db = await dbPromise;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_plan (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      source TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_day (
      id TEXT PRIMARY KEY NOT NULL,
      workout_plan_id TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_day_exercise (
      id TEXT PRIMARY KEY NOT NULL,
      workout_day_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      variation_id TEXT NOT NULL,
      target_sets INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      source_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_block (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      goal TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_assignment (
      id TEXT PRIMARY KEY NOT NULL,
      workout_plan_id TEXT NOT NULL,
      training_block_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_session (
      id TEXT PRIMARY KEY NOT NULL,
      workout_plan_id TEXT,
      workout_day_id TEXT,
      plan_assignment_id TEXT,
      day_index INTEGER,
      mode TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lift_set (
      id TEXT PRIMARY KEY NOT NULL,
      workout_session_id TEXT,
      day_index INTEGER,
      exercise_id TEXT NOT NULL,
      variation_id TEXT NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      weight_unit TEXT NOT NULL DEFAULT 'kg',
      logged_at TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS body_metric_entry (
      id TEXT PRIMARY KEY NOT NULL,
      measured_at TEXT NOT NULL,
      body_weight REAL,
      body_fat REAL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS muscle_group (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exercise (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      aliases TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_variation (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      aliases TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_muscle_contribution (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL,
      variation_id TEXT NOT NULL,
      muscle_group_id TEXT NOT NULL,
      coefficient REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strength_norm (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      sex TEXT,
      bodyweight_min REAL,
      bodyweight_max REAL,
      level TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      notes TEXT
    );
  `);

  await ensureColumn('lift_set', 'workout_session_id', 'TEXT');
  await ensureColumn('lift_set', 'weight_unit', "TEXT NOT NULL DEFAULT 'kg'");
  await ensureColumn('lift_set', 'created_at', 'TEXT');
  await ensureColumn('lift_set', 'updated_at', 'TEXT');
  await ensureColumn('lift_set', 'deleted_at', 'TEXT');

  await db.runAsync(
    `INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)`,
    'schema_version',
    String(SCHEMA_VERSION),
  );

  await seedStaticData();
  await seedHistoricData();
}

export async function loadLoggedSets() {
  const db = await dbPromise;
  const rows = await db.getAllAsync<LiftSetRow>(
    'SELECT * FROM lift_set WHERE deleted_at IS NULL ORDER BY logged_at ASC',
  );

  return rows.map((row) => ({
    id: row.id,
    workoutSessionId: row.workout_session_id,
    dayIndex: row.day_index,
    exerciseId: row.exercise_id,
    variationId: row.variation_id,
    reps: row.reps,
    weight: row.weight,
    loggedAt: new Date(row.logged_at),
  }));
}

export async function loadBodyMetrics() {
  const db = await dbPromise;
  const rows = await db.getAllAsync<BodyMetricRow>(
    'SELECT * FROM body_metric_entry ORDER BY measured_at DESC LIMIT 20',
  );

  return rows.map((row) => ({
    id: row.id,
    measuredAt: new Date(row.measured_at),
    bodyWeight: row.body_weight,
    bodyFat: row.body_fat,
    source: row.source,
  }));
}

export async function loadAppSettings(): Promise<AppSettings> {
  const db = await dbPromise;
  const userSex = await db.getFirstAsync<{ value: UserSex }>('SELECT value FROM app_metadata WHERE key = ?', 'user_sex');
  const weekStartDay = await db.getFirstAsync<{ value: WeekStartDay }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    'analytics_week_start_day',
  );

  return {
    userSex: userSex?.value ?? 'unspecified',
    weekStartDay: weekStartDay?.value ?? 'monday',
  };
}

export async function saveUserSex(userSex: UserSex) {
  const db = await dbPromise;

  await db.runAsync('INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)', 'user_sex', userSex);
}

export async function saveWeekStartDay(weekStartDay: WeekStartDay) {
  const db = await dbPromise;

  await db.runAsync(
    'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
    'analytics_week_start_day',
    weekStartDay,
  );
}

export async function insertBodyMetric(entry: BodyMetricEntry) {
  const db = await dbPromise;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO body_metric_entry
      (id, measured_at, body_weight, body_fat, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.measuredAt.toISOString(),
    entry.bodyWeight,
    entry.bodyFat,
    entry.source,
    now,
    now,
  );
}

export async function getOrCreateWorkoutSession(params: {
  boundaryStart: Date;
  dayIndex: number | null;
  isFreestyle: boolean;
}) {
  const db = await dbPromise;
  const workoutDay = params.dayIndex
    ? initialDays.find((day) => day.dayIndex === params.dayIndex)
    : null;
  const mode = params.isFreestyle ? 'freestyle' : 'planned';

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM workout_session
      WHERE mode = ?
        AND COALESCE(day_index, -1) = COALESCE(?, -1)
        AND started_at >= ?
      ORDER BY started_at DESC
      LIMIT 1`,
    mode,
    params.dayIndex,
    params.boundaryStart.toISOString(),
  );

  if (existing) {
    return existing.id;
  }

  const now = new Date().toISOString();
  const id = makeId('session');

  await db.runAsync(
    `INSERT INTO workout_session
      (id, workout_plan_id, workout_day_id, plan_assignment_id, day_index, mode, started_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.isFreestyle ? null : activePlan.id,
    params.isFreestyle ? null : workoutDay?.id ?? null,
    params.isFreestyle ? null : 'default-assignment',
    params.dayIndex,
    mode,
    now,
    now,
    now,
  );

  return id;
}

export async function insertLoggedSet(set: LoggedSet) {
  const db = await dbPromise;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO lift_set
      (id, workout_session_id, day_index, exercise_id, variation_id, reps, weight, weight_unit, logged_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    set.id,
    set.workoutSessionId ?? null,
    set.dayIndex,
    set.exerciseId,
    set.variationId,
    set.reps,
    set.weight,
    'kg',
    set.loggedAt.toISOString(),
    now,
    now,
  );
}

export async function removeLoggedSet(setId: string) {
  const db = await dbPromise;
  await db.runAsync('UPDATE lift_set SET deleted_at = ?, updated_at = ? WHERE id = ?', new Date().toISOString(), new Date().toISOString(), setId);
}

export async function exportWorkoutData() {
  const tableNames = [
    'app_metadata',
    'workout_plan',
    'workout_day',
    'workout_day_exercise',
    'training_block',
    'plan_assignment',
    'workout_session',
    'lift_set',
    'body_metric_entry',
    'muscle_group',
    'exercise',
    'exercise_variation',
    'exercise_muscle_contribution',
    'strength_norm',
  ];
  const exportedAt = new Date();
  const stamp = exportedAt.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const directory = `${FileSystem.cacheDirectory}lifting-export-${stamp}/`;
  const tables: Record<string, Record<string, unknown>[]> = {};

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  for (const tableName of tableNames) {
    const rows = await getAllRows(tableName);
    tables[tableName] = rows;
    await FileSystem.writeAsStringAsync(`${directory}${tableName}.csv`, toCsv(rows));
  }

  const latestSetLoggedAt = (tables.lift_set ?? [])
    .map((row) => (typeof row.logged_at === 'string' ? row.logged_at : null))
    .filter(Boolean)
    .sort()
    .at(-1);

  const backup = {
    schemaVersion: SCHEMA_VERSION,
    exportId: `export-${stamp}`,
    exportedAt: exportedAt.toISOString(),
    createdOnDeviceAt: exportedAt.toISOString(),
    latestSetLoggedAt,
    format: 'lifting-tracker-full-backup-json',
    notes: 'Read-only export for Mac visualizer imports. CSV siblings are generated in the same cache bundle.',
    tables,
  };
  const jsonPath = `${directory}full-backup.json`;
  await FileSystem.writeAsStringAsync(jsonPath, JSON.stringify(backup, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(jsonPath, {
      dialogTitle: 'Export lifting tracker backup',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  }

  return { directory, jsonPath };
}
