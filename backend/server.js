const path = require('path');
const fs = require('fs');
const { getBaseDir } = require('./src/utils/baseDir');
const baseDir = getBaseDir(); // dev मध्ये backend/ रूट; पॅकेज केलेल्या .exe मध्ये .exe चा स्वतःचा फोल्डर
require('dotenv').config({ path: path.join(baseDir, '.env') });

// पॅकेज केलेल्या (.exe) वितरणात एकदाच `gpweb-backend.exe --migrate` चालवून डेटाबेस
// तयार करतात (टेबल्स + सुरुवातीची वर्षे + admin युजर), मग एक्झिट होते - सर्व्हर सुरू होत नाही.
// (dev मध्ये नेहमीप्रमाणे `npm run migrate:schema` वापरा, हे फक्त पॅकेज केलेल्या exe साठी.)
if (process.argv.includes('--migrate')) {
  require('./src/scripts/applySchema').main()
    .then(() => process.exit(0))
    .catch((err) => { console.error('Schema setup failed:', err); process.exit(1); });
  return;
}

const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('express-async-errors'); // lets async route handlers throw straight into the error middleware below

const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const yearsRoutes = require('./src/routes/years.routes');
const particularsRoutes = require('./src/routes/particulars.routes');
const gpmasterRoutes = require('./src/routes/gpmaster.routes');
const propertiesRoutes = require('./src/routes/properties.routes');
const assessmentsRoutes = require('./src/routes/assessments.routes');
const paymentsRoutes = require('./src/routes/payments.routes');
const reportsRoutes = require('./src/routes/reports.routes');
const settingsRoutes = require('./src/routes/settings.routes');
const maintenanceRoutes = require('./src/routes/maintenance.routes');
const ledgerHeadsRoutes = require('./src/routes/ledgerHeads.routes');
const cashBookRoutes = require('./src/routes/cashBook.routes');
const assetsLiabilitiesRoutes = require('./src/routes/assetsLiabilities.routes');
const budgetEntriesRoutes = require('./src/routes/budgetEntries.routes');
const budgetRevisionsRoutes = require('./src/routes/budgetRevisions.routes');
const fixedAssetsRoutes = require('./src/routes/fixedAssets.routes');
const staffRoutes = require('./src/routes/staff.routes');
const staffSalaryBillsRoutes = require('./src/routes/staffSalaryBills.routes');
const advanceDepositsRoutes = require('./src/routes/advanceDeposits.routes');
const investmentsRoutes = require('./src/routes/investments.routes');
const loansRoutes = require('./src/routes/loans.routes');
const travelBillsRoutes = require('./src/routes/travelBills.routes');
const auditReportsRoutes = require('./src/routes/auditReports.routes');
const balanceStatementsRoutes = require('./src/routes/balanceStatements.routes');
const contractorsRoutes = require('./src/routes/contractors.routes');
const rateScheduleRoutes = require('./src/routes/rateSchedule.routes');
const worksRoutes = require('./src/routes/works.routes');
const musterRoutes = require('./src/routes/muster.routes');
const miscDemandsRoutes = require('./src/routes/miscDemands.routes');
const stampsRoutes = require('./src/routes/stamps.routes');
const stockRoutes = require('./src/routes/stock.routes');
const treesRoutes = require('./src/routes/trees.routes');
const taxAdjustmentsRoutes = require('./src/routes/taxAdjustments.routes');
const latlongRoutes = require('./src/routes/latlong.routes');
const paymentQrRoutes = require('./src/routes/paymentQr.routes');
const taxDemandBillsRoutes = require('./src/routes/taxDemandBills.routes');

const app = express();
app.use(cors());
// gpmaster/मिळकत यादी सारखे मोठे JSON प्रतिसाद (शेकडो KB) दाबून पाठवतो -
// संथ इंटरनेट/Cloudflare Tunnel वरून वापरताना पानांचा वेग लक्षणीय वाढतो.
app.use(compression());
// QR चित्र अपलोड (base64) मोठे असू शकते - या एकाच मार्गासाठी वेगळी (मोठी) JSON मर्यादा, आधी (सामान्य 100KB मर्यादेच्या) नोंदवली.
app.use('/api/payment-qr', express.json({ limit: '4mb' }), paymentQrRoutes);
app.use(express.json());
// All data here is live tax/assessment data (and changes during active
// development too) - never let the browser cache API GET responses.
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/years', yearsRoutes);
app.use('/api/particulars', particularsRoutes);
app.use('/api/gpmaster', gpmasterRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/assessments', assessmentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/ledger-heads', ledgerHeadsRoutes);
app.use('/api/cash-book', cashBookRoutes);
app.use('/api/assets-liabilities', assetsLiabilitiesRoutes);
app.use('/api/budget-entries', budgetEntriesRoutes);
app.use('/api/budget-revisions', budgetRevisionsRoutes);
app.use('/api/fixed-assets', fixedAssetsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/staff-salary-bills', staffSalaryBillsRoutes);
app.use('/api/advance-deposits', advanceDepositsRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/travel-bills', travelBillsRoutes);
app.use('/api/audit-reports', auditReportsRoutes);
app.use('/api/balance-statements', balanceStatementsRoutes);
app.use('/api/contractors', contractorsRoutes);
app.use('/api/rate-schedule', rateScheduleRoutes);
app.use('/api/works', worksRoutes);
app.use('/api/muster-rolls', musterRoutes);
app.use('/api/misc-demands', miscDemandsRoutes);
app.use('/api/stamps', stampsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/trees', treesRoutes);
app.use('/api/tax-adjustments', taxAdjustmentsRoutes);
app.use('/api/latlong', latlongRoutes);
app.use('/api/tax-demand-bills', taxDemandBillsRoutes);

// पॅकेज केलेल्या (.exe) वितरणात .exe शेजारी 'public' फोल्डर (frontend build) असेल तर
// Node स्वतःच तो सर्व्ह करतो - वेगळा Apache/XAMPP htdocs/reverse-proxy लागत नाही
// (पार्टीच्या मशिनवर सोर्स कोडशिवाय एकाच .exe ने चालणाऱ्या सर्व्हरसाठी). XAMPP वापरणाऱ्या
// सध्याच्या dev/deploy सेटअपमध्ये हा फोल्डर नसतो, त्यामुळे तिथे काहीही बदलत नाही.
const publicDir = path.join(baseDir, 'public');
if (fs.existsSync(publicDir)) {
  // ब्राउझर कायम जुनेच पान दाखवत राहू नये (नवीन .exe टाकूनही जुनाच कोड दिसणे) म्हणून
  // index.html कधीही cache होऊ देत नाही; assets/index-XXXX.js/css चे नाव प्रत्येक build ला
  // बदलते (content hash), त्यामुळे त्या कायमस्वरूपी cache करणे सुरक्षित व वेगवान आहे.
  app.use(express.static(publicDir, {
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', filePath.endsWith('.html') ? 'no-store, no-cache, must-revalidate' : 'public, max-age=31536000, immutable');
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Central error handler - keeps route handlers free of try/catch boilerplate
// for unexpected DB errors (express-async-errors-style wrapping below).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`gpweb backend listening on http://localhost:${PORT}`);
});
