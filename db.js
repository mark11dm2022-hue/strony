// Prosty, bezpieczny magazyn danych w plikach JSON (bez natywnych zaleznosci).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function fileFor(name) {
  return path.join(DATA_DIR, name + '.json');
}

function readAll(name) {
  const f = fileFor(name);
  if (!fs.existsSync(f)) return [];
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8')) || [];
  } catch (e) {
    return [];
  }
}

function writeAll(name, rows) {
  fs.writeFileSync(fileFor(name), JSON.stringify(rows, null, 2));
}

function insert(name, row) {
  const rows = readAll(name);
  rows.push(row);
  writeAll(name, rows);
  return row;
}

function update(name, id, patch) {
  const rows = readAll(name);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  rows[i] = Object.assign({}, rows[i], patch);
  writeAll(name, rows);
  return rows[i];
}

function find(name, predicate) {
  return readAll(name).find(predicate) || null;
}

function remove(name, id) {
  const rows = readAll(name).filter((r) => r.id !== id);
  writeAll(name, rows);
}

module.exports = { readAll, writeAll, insert, update, find, remove };
