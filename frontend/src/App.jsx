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
import BackupPage from './pages/maintenance/BackupPage';
import RestorePage from './pages/maintenance/RestorePage';
import LedgerHeadMaster from './pages/gp1to33/LedgerHeadMaster';
import CashBookEntry from './pages/gp1to33/CashBookEntry';
import CashBookReport from './pages/gp1to33/CashBookReport';
import ClassifiedLedgerReport from './pages/gp1to33/ClassifiedLedgerReport';
import AssetsLiabilities from './pages/gp1to33/AssetsLiabilities';
import BudgetEntry from './pages/gp1to33/BudgetEntry';
import BudgetRevision from './pages/gp1to33/BudgetRevision';
import AnnualSummaryReport from './pages/gp1to33/AnnualSummaryReport';
import MonthlyStatementReport from './pages/gp1to33/MonthlyStatementReport';
import WelfareExpenditureReport from './pages/gp1to33/WelfareExpenditureReport';
import BudgetReport from './pages/gp1to33/BudgetReport';
import BudgetRevisionReport from './pages/gp1to33/BudgetRevisionReport';
import AssetsLiabilitiesReport from './pages/gp1to33/AssetsLiabilitiesReport';
import ReceiptPrint from './pages/gp1to33/ReceiptPrint';
import VoucherPrint from './pages/gp1to33/VoucherPrint';
import FixedAssetsEntry from './pages/gp1to33/FixedAssetsEntry';
import FixedAssetsReport from './pages/gp1to33/FixedAssetsReport';
import StaffMaster from './pages/gp1to33/StaffMaster';
import StaffSalaryEntry from './pages/gp1to33/StaffSalaryEntry';
import StaffSalaryReport from './pages/gp1to33/StaffSalaryReport';
import AdvanceDepositEntry from './pages/gp1to33/AdvanceDepositEntry';
import AdvanceDepositReport from './pages/gp1to33/AdvanceDepositReport';
import InvestmentEntry from './pages/gp1to33/InvestmentEntry';
import InvestmentReport from './pages/gp1to33/InvestmentReport';
import LoanEntry from './pages/gp1to33/LoanEntry';
import LoanReport from './pages/gp1to33/LoanReport';
import TravelBillEntry from './pages/gp1to33/TravelBillEntry';
import TravelBillReport from './pages/gp1to33/TravelBillReport';
import RefundOrderPrint from './pages/gp1to33/RefundOrderPrint';
import AuditReportEntry from './pages/gp1to33/AuditReportEntry';
import AuditRegisterReport from './pages/gp1to33/AuditRegisterReport';
import AuditMonthlyReport from './pages/gp1to33/AuditMonthlyReport';
import BalanceStatementEntry from './pages/gp1to33/BalanceStatementEntry';
import BalanceStatementReport from './pages/gp1to33/BalanceStatementReport';
import ContractorMaster from './pages/gp1to33/ContractorMaster';
import RateScheduleMaster from './pages/gp1to33/RateScheduleMaster';
import WorkEntry from './pages/gp1to33/WorkEntry';
import WorkReport from './pages/gp1to33/WorkReport';
import MusterEntry from './pages/gp1to33/MusterEntry';
import MusterReport from './pages/gp1to33/MusterReport';
import MiscDemandEntry from './pages/gp1to33/MiscDemandEntry';
import MiscDemandReport from './pages/gp1to33/MiscDemandReport';
import StampEntry from './pages/gp1to33/StampEntry';
import StampReport from './pages/gp1to33/StampReport';
import StockItemMaster from './pages/gp1to33/StockItemMaster';
import StockEntry from './pages/gp1to33/StockEntry';
import StockReport from './pages/gp1to33/StockReport';
import TreeEntry from './pages/gp1to33/TreeEntry';
import TreeReport from './pages/gp1to33/TreeReport';

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
            <Route path="/maintenance/backup" element={<RequireAdmin><BackupPage /></RequireAdmin>} />
            <Route path="/maintenance/restore" element={<RequireAdmin><RestorePage /></RequireAdmin>} />
            <Route path="/gp1to33/ledger-heads" element={<RequireView screen="ledger_heads"><LedgerHeadMaster /></RequireView>} />
            <Route path="/gp1to33/cash-book" element={<RequireView screen="cash_book"><CashBookEntry /></RequireView>} />
            <Route path="/gp1to33/reports/cash-book" element={<RequireView screen="reports_cash_book"><CashBookReport /></RequireView>} />
            <Route path="/gp1to33/reports/ledger-classified" element={<RequireView screen="reports_ledger_classified"><ClassifiedLedgerReport /></RequireView>} />
            <Route path="/gp1to33/assets-liabilities" element={<RequireView screen="assets_liabilities"><AssetsLiabilities /></RequireView>} />
            <Route path="/gp1to33/budget-entry" element={<RequireView screen="budget_entries"><BudgetEntry /></RequireView>} />
            <Route path="/gp1to33/budget-revision" element={<RequireView screen="budget_revisions"><BudgetRevision /></RequireView>} />
            <Route path="/gp1to33/reports/annual-summary" element={<RequireView screen="reports_annual_summary"><AnnualSummaryReport /></RequireView>} />
            <Route path="/gp1to33/reports/monthly-statement" element={<RequireView screen="reports_monthly_statement"><MonthlyStatementReport /></RequireView>} />
            <Route path="/gp1to33/reports/welfare-expenditure" element={<RequireView screen="reports_welfare_expenditure"><WelfareExpenditureReport /></RequireView>} />
            <Route path="/gp1to33/reports/budget" element={<RequireView screen="reports_budget"><BudgetReport /></RequireView>} />
            <Route path="/gp1to33/reports/budget-revision" element={<RequireView screen="reports_budget_revision"><BudgetRevisionReport /></RequireView>} />
            <Route path="/gp1to33/reports/assets-liabilities" element={<RequireView screen="reports_assets_liabilities"><AssetsLiabilitiesReport /></RequireView>} />
            <Route path="/gp1to33/reports/receipt/:id" element={<RequireView screen="reports_receipt_voucher"><ReceiptPrint /></RequireView>} />
            <Route path="/gp1to33/reports/voucher/:id" element={<RequireView screen="reports_receipt_voucher"><VoucherPrint /></RequireView>} />
            <Route path="/gp1to33/fixed-assets" element={<RequireView screen="fixed_assets"><FixedAssetsEntry /></RequireView>} />
            <Route path="/gp1to33/reports/fixed-assets" element={<RequireView screen="reports_fixed_assets"><FixedAssetsReport /></RequireView>} />
            <Route path="/gp1to33/staff" element={<RequireView screen="staff_master"><StaffMaster /></RequireView>} />
            <Route path="/gp1to33/staff-salary" element={<RequireView screen="staff_salary_bills"><StaffSalaryEntry /></RequireView>} />
            <Route path="/gp1to33/reports/staff-salary" element={<RequireView screen="reports_staff_salary_bills"><StaffSalaryReport /></RequireView>} />
            <Route path="/gp1to33/advance-deposits" element={<RequireView screen="advance_deposits"><AdvanceDepositEntry /></RequireView>} />
            <Route path="/gp1to33/reports/advance-deposits" element={<RequireView screen="reports_advance_deposits"><AdvanceDepositReport /></RequireView>} />
            <Route path="/gp1to33/investments" element={<RequireView screen="investments"><InvestmentEntry /></RequireView>} />
            <Route path="/gp1to33/reports/investments" element={<RequireView screen="reports_investments"><InvestmentReport /></RequireView>} />
            <Route path="/gp1to33/loans" element={<RequireView screen="loans"><LoanEntry /></RequireView>} />
            <Route path="/gp1to33/reports/loans" element={<RequireView screen="reports_loans"><LoanReport /></RequireView>} />
            <Route path="/gp1to33/travel-bills" element={<RequireView screen="travel_bills"><TravelBillEntry /></RequireView>} />
            <Route path="/gp1to33/reports/travel-bills" element={<RequireView screen="reports_travel_bills"><TravelBillReport /></RequireView>} />
            <Route path="/gp1to33/reports/refund/:id" element={<RequireView screen="reports_receipt_voucher"><RefundOrderPrint /></RequireView>} />
            <Route path="/gp1to33/audit-reports" element={<RequireView screen="audit_reports"><AuditReportEntry /></RequireView>} />
            <Route path="/gp1to33/reports/audit-register" element={<RequireView screen="reports_audit_register"><AuditRegisterReport /></RequireView>} />
            <Route path="/gp1to33/reports/audit-monthly" element={<RequireView screen="reports_audit_monthly"><AuditMonthlyReport /></RequireView>} />
            <Route path="/gp1to33/balance-statements" element={<RequireView screen="balance_statements"><BalanceStatementEntry /></RequireView>} />
            <Route path="/gp1to33/reports/balance-statements" element={<RequireView screen="reports_balance_statements"><BalanceStatementReport /></RequireView>} />
            <Route path="/gp1to33/contractors" element={<RequireView screen="contractors"><ContractorMaster /></RequireView>} />
            <Route path="/gp1to33/rate-schedule" element={<RequireView screen="rate_schedule"><RateScheduleMaster /></RequireView>} />
            <Route path="/gp1to33/works" element={<RequireView screen="works"><WorkEntry /></RequireView>} />
            <Route path="/gp1to33/muster-rolls" element={<RequireView screen="muster_rolls"><MusterEntry /></RequireView>} />
            <Route path="/gp1to33/reports/muster-roll" element={<RequireView screen="reports_muster_roll"><MusterReport /></RequireView>} />
            <Route path="/gp1to33/reports/work-estimate" element={<RequireView screen="reports_work_estimate"><WorkReport view="estimate" /></RequireView>} />
            <Route path="/gp1to33/reports/work-measurement" element={<RequireView screen="reports_work_measurement"><WorkReport view="measurement" /></RequireView>} />
            <Route path="/gp1to33/reports/work-bills" element={<RequireView screen="reports_work_bills"><WorkReport view="bills" /></RequireView>} />
            <Route path="/gp1to33/misc-demands" element={<RequireView screen="misc_demands"><MiscDemandEntry /></RequireView>} />
            <Route path="/gp1to33/reports/misc-demands" element={<RequireView screen="reports_misc_demands"><MiscDemandReport /></RequireView>} />
            <Route path="/gp1to33/stamps" element={<RequireView screen="stamps"><StampEntry /></RequireView>} />
            <Route path="/gp1to33/reports/stamps" element={<RequireView screen="reports_stamps"><StampReport /></RequireView>} />
            <Route path="/gp1to33/stock-items" element={<RequireView screen="stock_items"><StockItemMaster /></RequireView>} />
            <Route path="/gp1to33/stock" element={<RequireView screen="stock_register"><StockEntry /></RequireView>} />
            <Route path="/gp1to33/reports/stock" element={<RequireView screen="reports_stock"><StockReport /></RequireView>} />
            <Route path="/gp1to33/trees" element={<RequireView screen="trees"><TreeEntry /></RequireView>} />
            <Route path="/gp1to33/reports/trees" element={<RequireView screen="reports_trees"><TreeReport /></RequireView>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
