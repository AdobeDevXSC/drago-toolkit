/**
 * Build AEM Forms sheet JSON from a CSV field definition file.
 * Mimics the Sidekick sheet → .json conversion for local development.
 *
 * Usage:
 *   node scripts/build-form-json.mjs [input.csv] [output.json]
 *   node scripts/build-form-json.mjs --watch [input.csv] [output.json]
 */
import { readFileSync, writeFileSync, watch } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const watchMode = args[0] === '--watch';
const inputArg = watchMode ? args[1] : args[0];
const outputArg = watchMode ? args[2] : args[1];

const inputPath = join(root, inputArg || 'intake/contact-form/shared-aem.csv');
const outputPath = join(root, outputArg || 'intake/contact-form.json');

const FIELD_KEYS = [
  'type',
  'field',
  'label',
  'required',
  'default',
  'placeholder',
  'options',
  'help',
  'conditional',
  'section',
  'notes',
  'parent',
];

/**
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * @param {string} csvText
 * @returns {Object[]}
 */
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

/**
 * @param {Object} row
 * @returns {Object}
 */
function rowToField(row) {
  const field = {};
  FIELD_KEYS.forEach((key) => {
    const value = row[key];
    if (value === undefined || value === null || value === '') return;
    if (key === 'options') {
      field[key] = value.replace(/\s*\|\s*/g, ',');
    } else {
      field[key] = value;
    }
  });
  return field;
}

/**
 * @param {string} csvPath
 * @returns {Object}
 */
function buildFormJson(csvPath) {
  const csvText = readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvText);
  const data = rows.map(rowToField).filter((field) => field.type);
  const sheetname = basename(csvPath, '.csv');

  return {
    total: data.length,
    offset: 0,
    limit: data.length,
    data,
    ':colWidths': [80, 120, 180, 80, 80, 140, 200, 200, 180, 120, 140, 140, 140],
    ':sheetname': sheetname,
    ':type': 'sheet',
  };
}

/**
 * @param {string} csvPath
 * @param {string} jsonPath
 */
function writeFormJson(csvPath, jsonPath) {
  const payload = buildFormJson(csvPath);
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${jsonPath} (${payload.data.length} fields) from ${csvPath}`);
}

if (watchMode) {
  writeFormJson(inputPath, outputPath);
  watch(inputPath, { persistent: true }, () => {
    try {
      writeFormJson(inputPath, outputPath);
    } catch (error) {
      console.error(error);
    }
  });
  console.log(`Watching ${inputPath}…`);
} else {
  writeFormJson(inputPath, outputPath);
}
