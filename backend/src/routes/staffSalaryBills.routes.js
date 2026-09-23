// नमुना २१ - कर्मचाऱ्यांच्या वेतन देयकाची नोंदवही. प्रत्येक सक्रिय
// कर्मचाऱ्यासाठी (staff_master, नमुना १३) दर महिना एक देयक. एकूण/निव्वळ
// रक्कम इथेच (सर्व्हरवर) गणित करून परत पाठवली जाते, वेगळी साठवलेली नाही.
// निव्वळ रक्कम "पोस्ट करा" कृतीने रोकड वहीत (नमुना ५, लेखाशीर्ष K1.4)
// नोंदवता येते - रक्कम दुसऱ्यांदा टाईप करायची गरज नाही.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

const SALARY_LEDGER_HEAD_CODE = 'K1.4'; // कर्मचारी वेतन

function computeBill(b) {
  const gross = Number(b.basic_pay || 0) + Number(b.leave_pay || 0) + Number(b.suspension_pay || 0) + Number(b.allowances || 0);
  const afterRecovery = gross - Number(b.recovery_fine || 0);
  const totalDeductions = Number(b.pf_deduction || 0) + Number(b.other_deductions || 0);
  const net = afterRecovery - totalDeductions;
  return { grossTotal: Math.round(gross * 100) / 100, totalDeductions: Math.round(totalDeductions * 100) / 100, netPayable: Math.round(net * 100) / 100 };
}

router.get('/', async (req, res) => {
  const { financialYearId, year, month } = req.query;
  if (!financialYearId || !year || !month) {
    return res.status(400).json({ error: 'financialYearId, year आणि month आवश्यक आहेत' });
  }
  const [staffRows] = await pool.query('SELECT * FROM staff_master WHERE is_active = 1 ORDER BY post_name');
  const [billRows] = await pool.query(
    'SELECT * FROM staff_salary_bills WHERE financial_year_id = ? AND year = ? AND month = ?',
    [financialYearId, year, month]
  );
  const billByStaff = new Map(billRows.map((b) => [b.staff_id, b]));

  const result = staffRows.map((s) => {
    const bill = billByStaff.get(s.id) || {};
    const computed = computeBill(bill);
    return {
      staff_id: s.id,
      post_name: s.post_name,
      employee_name: s.employee_name,
      pay_scale: s.pay_scale,
      bill_id: bill.id || null,
      basic_pay: Number(bill.basic_pay || 0),
      leave_pay: Number(bill.leave_pay || 0),
      suspension_pay: Number(bill.suspension_pay || 0),
      allowances: Number(bill.allowances || 0),
      recovery_fine: Number(bill.recovery_fine || 0),
      pf_deduction: Number(bill.pf_deduction || 0),
      other_deductions: Number(bill.other_deductions || 0),
      cash_book_entry_id: bill.cash_book_entry_id || null,
      ...computed,
    };
  });
  res.json(result);
});

router.put('/', requirePermission('staff_salary_bills', 'edit'), async (req, res) => {
  const { financial_year_id, year, month, entries } = req.body || {};
  if (!financial_year_id || !year || !month || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'financial_year_id, year, month व entries (यादी) आवश्यक आहेत' });
  }
  const [staffRows] = await pool.query('SELECT id FROM staff_master WHERE is_active = 1');
  const validIds = new Set(staffRows.map((s) => s.id));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      const staffId = Number(e.staff_id);
      if (!validIds.has(staffId)) continue;
      await conn.query(
        `INSERT INTO staff_salary_bills
           (staff_id, financial_year_id, year, month, basic_pay, leave_pay, suspension_pay, allowances,
            recovery_fine, pf_deduction, other_deductions, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           basic_pay = VALUES(basic_pay), leave_pay = VALUES(leave_pay), suspension_pay = VALUES(suspension_pay),
           allowances = VALUES(allowances), recovery_fine = VALUES(recovery_fine), pf_deduction = VALUES(pf_deduction),
           other_deductions = VALUES(other_deductions), remark = VALUES(remark)`,
        [staffId, financial_year_id, year, month,
          Number(e.basic_pay) || 0, Number(e.leave_pay) || 0, Number(e.suspension_pay) || 0, Number(e.allowances) || 0,
          Number(e.recovery_fine) || 0, Number(e.pf_deduction) || 0, Number(e.other_deductions) || 0, e.remark || null]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// निवडलेल्या कर्मचाऱ्याचे त्या महिन्याचे निव्वळ वेतन रोकड वहीत (नमुना ५,
// register='मुख्य') एकच खर्च नोंद म्हणून नोंदवतो - आधीच पोस्ट केलेले
// असल्यास (cash_book_entry_id भरलेला) पुन्हा नोंदवू देत नाही (दुहेरी
// पोस्टिंग टाळण्यासाठी).
router.post('/:staffId/post', requirePermission('staff_salary_bills', 'edit'), async (req, res) => {
  const { financial_year_id, year, month, entry_date } = req.body || {};
  if (!financial_year_id || !year || !month) {
    return res.status(400).json({ error: 'financial_year_id, year व month आवश्यक आहेत' });
  }
  const [[bill]] = await pool.query(
    'SELECT * FROM staff_salary_bills WHERE staff_id = ? AND financial_year_id = ? AND year = ? AND month = ?',
    [req.params.staffId, financial_year_id, year, month]
  );
  if (!bill) return res.status(404).json({ error: 'या महिन्याचे देयक अद्याप भरलेले नाही' });
  if (bill.cash_book_entry_id) return res.status(400).json({ error: 'हे देयक आधीच रोकड वहीत नोंदवले आहे' });

  const { netPayable } = computeBill(bill);
  if (netPayable <= 0) return res.status(400).json({ error: 'निव्वळ रक्कम शून्य किंवा त्यापेक्षा कमी आहे' });

  const [[staff]] = await pool.query('SELECT * FROM staff_master WHERE id = ?', [req.params.staffId]);
  const [[head]] = await pool.query('SELECT id FROM ledger_heads WHERE code = ?', [SALARY_LEDGER_HEAD_CODE]);
  if (!head) return res.status(500).json({ error: `लेखाशीर्ष ${SALARY_LEDGER_HEAD_CODE} सापडले नाही` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO cash_book_entries
         (financial_year_id, entry_date, ledger_head_id, entry_type, register, amount, payment_mode, narration, created_by)
       VALUES (?, ?, ?, 'खर्च', 'मुख्य', ?, 'रोख', ?, ?)`,
      [financial_year_id, entry_date || new Date().toISOString().slice(0, 10), head.id, netPayable,
        `मासिक वेतन देयक (नमुना २१) - ${staff.employee_name || staff.post_name} - ${month}/${year}`, req.user.id]
    );
    await conn.query('UPDATE staff_salary_bills SET cash_book_entry_id = ? WHERE id = ?', [result.insertId, bill.id]);
    await conn.commit();
    res.json({ ok: true, cash_book_entry_id: result.insertId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
