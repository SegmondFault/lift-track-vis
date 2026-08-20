const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'data', 'strength-norm.extra.seed.json');
const lbToKg = (value) => Math.round(value * 0.45359237 * 10) / 10;
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const levels = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];
const source = 'Strength Level strength standards';
const generatedAt = new Date().toISOString();

const datasets = [
  {
    exerciseId: 'bench-press',
    variationId: 'bench-press__standard',
    sourceLiftName: 'Bench Press',
    sourceUrl: 'https://strengthlevel.com/strength-standards/bench-press',
    unitModel: 'absolute_e1rm',
    notes: 'Strength Level lists one-rep-max standards by bodyweight. Converted from pounds to kg.',
    male: [
      [110, 53, 84, 125, 173, 226],
      [120, 63, 97, 140, 191, 247],
      [130, 73, 109, 154, 208, 266],
      [140, 83, 121, 169, 224, 285],
      [150, 93, 133, 182, 240, 302],
      [160, 102, 144, 196, 255, 319],
      [170, 112, 155, 209, 270, 336],
      [180, 121, 166, 221, 284, 352],
      [190, 130, 177, 234, 298, 367],
      [200, 139, 187, 246, 312, 382],
      [210, 148, 197, 257, 325, 397],
      [220, 156, 207, 269, 338, 411],
      [230, 165, 217, 280, 350, 425],
      [240, 173, 227, 291, 362, 438],
      [250, 181, 236, 301, 374, 451],
      [260, 190, 245, 312, 386, 464],
      [270, 197, 254, 322, 397, 476],
      [280, 205, 263, 332, 408, 488],
      [290, 213, 272, 341, 419, 500],
      [300, 220, 280, 351, 429, 511],
      [310, 228, 289, 360, 439, 523],
    ],
    female: [
      [90, 19, 40, 71, 111, 157],
      [100, 23, 46, 79, 121, 169],
      [110, 27, 52, 87, 130, 180],
      [120, 32, 58, 94, 139, 190],
      [130, 36, 63, 101, 148, 200],
      [140, 40, 69, 108, 156, 209],
      [150, 43, 74, 114, 163, 218],
      [160, 47, 79, 120, 170, 227],
      [170, 51, 83, 126, 177, 235],
      [180, 55, 88, 132, 184, 242],
      [190, 58, 93, 137, 191, 250],
      [200, 62, 97, 143, 197, 257],
      [210, 65, 101, 148, 203, 264],
      [220, 68, 105, 153, 209, 270],
      [230, 72, 109, 157, 214, 277],
      [240, 75, 113, 162, 220, 283],
      [250, 78, 117, 167, 225, 289],
      [260, 81, 121, 171, 230, 295],
    ],
  },
  {
    exerciseId: 'incline-bench-press',
    variationId: 'incline-bench-press__standard',
    sourceLiftName: 'Incline Bench Press',
    sourceUrl: 'https://strengthlevel.com/strength-standards/incline-bench-press',
    unitModel: 'absolute_e1rm',
    notes: 'Strength Level lists one-rep-max standards by bodyweight. Converted from pounds to kg.',
    male: [
      [110, 62, 83, 110, 141, 175],
      [120, 70, 94, 123, 155, 190],
      [130, 78, 104, 136, 169, 204],
      [140, 86, 114, 148, 182, 219],
      [150, 93, 124, 159, 195, 233],
      [160, 101, 133, 170, 207, 247],
      [170, 108, 143, 181, 219, 260],
      [180, 116, 152, 191, 231, 274],
      [190, 124, 162, 202, 243, 287],
      [200, 131, 172, 212, 255, 300],
      [210, 139, 182, 223, 267, 313],
      [220, 146, 191, 233, 279, 326],
      [230, 154, 201, 243, 290, 339],
      [240, 161, 210, 254, 302, 351],
      [250, 168, 219, 264, 313, 364],
      [260, 175, 228, 274, 325, 376],
      [270, 182, 237, 284, 336, 389],
      [280, 190, 247, 294, 347, 401],
      [290, 197, 256, 304, 358, 413],
      [300, 204, 265, 314, 369, 425],
      [310, 211, 274, 323, 380, 437],
    ],
    female: [
      [90, 27, 40, 56, 76, 98],
      [100, 31, 46, 63, 84, 107],
      [110, 36, 51, 70, 91, 115],
      [120, 40, 57, 76, 98, 123],
      [130, 44, 62, 82, 105, 131],
      [140, 48, 68, 89, 113, 139],
      [150, 53, 73, 95, 120, 146],
      [160, 57, 78, 101, 127, 154],
      [170, 61, 84, 107, 133, 162],
      [180, 65, 89, 113, 140, 169],
      [190, 69, 94, 119, 146, 176],
      [200, 73, 99, 125, 153, 184],
      [210, 77, 104, 131, 159, 191],
      [220, 81, 109, 136, 166, 198],
      [230, 85, 114, 142, 172, 205],
      [240, 89, 119, 148, 178, 212],
      [250, 93, 123, 153, 184, 219],
      [260, 97, 128, 159, 190, 226],
    ],
  },
  {
    exerciseId: 'pull-up',
    variationId: 'pull-up__standard',
    sourceLiftName: 'Pull Ups',
    sourceUrl: 'https://strengthlevel.com/strength-standards/pull-ups',
    unitModel: 'added_weight_to_total_system_e1rm',
    notes:
      'Strength Level lists added or assisted one-rep-max pull-up weight by bodyweight. Converted to total-system e1RM as bodyweight plus added weight, then converted from pounds to kg.',
    male: [
      [110, -17, 11, 46, 84, 126],
      [120, -18, 12, 49, 89, 132],
      [130, -18, 14, 52, 94, 138],
      [140, -18, 15, 55, 99, 143],
      [150, -18, 17, 58, 103, 149],
      [160, -18, 19, 62, 108, 154],
      [170, -18, 20, 65, 112, 159],
      [180, -18, 22, 68, 117, 164],
      [190, -18, 24, 71, 121, 169],
      [200, -18, 26, 74, 126, 174],
      [210, -18, 28, 81, 140, 201],
      [220, -18, 30, 84, 144, 206],
      [230, -18, 32, 87, 148, 211],
      [240, -18, 34, 90, 152, 216],
      [250, -18, 36, 93, 156, 221],
      [260, -18, 38, 96, 160, 225],
      [270, -17, 40, 99, 164, 230],
      [280, -17, 41, 102, 168, 235],
      [290, -17, 43, 105, 172, 239],
      [300, -17, 45, 108, 176, 244],
      [310, -17, 47, 111, 180, 248],
    ],
    female: [
      [90, -40, -22, 1, 25, 52],
      [100, -42, -23, 2, 27, 55],
      [110, -43, -24, 3, 29, 57],
      [120, -45, -25, 4, 31, 60],
      [130, -46, -26, 5, 32, 63],
      [140, -47, -26, 6, 34, 65],
      [150, -48, -27, 7, 36, 68],
      [160, -49, -28, 8, 37, 70],
      [170, -50, -28, 9, 39, 73],
      [180, -51, -29, 10, 40, 75],
      [190, -52, -30, 11, 42, 77],
      [200, -53, -30, 12, 43, 80],
      [210, -54, -31, 13, 45, 82],
      [220, -55, -31, 14, 46, 84],
      [230, -55, -32, 15, 48, 86],
      [240, -56, -32, 16, 49, 89],
      [250, -57, -33, 17, 51, 91],
      [260, -58, -33, 18, 52, 93],
    ],
  },
];

