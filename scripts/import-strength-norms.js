#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const defaultCsvPath = path.join(root, 'data', 'sources', 'strength-norms.editable.csv');
const outputPath = path.join(root, 'data', 'strength-norm.seed.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted && char === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ''])),
  );
}

async function loadCsv() {
  const source = process.argv[2] ?? defaultCsvPath;

  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to fetch ${source}: ${response.status}`);
    const text = await response.text();
    const rawPath = path.join(root, 'data', 'sources', `strength-norms-${Date.now()}.csv`);
    fs.writeFileSync(rawPath, text);
    return { text, sourcePath: rawPath };
  }

  return { text: fs.readFileSync(source, 'utf8'), sourcePath: source };
}

function nullableNumber(value) {
  if (!String(value ?? '').trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric value: ${value}`);
  return parsed;
}

async function main() {
  const { text, sourcePath } = await loadCsv();
  const rows = parseCsv(text);
  const norms = rows.map((row) => ({
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url || null,
    exerciseId: row.exercise_id,
    sex: row.sex || null,
    bodyweightMin: nullableNumber(row.bodyweight_min),
    bodyweightMax: nullableNumber(row.bodyweight_max),
    level: row.level,
    metric: row.metric,
    value: nullableNumber(row.value),
    notes: row.notes || '',
  }));

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        source: sourcePath,
        generatedAt: new Date().toISOString(),
        notes: 'Generated from editable CSV. Review sources and assumptions before using as external guidance.',
        norms,
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify({ norms: norms.length, outputPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
