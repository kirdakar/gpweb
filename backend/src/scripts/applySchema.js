// Creates the database (if needed), applies schema.sql, seeds the two
// known financial years and a default admin user.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'gpweb';

  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });

  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  console.log(`Applying schema to database "${dbName}" on ${host}:${port} ...`);
  await conn.query(schemaSql);
  console.log('Schema applied.');

  await conn.changeUser({ database: dbName });

  // Seed the two known financial years from the legacy anandoldnew table.
  const years = [
    { label: '2023-2024', active: 0 },
    { label: '2025-2026', active: 1 },
  ];
  for (const y of years) {
    await conn.query(
      'INSERT INTO financial_years (year_label, is_active) VALUES (?, ?) ON DUPLICATE KEY UPDATE year_label = year_label',
      [y.label, y.active]
    );
  }
  console.log('Financial years seeded (2023-2024, 2025-2026).');

  // Seed default admin user if users table is empty.
  const [rows] = await conn.query('SELECT COUNT(*) AS cnt FROM users');
  if (rows[0].cnt === 0) {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 10);
    await conn.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [adminUser, hash, 'Administrator', 'admin']
    );
    console.log(`Default admin user created: username="${adminUser}" password="${adminPass}" (change this!)`);
  } else {
    console.log('Users table already has data, skipping default admin creation.');
  }

  await conn.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Schema setup failed:', err);
  process.exit(1);
});
