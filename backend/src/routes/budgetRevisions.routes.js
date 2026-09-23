// नमुना २ - पुनर्विनियोजन विवरणपत्र. कागदी नमुना फक्त मुख्य गट स्तरावर
// (parent_id IS NULL) मंजूर अर्थसंकल्प वि. सुधारित अंदाज दाखवतो, प्रत्येक
// उप-शीर्षासाठी नाही (नमुना १ प्रमाणे leaf-स्तर नाही). मंजूर अर्थसंकल्प हा
// त्या गटाखालील सर्व leaf शीर्षांच्या budget_entries.approved_amount ची
// बेरीज आहे; सुधारित अंदाज गट-स्तरावरच budget_revisions मध्ये साठवला जातो.
const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { financialYearId } = req.query;
  if (!financialYearId) return res.status(400).json({ error: 'financialYearId is required' });

  const [heads] = await pool.query(
    'SELECT id, code, group_type, parent_id, name, sort_order, is_leaf FROM ledger_heads ORDER BY group_type, sort_order'
  );
  const childrenOf = new Map();
  for (const h of heads) {
    if (h.parent_id != null) {
      if (!childrenOf.has(h.parent_id)) childrenOf.set(h.parent_id, []);
      childrenOf.get(h.parent_id).push(h);
    }
  }
  const byId = new Map(heads.map((h) => [h.id, h]));
  function leafDescendantIds(headId) {
    const head = byId.get(headId);
    if (head.is_leaf) return [headId];
    return (childrenOf.get(headId) || []).flatMap((k) => leafDescendantIds(k.id));
  }

  const [budgetRows] = await pool.query(
    'SELECT ledger_head_id, approved_amount FROM budget_entries WHERE financial_year_id = ?',
    [financialYearId]
  );
  const approvedByLeaf = new Map(budgetRows.map((r) => [r.ledger_head_id, Number(r.approved_amount)]));

  const [revisionRows] = await pool.query(
    'SELECT ledger_head_id, revised_amount FROM budget_revisions WHERE financial_year_id = ?',
    [financialYearId]
  );
  const revisedByHead = new Map(revisionRows.map((r) => [r.ledger_head_id, Number(r.revised_amount)]));

  const topLevel = heads.filter((h) => h.parent_id === null);
  const result = topLevel.map((h) => {
    const approvedTotal = leafDescendantIds(h.id).reduce((s, id) => s + (approvedByLeaf.get(id) || 0), 0);
    return {
      id: h.id,
      code: h.code,
      group_type: h.group_type,
      name: h.name,
      sort_order: h.sort_order,
      approved_amount: approvedTotal,
      revised_amount: revisedByHead.get(h.id) ?? 0,
    };
  });

  res.json(result);
});

router.put('/', requirePermission('budget_revisions', 'edit'), async (req, res) => {
  const { financial_year_id, entries } = req.body || {};
  if (!financial_year_id || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'financial_year_id व entries (यादी) आवश्यक आहेत' });
  }

  const [topLevel] = await pool.query('SELECT id FROM ledger_heads WHERE parent_id IS NULL');
  const validIds = new Set(topLevel.map((h) => h.id));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      const headId = Number(e.ledger_head_id);
      if (!validIds.has(headId)) continue;
      await conn.query(
        `INSERT INTO budget_revisions (financial_year_id, ledger_head_id, revised_amount)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE revised_amount = VALUES(revised_amount)`,
        [financial_year_id, headId, Number(e.revised_amount) || 0]
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

module.exports = router;
