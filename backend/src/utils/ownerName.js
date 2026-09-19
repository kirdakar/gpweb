// 102 property_master rows in the migrated legacy data have no owner_name
// recorded at all. Rather than showing blank rows in listings/reports
// (confusing - looks like missing data, not a real property), fall back to
// showing the property's code/SRNO so every row is at least identifiable.
// NOT applied to the single-property fetch used by the edit form - there,
// a genuinely empty name should stay empty so staff can see it needs
// filling in, rather than risk "कोड 807" getting saved back as a real name.
function fallbackOwnerName(row) {
  if (row.owner_name) return row.owner_name;
  const code = row.property_code || row.srno;
  return code ? `कोड ${code}` : 'नाव नोंदलेले नाही';
}

function withOwnerNameFallback(rows) {
  return rows.map((r) => ({ ...r, owner_name: fallbackOwnerName(r) }));
}

module.exports = { fallbackOwnerName, withOwnerNameFallback };
