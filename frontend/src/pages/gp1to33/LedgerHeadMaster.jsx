import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { usePermissions } from '../../context/PermissionsContext';
import CloseReportButton from '../../components/CloseReportButton';

// लेखाशीर्ष मास्टर - नमुना १ (वार्षिक अंदाजपत्रक) चा स्थिर वृक्ष, एकदाच
// backend/src/scripts/seedLedgerHeads.js ने भरलेला. इथून फक्त नाव-बदल
// करता येतो (संपूर्ण झाड बांधणे/मोडणे इथून नाही - कायद्याने ठरलेली रचना).
function buildTree(rows) {
  const byParent = new Map();
  for (const r of rows) {
    const key = r.parent_id ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(r);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);
  return byParent;
}

function TreeNode({ node, byParent, depth, editingId, editValue, setEditValue, onStartEdit, onSaveEdit, onCancelEdit, canEdit }) {
  const children = byParent.get(node.id) || [];
  const isEditing = editingId === node.id;
  return (
    <>
      <tr>
        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{node.code}</td>
        <td style={{ paddingLeft: 12 + depth * 22 }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus style={{ flex: 1, padding: 4 }} />
              <button className="btn small" type="button" onClick={() => onSaveEdit(node.id)}>जतन</button>
              <button className="btn secondary small" type="button" onClick={onCancelEdit}>रद्द</button>
            </div>
          ) : (
            <span style={{ fontWeight: node.is_leaf ? 400 : 700 }}>{node.name}</span>
          )}
        </td>
        <td>
          {!isEditing && canEdit && (
            <button className="btn secondary small" type="button" onClick={() => onStartEdit(node)}>संपादन</button>
          )}
        </td>
      </tr>
      {children.map((child) => (
        <TreeNode
          key={child.id} node={child} byParent={byParent} depth={depth + 1}
          editingId={editingId} editValue={editValue} setEditValue={setEditValue}
          onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit} canEdit={canEdit}
        />
      ))}
    </>
  );
}

export default function LedgerHeadMaster() {
  const { can } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  function load() {
    setLoading(true);
    client.get('/ledger-heads').then(({ data }) => setRows(data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const searchTerm = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    // जुळणारा leaf + त्याचे सर्व पूर्वज (ancestors) दाखवतो, म्हणजे झाडाची रचना तुटत नाही.
    const byId = new Map(rows.map((r) => [r.id, r]));
    const keep = new Set();
    for (const r of rows) {
      if (r.name.toLowerCase().includes(searchTerm) || String(r.code).toLowerCase().includes(searchTerm)) {
        let cur = r;
        while (cur) { keep.add(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : null; }
      }
    }
    return rows.filter((r) => keep.has(r.id));
  }, [rows, searchTerm]);

  const jamaTree = useMemo(() => buildTree(filteredRows.filter((r) => r.group_type === 'जमा')), [filteredRows]);
  const kharchTree = useMemo(() => buildTree(filteredRows.filter((r) => r.group_type === 'खर्च')), [filteredRows]);
  const canEdit = can('ledger_heads', 'edit');

  function startEdit(node) { setEditingId(node.id); setEditValue(node.name); }
  function cancelEdit() { setEditingId(null); setEditValue(''); }
  async function saveEdit(id) {
    if (!editValue.trim()) return;
    await client.patch(`/ledger-heads/${id}`, { name: editValue.trim() });
    cancelEdit();
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>लेखाशीर्ष मास्टर (नमुना १)</h1>
        <CloseReportButton />
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="कोड किंवा नाव टाइप करून शोधा"
            style={{ width: '100%', maxWidth: 400, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}
          />
          {search && <button className="btn secondary" type="button" onClick={() => setSearch('')}>शोध क्लिअर करा</button>}
        </div>
      </div>

      {loading ? <p>लोड होत आहे...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, color: '#1d4ed8' }}>जमा शीर्ष</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>कोड</th><th>नाव</th><th></th></tr></thead>
                <tbody>
                  {(jamaTree.get('root') || []).map((node) => (
                    <TreeNode
                      key={node.id} node={node} byParent={jamaTree} depth={0}
                      editingId={editingId} editValue={editValue} setEditValue={setEditValue}
                      onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} canEdit={canEdit}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 15, color: '#dc2626' }}>खर्च शीर्ष</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>कोड</th><th>नाव</th><th></th></tr></thead>
                <tbody>
                  {(kharchTree.get('root') || []).map((node) => (
                    <TreeNode
                      key={node.id} node={node} byParent={kharchTree} depth={0}
                      editingId={editingId} editValue={editValue} setEditValue={setEditValue}
                      onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={cancelEdit} canEdit={canEdit}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
