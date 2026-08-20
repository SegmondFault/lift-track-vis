const fs = require('fs');

const importPath = process.argv[2] ?? 'data/imports/last-week.actual.json';
const libraryPath = 'data/exercise-library.seed.json';
const outputPath = importPath.replace(/\.json$/, '.summary.json');

const imported = JSON.parse(fs.readFileSync(importPath, 'utf8'));
const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

const exercises = new Map(library.exercises.map((exercise) => [exercise.id, exercise]));
const muscleGroups = new Map(library.muscleGroups.map((muscle) => [muscle.id, muscle]));

function getVariation(exerciseId, variationId) {
  return exercises.get(exerciseId)?.variations.find((variation) => variation.id === variationId);
}

function e1rm(weight, reps) {
  return weight * (1 + reps / 30);
}

function addMetric(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}

const sessions = imported.sessions.map((session) => {
  const muscleVolume = new Map();
  const compoundAccessoryVolume = new Map();
  const exerciseSummaries = [];
  let plannedSets = 0;
  let completedSets = 0;
  let totalVolume = 0;

  for (const exerciseEntry of session.exercises) {
    plannedSets += exerciseEntry.targetSets ?? 0;
    completedSets += exerciseEntry.observedSetCount;

    const exercise = exercises.get(exerciseEntry.exerciseId);
    const variation = getVariation(exerciseEntry.exerciseId, exerciseEntry.variationId);
    const contributions = variation?.muscleContributions ?? [];
    const tags = exercise?.tags ?? ['untagged'];
    const sets = exerciseEntry.observedSets.map((set) => {
      const volume = set.reps * set.weight;
      totalVolume += volume;

      for (const contribution of contributions) {
        addMetric(muscleVolume, contribution.muscleGroupId, volume * contribution.coefficient);
      }

      for (const tag of tags) {
        addMetric(compoundAccessoryVolume, tag, volume);
      }

      return {
        ...set,
        volume,
        e1rm: Number(e1rm(set.weight, set.reps).toFixed(2)),
      };
    });

    exerciseSummaries.push({
      sourceName: exerciseEntry.sourceName,
      exerciseId: exerciseEntry.exerciseId,
      variationId: exerciseEntry.variationId,
      targetSets: exerciseEntry.targetSets,
      completedSets: exerciseEntry.observedSetCount,
      setCompletionRatio: exerciseEntry.adherence.setCompletionRatio,
      bestE1rm: sets.length ? Math.max(...sets.map((set) => set.e1rm)) : null,
      totalVolume: sets.reduce((total, set) => total + set.volume, 0),
      sets,
    });
  }

  return {
    id: session.id,
    planId: session.planId,
    planDayIndex: session.planDayIndex,
    sourceDate: session.sourceDate,
    plannedSets,
    completedSets,
    setCompletionRatio: plannedSets ? completedSets / plannedSets : null,
    totalVolume,
    compoundAccessoryVolume: Object.fromEntries(compoundAccessoryVolume),
    muscleVolume: Object.fromEntries(
      [...muscleVolume.entries()].map(([muscleId, volume]) => [muscleGroups.get(muscleId)?.name ?? muscleId, volume]),
    ),
    exercises: exerciseSummaries,
  };
});

const summary = {
  schemaVersion: 1,
  source: importPath,
  generatedAt: new Date().toISOString(),
  sessions,
  totals: {
    plannedSets: sessions.reduce((total, session) => total + session.plannedSets, 0),
    completedSets: sessions.reduce((total, session) => total + session.completedSets, 0),
    totalVolume: sessions.reduce((total, session) => total + session.totalVolume, 0),
  },
};

summary.totals.setCompletionRatio = summary.totals.plannedSets
  ? summary.totals.completedSets / summary.totals.plannedSets
  : null;

fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      outputPath,
      totals: summary.totals,
      sessions: sessions.map((session) => ({
        id: session.id,
        plannedSets: session.plannedSets,
        completedSets: session.completedSets,
        totalVolume: session.totalVolume,
      })),
    },
    null,
    2,
  ),
);
