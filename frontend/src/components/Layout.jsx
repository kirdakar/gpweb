import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';

// प्रत्येक मेनू आयटम कोणत्या screen कोडशी जोडलेला आहे - अधिकार नसलेल्या
// वापरकर्त्याला ती लिंकच दिसू नये (URL टाकून उघडायचा प्रयत्न केला तरी
// RequireView राऊट-गार्ड रोखतो, हे फक्त मेनू स्वच्छ ठेवण्यासाठी).
const NAV_ITEMS = [
  { to: '/', label: 'डॅशबोर्ड', end: true, screen: 'dashboard' },
  { to: '/properties', label: 'मिळकत नोंदी', screen: 'properties' },
  { to: '/particulars', label: 'दर मास्टर', screen: 'particulars' },
  { to: '/gpmaster', label: 'मिळकतदार मास्टर', screen: 'gpmaster' },
  { to: '/years', label: 'आर्थिक वर्ष', screen: 'years' },
  { to: '/payments', label: 'कर जमा भरणे', screen: 'payments' },
  { to: '/reports/property-list', label: 'मिळकत यादी', screen: 'reports_property_list' },
  { to: '/reports/old-new', label: 'येणे बाकी अहवाल', screen: 'reports_old_new' },
  { to: '/reports/summary', label: 'सारांश', screen: 'reports_summary' },
  { to: '/reports/tax-demand', label: 'कर आकारणी', screen: 'reports_tax_demand' },
  { to: '/reports/payment-receipts', label: 'जमा पावती अहवाल', screen: 'reports_payment_receipts' },
  { to: '/reports/assessment-register', label: 'आकारणी यादी (नमुना ८)', screen: 'reports_assessment_register' },
  { to: '/reports/tax-demand-bill', label: 'कर मागणी बिल (नमुना ९ क)', screen: 'reports_tax_demand_bill' },
  { to: '/settings', label: 'सेटिंग्ज', screen: 'settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { years, yearId, setYearId } = useYear();
  const { can, isAdmin } = usePermissions();

  return (
    <div className="app-shell">
      <div className="topbar no-print">
        <div className="brand">ग्रामपंचायत मिळकत कर</div>
        <nav>
          {NAV_ITEMS.filter((item) => can(item.screen, 'view')).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
          ))}
          {isAdmin && <NavLink to="/users">यूजर मास्टर</NavLink>}
        </nav>
        <div className="right">
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.year_label}{y.is_active ? ' (चालू)' : ''}</option>
            ))}
          </select>
          <span>{user?.full_name || user?.username}</span>
          <button className="btn secondary small" onClick={logout}>बाहेर पडा</button>
        </div>
      </div>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
