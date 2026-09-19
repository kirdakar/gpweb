import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { YearProvider } from './context/YearContext';
import { PermissionsProvider } from './context/PermissionsContext';
import ProtectedRoute from './components/ProtectedRoute';
import RequireView from './components/RequireView';
import RequireAdmin from './components/RequireAdmin';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Particulars from './pages/Particulars';
import GpMaster from './pages/GpMaster';
import Years from './pages/Years';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import PaymentEntry from './pages/PaymentEntry';
import PropertyListReport from './pages/reports/PropertyListReport';
import OldNewComparisonReport from './pages/reports/OldNewComparisonReport';
import SummaryReport from './pages/reports/SummaryReport';
import TaxDemandReport from './pages/reports/TaxDemandReport';
import PaymentReceiptsReport from './pages/reports/PaymentReceiptsReport';
import AssessmentRegisterReport from './pages/reports/AssessmentRegisterReport';
import TaxDemandBillReport from './pages/reports/TaxDemandBillReport';
import Settings from './pages/Settings';
import Users from './pages/Users';
import UserRights from './pages/UserRights';

function AppShell() {
  return (
    <ProtectedRoute>
      <YearProvider>
        <PermissionsProvider>
          <Layout />
        </PermissionsProvider>
      </YearProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<RequireView screen="properties"><Properties /></RequireView>} />
            <Route path="/properties/:id" element={<RequireView screen="properties" action={(p) => (p.id === 'new' ? 'add' : 'view')}><PropertyDetail /></RequireView>} />
            <Route path="/particulars" element={<RequireView screen="particulars"><Particulars /></RequireView>} />
            <Route path="/gpmaster" element={<RequireView screen="gpmaster"><GpMaster /></RequireView>} />
            <Route path="/years" element={<RequireView screen="years"><Years /></RequireView>} />
            <Route path="/payments" element={<RequireView screen="payments"><PaymentEntry /></RequireView>} />
            <Route path="/reports/property-list" element={<RequireView screen="reports_property_list"><PropertyListReport /></RequireView>} />
            <Route path="/reports/old-new" element={<RequireView screen="reports_old_new"><OldNewComparisonReport /></RequireView>} />
            <Route path="/reports/summary" element={<RequireView screen="reports_summary"><SummaryReport /></RequireView>} />
            <Route path="/reports/tax-demand" element={<RequireView screen="reports_tax_demand"><TaxDemandReport /></RequireView>} />
            <Route path="/reports/payment-receipts" element={<RequireView screen="reports_payment_receipts"><PaymentReceiptsReport /></RequireView>} />
            <Route path="/reports/assessment-register" element={<RequireView screen="reports_assessment_register"><AssessmentRegisterReport /></RequireView>} />
            <Route path="/reports/tax-demand-bill" element={<RequireView screen="reports_tax_demand_bill"><TaxDemandBillReport /></RequireView>} />
            <Route path="/settings" element={<RequireView screen="settings"><Settings /></RequireView>} />
            <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
            <Route path="/users/:id/rights" element={<RequireAdmin><UserRights /></RequireAdmin>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
