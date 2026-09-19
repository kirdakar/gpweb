// Truncates the migrated data tables (keeps users/financial_years/particular_master)
// so migrateFromAccessCsv.js can be re-run cleanly during development.
require('dotenv').config();
const pool = require('../config/db');

async function main() {
  await pool.query('SET FOREIGN_KEY_CHECKS=0');
  await pool.query('TRUNCATE TABLE property_tax_assessment');
  await pool.query('TRUNCATE TABLE property_master');
  await pool.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('property_master and property_tax_assessment truncated.');
  await pool.end();
}
main();
