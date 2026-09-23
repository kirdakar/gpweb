import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { usePermissions } from '../context/PermissionsContext';

// मेनू पट्टी - मास्टर, दैनिक व्यवहार, रिपोर्ट, इतर सुविधा, बाहेर. प्रत्येक
// सबमेन्यू आयटम एका screen कोडशी जोडलेला (अधिकार नसलेल्याला दिसू नये -
// RequireView राऊट-गार्ड कडून URL टाकूनही रोखलेलेच आहे, हे फक्त मेनू स्वच्छ
// ठेवण्यासाठी); adminOnly आयटम फक्त प्रशासकाला दिसतात (बॅकएंडवरही
// requireAdmin नेच संरक्षित - युजर मास्टर प्रमाणेच).
const MENUS = [
  {
    label: 'मास्टर',
    items: [
      { to: '/gpmaster', label: 'मिळकतदार मास्टर', screen: 'gpmaster' },
      { to: '/particulars', label: 'दर मास्टर', screen: 'particulars' },
      { to: '/years', label: 'आर्थिक वर्ष', screen: 'years' },
      { to: '/users', label: 'युजर मास्टर', adminOnly: true },
      { to: '/gp1to33/ledger-heads', label: 'लेखाशीर्ष मास्टर (ग्रामपंचायत १ ते ३३ नमूना)', screen: 'ledger_heads' },
    ],
  },
  {
    label: 'दैनिक व्यवहार',
    items: [
      { to: '/properties', label: 'मिळकत नोंदी', screen: 'properties' },
      { to: '/payments', label: 'कर जमा भरणे', screen: 'payments' },
      { to: '/gp1to33/cash-book', label: 'दैनिक रोकड वही (ग्रामपंचायत १ ते ३३ नमूना)', screen: 'cash_book' },
    ],
  },
  {
    label: 'रिपोर्ट',
    items: [
      { to: '/reports/assessment-register', label: 'आकारणी यादी (नमुना ८)', screen: 'reports_assessment_register' },
      { to: '/reports/tax-demand-bill', label: 'कर मागणी बिल (नमुना ९ क)', screen: 'reports_tax_demand_bill' },
      { to: '/reports/payment-receipts', label: 'जमा पावती अहवाल', screen: 'reports_payment_receipts' },
      { to: '/reports/tax-demand', label: 'कर आकारणी', screen: 'reports_tax_demand' },
      { to: '/reports/property-list', label: 'मिळकत यादी', screen: 'reports_property_list' },
      { to: '/reports/old-new', label: 'येणे बाकी अहवाल', screen: 'reports_old_new' },
      { to: '/reports/summary', label: 'सारांश', screen: 'reports_summary' },
      { to: '/gp1to33/reports/cash-book', label: 'रोकड वही अहवाल नमुना ५ (ग्रामपंचायत १ ते ३३ नमूना)', screen: 'reports_cash_book' },
      { to: '/gp1to33/reports/ledger-classified', label: 'वर्गीकृत नोंदवही नमुना ६ (ग्रामपंचायत १ ते ३३ नमूना)', screen: 'reports_ledger_classified' },
      { to: '/gp1to33/assets-liabilities', label: 'भत्ते व दायित्वे नमुना ४ (ग्रामपंचायत १ ते ३३ नमूना)', screen: 'assets_liabilities' },
    ],
  },
  {
    label: 'इतर सुविधा',
    items: [
      { to: '/settings', label: 'सेटिंग्ज', screen: 'settings' },
      { to: '/maintenance/backup', label: 'बॅकअप', adminOnly: true },
      { to: '/maintenance/restore', label: 'रि-स्टोअर', adminOnly: true },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { years, yearId, setYearId } = useYear();
  const { can, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const menubarRef = useRef(null);

  useEffect(() => {
    function onOutsideClick(e) {
      if (menubarRef.current && !menubarRef.current.contains(e.target)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  function visibleItems(items) {
    return items.filter((item) => (item.adminOnly ? isAdmin : can(item.screen, 'view')));
  }

  return (
    <div className="app-shell">
      <div className="topbar no-print">
        <div className="brand" onClick={() => navigate('/')}>ग्रामपंचायत मिळकत कर</div>
        <nav className="menubar" ref={menubarRef}>
          {MENUS.map((menu) => {
            const items = visibleItems(menu.items);
            if (items.length === 0) return null;
            return (
              <div className="menubar-item" key={menu.label}>
                <button
                  type="button"
                  className={`menubar-btn${openMenu === menu.label ? ' open' : ''}`}
                  onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                >
                  {menu.label} ▾
                </button>
                {openMenu === menu.label && (
                  <div className="menubar-dropdown">
                    {items.map((item) => (
                      <NavLink key={item.to} to={item.to} onClick={() => setOpenMenu(null)}>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="menubar-item">
            <button type="button" className="menubar-btn" onClick={logout}>बाहेर</button>
          </div>
        </nav>
        <div className="right">
          <select value={yearId || ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.year_label}{y.is_active ? ' (चालू)' : ''}</option>
            ))}
          </select>
          <span>{user?.full_name || user?.username}</span>
        </div>
      </div>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
