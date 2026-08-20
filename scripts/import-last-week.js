const fs = require('fs');
const os = require('os');
const path = require('path');

const sourcePath = process.argv[2] ?? path.join(os.homedir(), 'Downloads', 'last week.csv');
const exerciseLibraryPath = 'data/exercise-library.seed.json';
const outputPath = 'data/imports/last-week.actual.json';

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseNumber(value) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRepCell(value, fallbackWeight) {
  if (!value) return null;

  if (value.includes(':')) {
    const [weight, reps] = value.split(':').map(parseNumber);

    if (weight === null || reps === null) {
      return null;
    }

    return { reps, weight };
  }

  const reps = parseNumber(value);

  if (reps === null || fallbackWeight === null) {
    return null;
  }

  return { reps, weight: fallbackWeight };
}

const library = JSON.parse(fs.readFileSync(exerciseLibraryPath, 'utf8'));
const lookup = new Map();

for (const exercise of library.exercises) {
  const defaultVariation = exercise.variations.find((variation) => variation.isDefault) ?? exercise.variations[0];
  const names = [exercise.name, ...(exercise.aliases ?? [])];

  for (const name of names) {
    lookup.set(name.toLowerCase(), {
      exerciseId: exercise.id,
      variationId: defaultVariation.id,
    });
  }

  for (const variation of exercise.variations) {
    for (const alias of variation.aliases ?? []) {
      lookup.set(alias.toLowerCase(), {
        exerciseId: exercise.id,
        variationId: variation.id,
      });
    }
  }
}

const dayColumns = [
  { sourceColumnName: 'Day 1', sourceColumnOrdinal: 1, dayIndex: 1, nameCol: 0, targetCol: 1, repCols: [2, 3, 4, 5], weightCol: 6 },
  { sourceColumnName: 'Day 2', sourceColumnOrdinal: 2, dayIndex: 2, nameCol: 7, targetCol: 8, repCols: [9, 10, 11], weightCol: 12 },
  { sourceColumnName: 'Day 3', sourceColumnOrdinal: 3, dayIndex: 3, nameCol: 13, targetCol: 14, repCols: [15, 16, 17], weightCol: 18 },
  { sourceColumnName: 'Day 4', sourceColumnOrdinal: 4, dayIndex: 4, nameCol: 19, targetCol: 20, repCols: [21], weightCol: 22 },
  { sourceColumnName: 'Day 4', sourceColumnOrdinal: 5, dayIndex: 5, nameCol: 23, targetCol: 24, repCols: [], weightCol: null },
];

const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).filter(Boolean);
const rows = lines.slice(2).map(parseCsvLine);
const sessions = dayColumns.map((day) => ({
  id: `last-week__day-${day.dayIndex}`,
  planId: 'training-regime-2026',
  planDayIndex: day.dayIndex,
  name: `Last Week ${day.sourceColumnName}${day.sourceColumnOrdinal === 5 ? ' (second)' : ''}`,
  sourceColumnName: day.sourceColumnName,
  sourceColumnOrdinal: day.sourceColumnOrdinal,
  sourceDate: null,
  exercises: [],
}));

for (const row of rows) {
  for (const day of dayColumns) {
    const sourceName = row[day.nameCol];

    if (!sourceName) {
      continue;
    }

    const targetSets = parseNumber(row[day.targetCol]);
    const fallbackWeight = day.weightCol === null ? null : parseNumber(row[day.weightCol]);
    const mapping = lookup.get(sourceName.toLowerCase());
    const observedSets = [];

    for (const repCol of day.repCols) {
      const parsedSet = parseRepCell(row[repCol], fallbackWeight);

      if (parsedSet) {
        observedSets.push({
          reps: parsedSet.reps,
          weight: parsedSet.weight,
          weightUnit: 'kg',
        });
      }
    }

    sessions[day.dayIndex - 1].exercises.push({
      sourceName,
      exerciseId: mapping?.exerciseId ?? null,
      variationId: mapping?.variationId ?? null,
      targetSets,
      observedSets,
      observedSetCount: observedSets.length,
      adherence: {
        completedSets: observedSets.length,
        targetSets,
        setCompletionRatio: targetSets ? observedSets.length / targetSets : null,
      },
      importWarnings: mapping ? [] : ['No matching exercise alias found'],
    });
  }
}

const output = {
  schemaVersion: 1,
  source: sourcePath,
  importedAt: new Date().toISOString(),
  notes:
    'Actual set import from last week.csv. sourceDate is null because the CSV does not include calendar dates.',
  sessions,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

const warnings = sessions.flatMap((session) =>
  session.exercises
    .filter((exercise) => exercise.importWarnings.length > 0)
    .map((exercise) => `${session.id}: ${exercise.sourceName}: ${exercise.importWarnings.join(', ')}`),
);

const summary = sessions.map((session) => ({
  id: session.id,
  exercises: session.exercises.length,
  observedSets: session.exercises.reduce((total, exercise) => total + exercise.observedSetCount, 0),
  plannedSets: session.exercises.reduce((total, exercise) => total + (exercise.targetSets ?? 0), 0),
}));

console.log(JSON.stringify({ outputPath, summary, warnings }, null, 2));
