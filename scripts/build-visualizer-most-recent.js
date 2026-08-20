const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const now = new Date().toISOString();
const privateProfilePath = path.join(root, 'data/private/profile.json');
const privateProfile = fs.existsSync(privateProfilePath) ? JSON.parse(fs.readFileSync(privateProfilePath, 'utf8')) : {};
const privateProfileRows = Object.entries(privateProfile).map(([key, value]) => ({
  key,
  value: typeof value === 'string' ? value : JSON.stringify(value),
}));

const exerciseLibrary = readJson('data/exercise-library.seed.json');
const workoutPlanSeed = readJson('data/workout-plan.seed.json');
const historic = readJson('data/imports/historic-workouts.cleaned.json');
const lastWeek = readJson('data/imports/last-week.actual.json');
const bodyWeight = readJson('data/body-weight.weekly.seed.json');
const strengthNorms = readJson('data/strength-norm.seed.json');
const extraStrengthNorms = fs.existsSync(path.join(root, 'data/strength-norm.extra.seed.json'))
  ? readJson('data/strength-norm.extra.seed.json')
  : { norms: [] };
const bodyCompositionNorms = fs.existsSync(path.join(root, 'data/sources/nhanes-body-composition-norms.json'))
  ? readJson('data/sources/nhanes-body-composition-norms.json')
  : { norms: [] };
const bodyCompositionModels = fs.existsSync(path.join(root, 'data/sources/nhanes-body-composition-models.json'))
  ? readJson('data/sources/nhanes-body-composition-models.json')
  : { models: [] };
const athleteBodyCompositionReference = fs.existsSync(path.join(root, 'data/sources/athlas-athlete-body-composition-reference.json'))
  ? readJson('data/sources/athlas-athlete-body-composition-reference.json')
  : { groups: [] };
const manualRecent = fs.existsSync(path.join(root, 'data/imports/manual-recent-sets.json'))
  ? readJson('data/imports/manual-recent-sets.json')
  : { sessions: [] };
const lastWeekDateOverrides = fs.existsSync(path.join(root, 'data/imports/last-week-date-overrides.json'))
  ? readJson('data/imports/last-week-date-overrides.json')
  : { dayDates: {} };

const tables = {
  app_metadata: [
    ...privateProfileRows,
    { key: 'analytics_week_start_day', value: 'monday' },
  ],
  workout_plan: [],
  workout_day: [],
  workout_day_exercise: [],
  training_block: [],
  plan_assignment: [],
  workout_session: [],
  lift_set: [],
  projected_lift_set: [],
  body_metric_entry: [],
  body_measurement_entry: [],
  body_composition_norm: [],
  body_composition_model: [],
  body_composition_reference: [],
  muscle_group: [],
  exercise: [],
  exercise_variation: [],
  exercise_muscle_contribution: [],
  strength_norm: [],
};

