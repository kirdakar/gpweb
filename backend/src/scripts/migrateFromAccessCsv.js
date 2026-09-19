// One-time data migration: reads the CSVs exported from the legacy Access
// database (backend/data/migration/*.csv - see README for how to
// (re)generate them) and loads them into the new year-wise MySQL schema.
//
// Mapping:
//   GP_PARTICULAR_MASTER  -> particular_master
//   gpmaster + anandoldNew -> property_master (surrogate PK; see schema.sql
//                             for why `code` isn't used as the primary key)
//   anandoldNew O-prefixed columns -> property_tax_assessment, year 2023-2024
//   anandoldNew plain columns      -> property_tax_assessment, year 2025-2026
//
// Usage: node src/scripts/migrateFromAccessCsv.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATION_DIR = path.join(__dirname, '..', '..', 'data', 'migration');

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj = {};
    header.forEach((h, i) => { obj[h] = cells[i] === undefined ? '' : cells[i]; });
    return obj;
  });
  return rows;
}

function num(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function intOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function main() {
  const particularRows = parseCsvFile(path.join(MIGRATION_DIR, 'GP_PARTICULAR_MASTER.csv'));
  const gpmasterRows = parseCsvFile(path.join(MIGRATION_DIR, 'gpmaster.csv'));
  const anandRows = parseCsvFile(path.join(MIGRATION_DIR, 'anandoldNew.csv'));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ---- particular_master -------------------------------------------------
    let validParCodes = new Set();
    for (const r of particularRows) {
      const parCode = intOrNull(r.par_code);
      if (parCode === null) continue;
      validParCodes.add(parCode);
      await conn.query(
        `INSERT INTO particular_master
           (par_code, par_name, gharpatti_rate, jamin_rate, divabatti_rate, arogya_rate, panipatti_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           par_name=VALUES(par_name), gharpatti_rate=VALUES(gharpatti_rate),
           jamin_rate=VALUES(jamin_rate), divabatti_rate=VALUES(divabatti_rate),
           arogya_rate=VALUES(arogya_rate), panipatti_rate=VALUES(panipatti_rate)`,
        [parCode, strOrNull(r.par_name) || '', num(r.garphati_rate), num(r.MJAMIN), num(r.MDIVABATI), num(r.MAROGYA), num(r.MPNINAPTI)]
      );
    }
    console.log(`particular_master: upserted ${particularRows.length} rows`);

    // ---- financial year ids --------------------------------------------------
    const [[fy2324]] = await conn.query('SELECT id FROM financial_years WHERE year_label = ?', ['2023-2024']);
    const [[fy2526]] = await conn.query('SELECT id FROM financial_years WHERE year_label = ?', ['2025-2026']);
    if (!fy2324 || !fy2526) {
      throw new Error('Financial years 2023-2024 / 2025-2026 not found. Run "npm run migrate:schema" first.');
    }

    const ctype = (t) => (validParCodes.has(intOrNull(t)) ? intOrNull(t) : null);

    // ---- property_master + property_tax_assessment from anandoldNew ---------
    let propertyCount = 0;
    let assessmentCount = 0;
    const anandCodes = new Set();

    for (const r of anandRows) {
      anandCodes.add(strOrNull(r.code));

      const govRaw = intOrNull(r.gov_yes_no) || 0;
      const [propResult] = await conn.query(
        `INSERT INTO property_master
           (property_code, srno, malmata_no, particulars, construction_type, owner_name, bhogvatdar, milkat_year, is_government, narration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          intOrNull(r.code), intOrNull(r.SRNO), strOrNull(r.MALMATA_NO), strOrNull(r.PARTICULARS),
          ctype(r.T), strOrNull(r.OWNER_NAME), strOrNull(r.BHOGVATDAR), strOrNull(r.MILKAT_YEAR),
          govRaw === 1 ? 1 : 0, strOrNull(r.narr),
        ]
      );
      const propertyId = propResult.insertId;
      propertyCount++;

      // Year 2023-2024: only the O-prefixed totals were retained in the source table.
      const oldTotal = num(r.OGAHARPATI) + num(r.ODIVABATI) + num(r.OAROGYA) + num(r.OPNINAPTI);
      if (oldTotal !== 0 || num(r.OTOTAL) !== 0) {
        await conn.query(
          `INSERT INTO property_tax_assessment
             (property_id, financial_year_id, gharpatti, divabatti, arogya, panipatti, total_tax, gov_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [propertyId, fy2324.id, num(r.OGAHARPATI), num(r.ODIVABATI), num(r.OAROGYA), num(r.OPNINAPTI), num(r.OTOTAL), govRaw]
        );
        assessmentCount++;
      }

      // Year 2025-2026: full breakdown available.
      // NOTE: the source table's "JAMIN" column is always blank; the rate
      // actually used in Form3.vb's calculation (RJAMIN, seeded from
      // GP_PARTICULAR_MASTER.MJAMIN) was stored in the "BANDKAM" column
      // instead (verified: C_M * BANDKAM * GASARA_RATE * BHARANK ==
      // BHANDVALIMULA_RS for sampled rows). Mapped accordingly here.
      await conn.query(
        `INSERT INTO property_tax_assessment
           (property_id, financial_year_id, new_length, new_width, area_sqft, area_sqm,
            jamin_rate_used, gasara_rate, bharank, bhandvalimula_rs, karacha_rate,
            gharpatti, divabatti, arogya, panipatti, total_tax, gov_status, narration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyId, fy2526.id, num(r.NEWL), num(r.NEWW), num(r.C_F), num(r.C_M),
          num(r.BANDKAM), num(r.GASARA_RATE), num(r.BHARANK), num(r.BHANDVALIMULA_RS), num(r.KARACHA_RATE),
          num(r.GAHARPATI), num(r.DIVABATI), num(r.AROGYA), num(r.PNINAPTI), num(r.TOTAL), govRaw, strOrNull(r.narr),
        ]
      );
      assessmentCount++;
    }
    console.log(`property_master: inserted ${propertyCount} rows from anandoldNew`);
    console.log(`property_tax_assessment: inserted ${assessmentCount} rows`);

    // ---- gpmaster-only orphans (codes never present in anandoldNew) ---------
    let orphanCount = 0;
    for (const r of gpmasterRows) {
      const code = strOrNull(r.code);
      if (code !== null && anandCodes.has(code)) continue; // already represented via anandoldNew
      await conn.query(
        `INSERT INTO property_master
           (property_code, srno, malmata_no, particulars, construction_type, owner_name, bhogvatdar, milkat_year)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          intOrNull(r.code), intOrNull(r.SRNO), strOrNull(r.MALMATA_NO), strOrNull(r.PARTICULARS),
          ctype(r.T), strOrNull(r.OWNER_NAME), strOrNull(r.BHOGVATDAR), strOrNull(r.MILKAT_YEAR),
        ]
      );
      orphanCount++;
    }
    console.log(`property_master: inserted ${orphanCount} additional rows from gpmaster (no anandoldNew match, no tax data yet)`);

    await conn.commit();
    console.log('Migration committed successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
