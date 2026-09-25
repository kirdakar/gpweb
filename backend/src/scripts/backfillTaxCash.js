// आधी नोंदलेल्या कर जमा पावत्यांची (ज्यांची रोकड वहीत नोंद नाही) रोकड वहीत जमा नोंद करतो.
// पुन्हा चालवला तरी सुरक्षित - ज्या पावतीला आधीच नोंद आहे ती वगळली जाते.
require('dotenv').config();
const pool = require('../config/db');
const paymentsRouter = require('../routes/payments.routes');
const { postTaxPaymentToCashBook } = require('../utils/taxCashPosting');

(async () => {
  // --rebuild: कर जमा पावत्यांच्या सर्व आपोआप रोकड वही ओळी मिटवून सध्याच्या सूट/दंड नियमांनुसार पुन्हा तयार करतो
  if (process.argv.includes('--rebuild')) await pool.query('DELETE FROM cash_book_entries WHERE tax_payment_id IS NOT NULL');
  const [rows] = await pool.query(
    `SELECT p.*, DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS payment_date_str, pm.property_code
     FROM tax_payments p JOIN property_master pm ON pm.id = p.property_id
     WHERE NOT EXISTS (SELECT 1 FROM cash_book_entries c WHERE c.tax_payment_id = p.id)
     ORDER BY p.id`
  );
  let done = 0;
  for (const p of rows) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const alloc = await paymentsRouter.computeReceiptAllocation(conn, p.property_code, p.financial_year_id, p.id, p.receipt_type);
      const n = await postTaxPaymentToCashBook(conn, { ...p, payment_date: p.payment_date_str }, alloc && alloc.coveredByThisReceipt, null, alloc && alloc.dues);
      await conn.commit();
      done += 1;
      console.log(`पावती #${p.id} (${p.receipt_type} ${p.receipt_no}) -> ${n} रोकड वही ओळी`);
    } catch (e) {
      await conn.rollback();
      console.error(`पावती #${p.id} अयशस्वी:`, e.message);
    } finally { conn.release(); }
  }
  console.log(`एकूण ${done}/${rows.length} पावत्या नोंदल्या`);
  process.exit(0);
})();