const extraExercises = [
  {
    id: 'chest-press-machine',
    name: 'Chest Press Machine',
    tags: ['compound', 'machine'],
    variationId: 'chest-press-machine__standard',
    variationName: 'Standard',
    muscles: [
      ['chest', 1],
      ['triceps', 0.6],
      ['front-delts', 0.45],
      ['upper-chest', 0.25],
    ],
  },
  {
    id: 'incline-chest-press-machine',
    name: 'Incline Chest Press Machine',
    tags: ['compound', 'machine'],
    variationId: 'incline-chest-press-machine__standard',
    variationName: 'Standard',
    muscles: [
      ['upper-chest', 1],
      ['chest', 0.75],
      ['front-delts', 0.55],
      ['triceps', 0.5],
    ],
  },
  {
    id: 'seated-row',
    name: 'Seated Row',
    tags: ['compound', 'machine'],
    variationId: 'seated-row__standard',
    variationName: 'Standard',
    muscles: [
      ['upper-back', 1],
      ['lats', 0.85],
      ['biceps', 0.45],
      ['rear-delts', 0.35],
    ],
  },
  {
    id: 'lat-pulldown-machine',
    name: 'Lat Pulldown Machine',
    tags: ['compound', 'machine'],
    variationId: 'lat-pulldown-machine__standard',
    variationName: 'Standard',
    muscles: [
      ['lats', 1],
      ['upper-back', 0.6],
      ['biceps', 0.45],
      ['rear-delts', 0.25],
    ],
  },
  {
    id: 'rear-delt-fly',
    name: 'Rear Delt Fly',
    tags: ['accessory'],
    variationId: 'rear-delt-fly__standard',
    variationName: 'Standard',
    muscles: [
      ['rear-delts', 1],
      ['upper-back', 0.35],
    ],
  },
  {
    id: 'back-extension',
    name: 'Back Extension',
    tags: ['accessory'],
    variationId: 'back-extension__standard',
    variationName: 'Standard',
    muscles: [
      ['spinal-erectors', 1],
      ['glutes', 0.55],
      ['hamstrings', 0.45],
    ],
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    tags: ['compound'],
    variationId: 'romanian-deadlift__standard',
    variationName: 'Standard',
    muscles: [
      ['hamstrings', 1],
      ['glutes', 0.85],
      ['spinal-erectors', 0.75],
      ['upper-back', 0.25],
    ],
  },
  {
    id: 'shoulder-press-machine',
    name: 'Shoulder Press Machine',
    tags: ['compound', 'machine'],
    variationId: 'shoulder-press-machine__standard',
    variationName: 'Standard',
    muscles: [
      ['front-delts', 1],
      ['side-delts', 0.5],
      ['triceps', 0.55],
      ['upper-chest', 0.2],
    ],
  },
];

function inferredEquipmentTag(exercise) {
  const text = `${exercise.id} ${exercise.name} ${(exercise.tags || []).join(' ')}`.toLowerCase();
  if (text.includes('pull-up') || text.includes('pullup') || text.includes('leg raise') || text.includes('bodyweight')) {
    return 'bodyweight';
  }
  if (text.includes('cable') || text.includes('pushdown') || text.includes('face pull')) {
    return 'cable';
  }
  if (
    text.includes('machine') ||
    text.includes('pec fly') ||
    text.includes('rear-delt-fly') ||
    text.includes('seated-row') ||
    text.includes('back-extension') ||
    text.includes('glute')
  ) {
    return 'machine';
  }
  return 'freeweight';
}

function tagsWithEquipment(exercise) {
  const tags = new Set(exercise.tags || []);
  for (const tag of ['freeweight', 'machine', 'cable', 'bodyweight']) {
    tags.delete(tag);
  }
  tags.add(inferredEquipmentTag(exercise));
  return [...tags];
}

function buildAthlasReferenceRows(payload) {
  const rows = [];
  const base = {
    source: payload.source,
    cycle: payload.cycle,
    doi: payload.doi,
    source_url: payload.source_url,
    sex: payload.sex,
    notes: payload.notes,
  };

  for (const group of payload.groups || []) {
    const metrics = { ...(group.metrics || {}) };
    const height = metrics.height_cm || {};
    const bodyMass = metrics.body_mass_kg || {};
    const fatMass = metrics.total_fat_mass_kg || {};
    if (height.mean && bodyMass.mean !== undefined && fatMass.mean !== undefined) {
      const heightM = Number(height.mean) / 100;
      const fatFreeMass = Number(bodyMass.mean) - Number(fatMass.mean);
      const fatFreeSd = Math.sqrt((Number(bodyMass.sd) || 0) ** 2 + (Number(fatMass.sd) || 0) ** 2);
      metrics.fat_free_mass_kg_derived = {
        mean: Number(fatFreeMass.toFixed(4)),
        sd: Number(fatFreeSd.toFixed(4)),
        unit: 'kg',
        derived: true,
      };
      metrics.ffmi_derived = {
        mean: Number((fatFreeMass / (heightM ** 2)).toFixed(4)),
        sd: Number((fatFreeSd / (heightM ** 2)).toFixed(4)),
        unit: 'kg/m^2',
        derived: true,
      };
    }

    for (const [metric, values] of Object.entries(metrics)) {
      rows.push({
        ...base,
        id: `${group.id}-${metric}`,
        athlete_type: group.athlete_type,
        group_label: group.group_label,
        age_min: group.age_min,
        age_max: group.age_max,
        age_band: `${group.age_min}-${group.age_max}`,
        n: group.n,
        metric,
        mean: values.mean,
        sd: values.sd,
        unit: values.unit,
        is_derived: Boolean(values.derived),
      });
    }
  }

  return rows;
}