function bandBounds(rows, index) {
  const previous = rows[index - 1]?.[0];
  const current = rows[index][0];
  const next = rows[index + 1]?.[0];
  return {
    min: previous === undefined ? null : lbToKg((previous + current) / 2),
    max: next === undefined ? null : lbToKg((current + next) / 2),
  };
}

const norms = [];

for (const dataset of datasets) {
  for (const sex of ['male', 'female']) {
    const rows = dataset[sex];
    rows.forEach((row, rowIndex) => {
      const [bodyweightLb, ...values] = row;
      const bounds = bandBounds(rows, rowIndex);
      values.forEach((sourceValueLb, levelIndex) => {
        const level = levels[levelIndex];
        const absoluteLb = dataset.unitModel === 'added_weight_to_total_system_e1rm' ? bodyweightLb + sourceValueLb : sourceValueLb;
        norms.push({
          id: `strengthlevel-${sex}-${slug(dataset.exerciseId)}-${String(bodyweightLb).replace('+', 'plus')}-${level}`,
          source,
          sourceUrl: dataset.sourceUrl,
          exerciseId: dataset.exerciseId,
          variationId: dataset.variationId,
          sex,
          bodyweightMin: bounds.min,
          bodyweightMax: bounds.max,
          bodyweightReference: lbToKg(bodyweightLb),
          level,
          metric: 'absolute_e1rm',
          value: lbToKg(absoluteLb),
          sourceValueLb,
          notes: `${dataset.notes} Original Strength Level lift name: ${dataset.sourceLiftName}. Source row bodyweight: ${bodyweightLb} lb.`,
        });
      });
    });
  }
}

const payload = {
  schemaVersion: 1,
  source,
  sourceUrl: 'https://strengthlevel.com/strength-standards/',
  generatedAt,
  unit: 'kg',
  notes:
    'Supplemental standards for lifts not covered by the Legion seed. Pull-up standards are converted from added/assisted weight to total-system e1RM so they match the app pull-up load model.',
  norms,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ norms: norms.length, outputPath }, null, 2));
