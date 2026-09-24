// नमुना ५ - दैनिक रोकड वही. प्रत्येक जमा/खर्च व्यवहार इथे नोंदतो; नमुना ६
// (वर्गीकृत नोंदवही) हा याच नोंदींवरून काढलेला रिपोर्ट आहे (पहा
// reports.routes.js), वेगळा साठा नाही.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const PAYMENT_MODES = ['रोख', 'धनादेश'];
const ENTRY_TYPES = ['जमा', 'खर्च'];
const REGISTERS = ['मुख्य', 'किरकोळ'];

router.get('/', async (req, res) => {
  const { financialYearId, from, to, entryType, register } = req.query;
  const where = [];
  const params = [];
  if (financialYearId) { where.push('c.financial_year_id = ?'); params.push(financialYearId); }
  if (from) { where.push('c.entry_date >= ?'); params.push(from); }
  if (to) { where.push('c.entry_date <= ?'); params.push(to); }
  if (entryType) { where.push('c.entry_type = ?'); params.push(entryType); }
  // register न दिल्यास डीफॉल्ट 'मुख्य' (नमुना ५) - किरकोळ रोकडवही (नमुना १८)
  // पाहण्यासाठी register=किरकोळ स्पष्ट पाठवावा लागतो, आपोआप मिसळत नाही.
  where.push('c.register = ?'); params.push(REGISTERS.includes(register) ? register : 'मुख्य');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT c.*, lh.code AS head_code, lh.name AS head_name
     FROM cash_book_entries c
     JOIN ledger_heads lh ON lh.id = c.ledger_head_id
     ${whereSql}
     ORDER BY c.entry_date, c.id`,
    params
  );
  res.json(rows);
});

router.post('/', requirePermission('cash_book', 'add'), async (req, res) => {
  const {
    financial_year_id, entry_date, ledger_head_id, entry_type, amount, register,
    payment_mode, reference_no, reference_date, bank_deposit_date, narration,
  } = req.body || {};

  if (!financial_year_id || !entry_date || !ledger_head_id || !entry_type || !amount) {
    return res.status(400).json({ error: 'वर्ष, दिनांक, लेखाशीर्ष, प्रकार व रक्कम आवश्यक आहेत' });
  }
  if (!ENTRY_TYPES.includes(entry_type)) return res.status(400).json({ error: "entry_type 'जमा' किंवा 'खर्च' असावा" });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'रक्कम शून्यापेक्षा जास्त हवी' });
  const mode = PAYMENT_MODES.includes(payment_mode) ? payment_mode : 'रोख';
  const reg = REGISTERS.includes(register) ? register : 'मुख्य';

  const [[head]] = await pool.query('SELECT id, group_type, is_leaf FROM ledger_heads WHERE id = ?', [ledger_head_id]);
  if (!head) return res.status(404).json({ error: 'लेखाशीर्ष सापडले नाही' });
  if (!head.is_leaf) return res.status(400).json({ error: 'फक्त शेवटच्या (leaf) लेखाशीर्षावरच नोंद करता येते' });
  if (head.group_type !== entry_type) return res.status(400).json({ error: 'निवडलेले लेखाशीर्ष या प्रकाराशी (जमा/खर्च) जुळत नाही' });

  const [result] = await pool.query(
    `INSERT INTO cash_book_entries
       (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode,
        reference_no, reference_date, bank_deposit_date, narration, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [financial_year_id, entry_date, ledger_head_id, entry_type, reg, amt, mode,
      reference_no || null, reference_date || null, bank_deposit_date || null, narration || null, req.user.id]
  );
  const [[row]] = await pool.query(
    `SELECT c.*, lh.code AS head_code, lh.name AS head_name
     FROM cash_book_entries c JOIN ledger_heads lh ON lh.id = c.ledger_head_id WHERE c.id = ?`,
    [result.insertId]
  );
  res.status(201).json(row);
});

// नमुना ७ (सामान्य पावती) व नमुना १२ (आकस्मिक खर्चाचे प्रमाणक) वेगळ्या
// नोंदवह्या नाहीत - त्याच cash_book_entries नोंदीचे कागदी-नमुन्यातील प्रिंट
// स्वरूप आहेत (जमा नोंदीसाठी पावती, खर्च नोंदीसाठी प्रमाणक), म्हणून इथेच
// त्याच ओळीचे तपशील परत करतो - रक्कम/तारीख/लेखाशीर्ष दुसऱ्यांदा टाईप करायची
// गरज नाही.
router.get('/:id/receipt', async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT c.*, lh.code AS head_code, lh.name AS head_name
     FROM cash_book_entries c JOIN ledger_heads lh ON lh.id = c.ledger_head_id WHERE c.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'नोंद सापडली नाही' });
  if (row.entry_type !== 'जमा') return res.status(400).json({ error: 'पावती (नमुना ७) फक्त जमा नोंदीसाठी छापता येते' });
  res.json(row);
});

router.get('/:id/voucher', async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT c.*, lh.code AS head_code, lh.name AS head_name
     FROM cash_book_entries c JOIN ledger_heads lh ON lh.id = c.ledger_head_id WHERE c.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'नोंद सापडली नाही' });
  if (row.entry_type !== 'खर्च') return res.status(400).json({ error: 'प्रमाणक (नमुना १२) फक्त खर्च नोंदीसाठी छापता येते' });
  res.json(row);
});

// नमुना ३२ (रकमेच्या परताव्यासाठीचा आदेश) - हाही वेगळी नोंदवही नाही,
// अस्तित्वात असलेल्या खर्च नोंदीचाच (उदा. नमुना १७ च्या अनामत-परतफेडीतून
// आलेली नोंद, किंवा इतर कोणतीही परतावा खर्च नोंद) परतावा-आदेश-पत्राच्या
// स्वरूपातील प्रिंट. नमुना १२ (प्रमाणक) पेक्षा वेगळा मायना (पत्र स्वरूप),
// पण डेटा तोच - दुसऱ्यांदा टाईप करायची गरज नाही.
router.get('/:id/refund', async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT c.*, lh.code AS head_code, lh.name AS head_name
     FROM cash_book_entries c JOIN ledger_heads lh ON lh.id = c.ledger_head_id WHERE c.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'नोंद सापडली नाही' });
  if (row.entry_type !== 'खर्च') return res.status(400).json({ error: 'परतावा आदेश (नमुना ३२) फक्त खर्च नोंदीसाठी छापता येते' });
  res.json(row);
});

router.delete('/:id', requirePermission('cash_book', 'delete'), async (req, res) => {
  const [[row]] = await pool.query('SELECT tax_payment_id FROM cash_book_entries WHERE id = ?', [req.params.id]);
  if (row && row.tax_payment_id) return res.status(400).json({ error: 'ही नोंद कर जमा पावतीवरून आपोआप आली आहे - कर जमा भरणे स्क्रीनवरून पावती मिटवा' });
  const [result] = await pool.query('DELETE FROM cash_book_entries WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
