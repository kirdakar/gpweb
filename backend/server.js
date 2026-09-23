require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

const app = express();
app.use(cors());
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