function previousMondayIso(baseIso) {
  const date = new Date(baseIso);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
  const diff = (utc.getUTCDay() - 1 + 7) % 7;
  utc.setUTCDate(utc.getUTCDate() - diff - 7);
  return utc;
}

function lastWeekSessionDate(session) {
  if (session.sourceDate) return session.sourceDate;
  const monday = previousMondayIso(now);
  monday.setUTCDate(monday.getUTCDate() + Math.max(0, (session.planDayIndex || 1) - 1));
  return monday.toISOString();
}

function projectedCurrentWeekSessionDate(dayIndex) {
  return lastWeekDateOverrides.projectedDayDates?.[dayIndex] || lastWeekDateOverrides.dayDates?.[dayIndex] || null;
}

function correctedHistoricSet(set) {
  const source = String(set.source_exercise_name || '').toLowerCase();
  const explicitlyFreeweight = /\b(barbell|dumbbell|dumbell|landmine)\b/.test(source);

  if (source.includes('lat pulldown') || source.includes('lat pull down') || source.includes('lat pull')) {
    return { ...set, exercise_id: 'lat-pulldown-machine', variation_id: 'lat-pulldown-machine__standard' };
  }

  if (source.includes('landmine')) {
    return set;
  }

  if (source.includes('back press')) {
    return { ...set, exercise_id: 'back-extension', variation_id: 'back-extension__standard' };
  }

  if (
    source.includes('row') ||
    source.includes('diverging seat') ||
    source.includes('div row')
  ) {
    return { ...set, exercise_id: 'seated-row', variation_id: 'seated-row__standard' };
  }

  if (source.includes('rear delt')) {
    return { ...set, exercise_id: 'rear-delt-fly', variation_id: 'rear-delt-fly__standard' };
  }

  if (source.includes('back extension')) {
    return { ...set, exercise_id: 'back-extension', variation_id: 'back-extension__standard' };
  }

  if (source.includes('romania')) {
    return { ...set, exercise_id: 'romanian-deadlift', variation_id: 'romanian-deadlift__standard' };
  }

  if (
    !explicitlyFreeweight &&
    (source.includes('chest press') || source.includes('bench press') || source.includes('bench heavy') || source.includes('machine chest press'))
  ) {
    return { ...set, exercise_id: 'chest-press-machine', variation_id: 'chest-press-machine__standard' };
  }

  if (!explicitlyFreeweight && (source.includes('incline bench') || source.includes('incline press'))) {
    return { ...set, exercise_id: 'incline-chest-press-machine', variation_id: 'incline-chest-press-machine__standard' };
  }

  if (
    !explicitlyFreeweight &&
    (source.includes('shoulder press') ||
      source.includes('should press') ||
      source.includes('shouldpress') ||
      source.includes('overhead press') ||
      source.includes('machine shoulder extension'))
  ) {
    return { ...set, exercise_id: 'shoulder-press-machine', variation_id: 'shoulder-press-machine__standard' };
  }

  if (!explicitlyFreeweight && source.includes('squat')) {
    return { ...set, exercise_id: 'squat-machine', variation_id: 'squat-machine__standard' };
  }

  return set;
}

function correctedImportedSourceSet(set, sourceName) {
  return correctedHistoricSet({ ...set, source_exercise_name: sourceName });
}

