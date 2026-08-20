#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'data', 'sources', 'legion-strength-standards.raw.json');
const outputPath = path.join(root, 'data', 'strength-norm.seed.json');
const csvPath = path.join(root, 'data', 'sources', 'legion-strength-standards.kg.csv');
const LB_TO_KG = 0.45359237;

function kg(lb) {
  return Math.round(Number(lb) * LB_TO_KG * 10) / 10;
}

function bodyweightNumber(label) {
  return Number(String(label).replace('+', ''));
}

function bodyweightBands(labels) {
  const lbs = labels.map(bodyweightNumber);

  return labels.map((label, index) => {
    const previous = index === 0 ? null : (lbs[index - 1] + lbs[index]) / 2;
    const next = index === labels.length - 1 ? null : (lbs[index] + lbs[index + 1]) / 2;
    const isOpenEnded = String(label).includes('+');

    return {
      label: String(label),
      bodyweightMin: previous === null ? null : kg(previous),
      bodyweightMax: isOpenEnded || next === null ? null : kg(next),
      bodyweightReference: kg(lbs[index]),
    };
  });
}

function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const norms = [];
  const csvRows = [
    [
      'id',
      'source',
      'source_url',
      'exercise_id',
      'variation_id',
      'sex',
      'bodyweight_label_lb',
      'bodyweight_reference_kg',
      'bodyweight_min_kg',
      'bodyweight_max_kg',
      'level',
      'metric',
      'value_kg',
      'source_value_lb',
      'notes',
    ],
  ];

  for (const table of source.tables) {
    const bands = bodyweightBands(table.bodyweights);

    table.rows.forEach((row, rowIndex) => {
      const band = bands[rowIndex];

      row.forEach((valueLb, levelIndex) => {
        const level = source.levels[levelIndex];
        const id = [
          'legion',
          table.sex,
          table.exerciseId,
          band.label.replace('+', 'plus'),
          level,
        ].join('-');
        const notes = [
          `Original Legion chart lift name: ${table.lift}.`,
          `Source row bodyweight: ${band.label} lb.`,
          `Converted from ${valueLb} lb to ${kg(valueLb)} kg.`,
        ].join(' ');

        norms.push({
          id,
          source: source.source,
          sourceUrl: source.sourceUrl,
          exerciseId: table.exerciseId,
          variationId: table.variationId,
          sex: table.sex,
          bodyweightMin: band.bodyweightMin,
          bodyweightMax: band.bodyweightMax,
          bodyweightReference: band.bodyweightReference,
          level,
          metric: 'absolute_e1rm',
          value: kg(valueLb),
          sourceValueLb: valueLb,
          notes,
        });

        csvRows.push([
          id,
          source.source,
          source.sourceUrl,
          table.exerciseId,
          table.variationId,
          table.sex,
          band.label,
          band.bodyweightReference,
          band.bodyweightMin ?? '',
          band.bodyweightMax ?? '',
          level,
          'absolute_e1rm',
          kg(valueLb),
          valueLb,
          notes,
        ]);
      });
    });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        source: source.source,
        sourceUrl: source.sourceUrl,
        generatedAt: new Date().toISOString(),
        unit: 'kg',
        notes: 'Generated from Legion Athletics lb chart images. Thresholds are stored as kg absolute e1RM by sex and bodyweight band.',
        norms,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(csvPath, csvRows.map((row) => row.map(csvEscape).join(',')).join('\n'));

  console.log(JSON.stringify({ norms: norms.length, outputPath, csvPath }, null, 2));
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

main();