for (const group of exerciseLibrary.muscleGroups) {
  tables.muscle_group.push({
    id: group.id,
    name: group.name,
    parent_id: group.parentId ?? null,
    sort_order: group.sortOrder ?? 0,
  });
}

if (!tables.muscle_group.some((group) => group.id === 'spinal-erectors')) {
  tables.muscle_group.push({
    id: 'spinal-erectors',
    name: 'Spinal Erectors',
    parent_id: 'back',
    sort_order: 99,
  });
}

for (const exercise of exerciseLibrary.exercises) {
  tables.exercise.push({
    id: exercise.id,
    name: exercise.name,
    tags: JSON.stringify(tagsWithEquipment(exercise)),
    aliases: JSON.stringify(exercise.aliases || []),
    created_at: now,
    updated_at: now,
  });

  for (const variation of exercise.variations || []) {
    tables.exercise_variation.push({
      id: variation.id,
      exercise_id: exercise.id,
      name: variation.name,
      is_default: variation.isDefault ? 1 : 0,
      aliases: JSON.stringify(variation.aliases || []),
      created_at: now,
      updated_at: now,
    });

    for (const contribution of variation.muscleContributions || []) {
      tables.exercise_muscle_contribution.push({
        id: `${variation.id}__${contribution.muscleGroupId}`,
        variation_id: variation.id,
        muscle_group_id: contribution.muscleGroupId,
        coefficient: contribution.coefficient,
      });
    }
  }
}

const libraryExerciseIds = new Set(exerciseLibrary.exercises.map((exercise) => exercise.id));
for (const exercise of extraExercises.filter((item) => !libraryExerciseIds.has(item.id))) {
  tables.exercise.push({
    id: exercise.id,
    name: exercise.name,
    tags: JSON.stringify(tagsWithEquipment(exercise)),
    aliases: JSON.stringify([]),
    created_at: now,
    updated_at: now,
  });
  tables.exercise_variation.push({
    id: exercise.variationId,
    exercise_id: exercise.id,
    name: exercise.variationName,
    is_default: 1,
    aliases: JSON.stringify([]),
    created_at: now,
    updated_at: now,
  });
  for (const [muscleGroupId, coefficient] of exercise.muscles) {
    tables.exercise_muscle_contribution.push({
      id: `${exercise.variationId}__${muscleGroupId}`,
      variation_id: exercise.variationId,
      muscle_group_id: muscleGroupId,
      coefficient,
    });
  }
}

for (const plan of workoutPlanSeed.plans) {
  tables.workout_plan.push({
    id: plan.id,
    name: plan.name,
    is_active: plan.isActive ? 1 : 0,
    source: workoutPlanSeed.source,
    schema_version: workoutPlanSeed.schemaVersion,
    created_at: now,
    updated_at: now,
  });

  for (const day of plan.days || []) {
    tables.workout_day.push({
      id: day.id,
      workout_plan_id: plan.id,
      day_index: day.dayIndex,
      name: day.name,
      created_at: now,
      updated_at: now,
    });

    for (const exercise of day.exercises || []) {
      tables.workout_day_exercise.push({
        id: `${day.id}__${exercise.exerciseId}__${exercise.variationId}__${exercise.sortOrder}`,
        workout_day_id: day.id,
        exercise_id: exercise.exerciseId,
        variation_id: exercise.variationId,
        target_sets: exercise.targetSets,
        sort_order: exercise.sortOrder,
        source_name: exercise.sourceName || null,
        created_at: now,
        updated_at: now,
      });
    }
  }
}

tables.plan_assignment.push({
  id: 'local-import-training-regime-2026',
  workout_plan_id: workoutPlanSeed.plans[0]?.id || 'training-regime-2026',
  training_block_id: null,
  started_at: historic.sessions.map((session) => session.started_at).sort()[0] || now,
  ended_at: null,
  created_at: now,
  updated_at: now,
});

for (const entry of bodyWeight.entries) {
  tables.body_metric_entry.push({
    id: entry.id,
    measured_at: entry.measuredAt,
    body_weight: entry.bodyWeight,
    body_fat: entry.bodyFat,
    source: entry.source,
    created_at: now,
    updated_at: now,
  });
}

for (const session of historic.sessions) {
  tables.workout_session.push({
    id: session.id,
    workout_plan_id: null,
    workout_day_id: null,
    plan_assignment_id: null,
    day_index: null,
    mode: 'historic-import',
    started_at: session.started_at,
    created_at: now,
    updated_at: now,
  });
}

for (const originalSet of historic.liftSets) {
  const set = correctedHistoricSet(originalSet);
  tables.lift_set.push({
    id: set.id,
    workout_session_id: set.workout_session_id,
    day_index: set.day_index,
    exercise_id: set.exercise_id,
    variation_id: set.variation_id,
    reps: set.reps,
    weight: set.weight,
    weight_unit: set.weight_unit || 'kg',
    logged_at: set.logged_at,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

for (const session of lastWeek.sessions || []) {
  const sessionDate = lastWeekSessionDate(session);
  tables.workout_session.push({
    id: session.id,
    workout_plan_id: session.planId || null,
    workout_day_id: session.planId && session.planDayIndex ? `${session.planId}__day-${session.planDayIndex}` : null,
    plan_assignment_id: 'local-import-training-regime-2026',
    day_index: session.planDayIndex ?? null,
    mode: 'last-week-import',
    started_at: sessionDate,
    planned_set_count: (session.exercises || []).reduce((total, exercise) => total + Number(exercise.targetSets || 0), 0),
    observed_set_count: (session.exercises || []).reduce((total, exercise) => total + Number(exercise.observedSetCount || 0), 0),
    created_at: now,
    updated_at: now,
  });

  for (const exercise of session.exercises || []) {
    for (const [index, set] of (exercise.observedSets || exercise.sets || []).entries()) {
      tables.lift_set.push({
        id: `${session.id}__${exercise.exerciseId}__${exercise.variationId}__${index + 1}`,
        workout_session_id: session.id,
        day_index: session.planDayIndex ?? null,
        exercise_id: exercise.exerciseId,
        variation_id: exercise.variationId,
        reps: set.reps,
        weight: set.weight,
        weight_unit: set.weightUnit || 'kg',
        logged_at: sessionDate,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
    }
  }
}

for (const session of manualRecent.sessions || []) {
  tables.workout_session.push({
    id: session.id,
    workout_plan_id: null,
    workout_day_id: null,
    plan_assignment_id: null,
    day_index: null,
    mode: session.mode || 'manual-recent-import',
    started_at: session.startedAt,
    created_at: now,
    updated_at: now,
  });

  for (const set of session.sets || []) {
    tables.lift_set.push({
      id: set.id,
      workout_session_id: session.id,
      day_index: null,
      exercise_id: set.exerciseId,
      variation_id: set.variationId,
      reps: set.reps,
      weight: set.weight,
      weight_unit: set.weightUnit || 'kg',
      logged_at: session.startedAt,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }
}

function latestObservedSet(exerciseId, variationId, beforeDate) {
  return tables.lift_set
    .filter(
      (set) =>
        set.exercise_id === exerciseId &&
        set.variation_id === variationId &&
        Date.parse(set.logged_at) < Date.parse(beforeDate) &&
        Number(set.reps) > 0 &&
        Number(set.weight) > 0,
    )
    .sort((a, b) => Date.parse(b.logged_at) - Date.parse(a.logged_at))[0];
}

for (const dayIndex of [4, 5]) {
  const projectedAt = projectedCurrentWeekSessionDate(dayIndex);
  if (!projectedAt) continue;

  const day = tables.workout_day.find((row) => row.workout_plan_id === 'training-regime-2026' && Number(row.day_index) === dayIndex);
  const targets = tables.workout_day_exercise.filter((target) => target.workout_day_id === day?.id);
  const sourceSession = (lastWeek.sessions || []).find((session) => Number(session.planDayIndex) === dayIndex);

  for (const target of targets) {
    const sourceExercise = (sourceSession?.exercises || []).find(
      (exercise) => exercise.exerciseId === target.exercise_id && exercise.variationId === target.variation_id,
    );
    const projectedSetCount = Number(sourceExercise?.observedSetCount ?? target.target_sets ?? 0);
    if (projectedSetCount <= 0) continue;
    const sourceSets = sourceExercise?.observedSets || [];
    const fallbackTemplate = latestObservedSet(target.exercise_id, target.variation_id, projectedAt);

    for (let index = 0; index < projectedSetCount; index += 1) {
      const sourceSet = sourceSets[index] || sourceSets[0] || null;
      const reps = sourceSet ? sourceSet.reps : fallbackTemplate?.reps ?? null;
      const weight = sourceSet ? sourceSet.weight : fallbackTemplate?.weight ?? null;
      const weightUnit = sourceSet ? sourceSet.weightUnit || 'kg' : fallbackTemplate?.weight_unit || 'kg';
      tables.projected_lift_set.push({
        id: `projected-2026-week-day-${dayIndex}-${target.exercise_id}-${target.variation_id}-${index + 1}`,
        workout_session_id: `projected-2026-week-day-${dayIndex}`,
        day_index: dayIndex,
        exercise_id: target.exercise_id,
        variation_id: target.variation_id,
        reps,
        weight,
        weight_unit: weightUnit,
        logged_at: projectedAt,
        projection_source_set_id: sourceSet
          ? `last-week__day-${dayIndex}__${target.exercise_id}__${target.variation_id}__${index + 1}`
          : fallbackTemplate?.id || null,
        set_count_only: Number(reps) > 0 && Number(weight) > 0 ? 0 : 1,
        projection_reason: sourceSet
          ? 'Current-week Day 4/5 hard-copy projection from observed last-week row.'
          : fallbackTemplate
            ? 'Current-week Day 4/5 projection from latest observed same exercise/variation.'
            : 'Current-week Day 4/5 set-count projection; no previous weighted same exercise/variation found.',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
    }
  }
}

for (const norm of [...strengthNorms.norms, ...extraStrengthNorms.norms]) {
  tables.strength_norm.push({
    id: norm.id,
    source: norm.source,
    exercise_id: norm.exerciseId,
    sex: norm.sex,
    bodyweight_min: norm.bodyweightMin,
    bodyweight_max: norm.bodyweightMax,
    level: norm.level,
    metric: norm.metric,
    value: norm.value,
    notes: `${norm.notes}${norm.sourceUrl ? ` Source URL: ${norm.sourceUrl}` : ''}`,
  });
}

for (const norm of bodyCompositionNorms.norms || []) {
  tables.body_composition_norm.push(norm);
}

for (const model of bodyCompositionModels.models || []) {
  tables.body_composition_model.push(model);
}

for (const reference of buildAthlasReferenceRows(athleteBodyCompositionReference)) {
  tables.body_composition_reference.push(reference);
}

const latestSetLoggedAt = tables.lift_set
  .map((row) => row.logged_at)
  .filter(Boolean)
  .sort()
  .at(-1);

const backup = {
  schemaVersion: 1,
  exportId: `local-most-recent-${now.replace(/[:.]/g, '-')}`,
  exportedAt: now,
  createdOnDeviceAt: now,
  latestSetLoggedAt,
  format: 'lifting-tracker-full-backup-json',
  notes: 'Local visualizer import built from cleaned historic workbook data, last-week import data, seed library, bodyweight seed, workout plan seed, and strength norms.',
  tables,
};

const outputPath = path.join(root, 'data/imports/most-recent.full-backup.json');
fs.writeFileSync(outputPath, `${JSON.stringify(backup, null, 2)}\n`);

console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(`${tables.workout_session.length} sessions`);
console.log(`${tables.lift_set.length} sets`);
console.log(`${tables.body_metric_entry.length} body metric entries`);
