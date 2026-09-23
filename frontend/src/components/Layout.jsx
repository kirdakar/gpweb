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
//
// { submenu: [...] } असलेला आयटम नेस्टेड फ्लायआऊट आहे (उदा. "ग्रामपंचायत १
// ते ३३ नमूना") - मास्टर/दैनिक व्यवहार/रिपोर्ट तिन्ही ठिकाणी त्याच्या
// प्रत्यक्ष विषयानुसार (मास्टर डेटा / दैनिक नोंदी / फक्त-वाचनीय रिपोर्ट)
// संबंधित नमुने वेगळे ठेवलेले - नमुना ४/१/२ चे डाटाएंट्री दैनिक व्यवहारमध्ये,
// त्याच नमुन्याचा प्रिंट अहवाल रिपोर्टमध्ये (नमुना ५ च्या cash_book/
// reports_cash_book फरकाप्रमाणेच).
const MENUS = [
  {
    label: 'मास्टर',
    items: [
      { to: '/gpmaster', label: 'मिळकतदार मास्टर', screen: 'gpmaster' },
      { to: '/particulars', label: 'दर मास्टर', screen: 'particulars' },
      { to: '/years', label: 'आर्थिक वर्ष', screen: 'years' },
      { to: '/users', label: 'युजर मास्टर', adminOnly: true },
      {
        label: 'ग्रामपंचायत १ ते ३३ नमूना',
        submenu: [
          { to: '/gp1to33/ledger-heads', label: 'लेखाशीर्ष मास्टर', screen: 'ledger_heads' },
        ],
      },
    ],
  },
  {
    label: 'दैनिक व्यवहार',
    items: [
      { to: '/properties', label: 'मिळकत नोंदी', screen: 'properties' },
      { to: '/payments', label: 'कर जमा भरणे', screen: 'payments' },
      {
        label: 'ग्रामपंचायत १ ते ३३ नमूना',
        submenu: [
          { to: '/gp1to33/budget-entry', label: 'वार्षिक अंदाजपत्रक नोंदणी (नमुना १)', screen: 'budget_entries' },
          { to: '/gp1to33/budget-revision', label: 'पुनर्विनियोजन नोंदणी (नमुना २)', screen: 'budget_revisions' },
          { to: '/gp1to33/assets-liabilities', label: 'भत्ते व दायित्वे नोंदणी (नमुना ४)', screen: 'assets_liabilities' },
          { to: '/gp1to33/cash-book', label: 'दैनिक रोकड वही/किरकोळ रोकडवही (नमुना ५/१८)', screen: 'cash_book' },
          { to: '/gp1to33/fixed-assets', label: 'मालमत्ता नोंदणी (नमुना १६/२२/२३/२४)', screen: 'fixed_assets' },
        ],
      },
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
      {
        label: 'ग्रामपंचायत १ ते ३३ नमूना',
        submenu: [
          { to: '/gp1to33/reports/budget', label: 'वार्षिक अंदाजपत्रक अहवाल (नमुना १)', screen: 'reports_budget' },
          { to: '/gp1to33/reports/budget-revision', label: 'पुनर्विनियोजन अहवाल (नमुना २)', screen: 'reports_budget_revision' },
          { to: '/gp1to33/reports/annual-summary', label: 'वार्षिक जमा-खर्च (नमुना ३)', screen: 'reports_annual_summary' },
          { to: '/gp1to33/reports/assets-liabilities', label: 'भत्ते व दायित्वे अहवाल (नमुना ४)', screen: 'reports_assets_liabilities' },
          { to: '/gp1to33/reports/cash-book', label: 'रोकड वही अहवाल (नमुना ५/१८)', screen: 'reports_cash_book' },
          { to: '/gp1to33/reports/ledger-classified', label: 'वर्गीकृत नोंदवही (नमुना ६)', screen: 'reports_ledger_classified' },
          { to: '/gp1to33/reports/fixed-assets', label: 'मालमत्ता अहवाल (नमुना १६/२२/२३/२४)', screen: 'reports_fixed_assets' },
          { to: '/gp1to33/reports/monthly-statement', label: 'मासिक जमा-खर्च विवरण (नमुना २६-क)', screen: 'reports_monthly_statement' },
          { to: '/gp1to33/reports/welfare-expenditure', label: 'मागासवर्गीय/महिला-बाल विवरण (नमुना २८)', screen: 'reports_welfare_expenditure' },
        ],
      },
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
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const menubarRef = useRef(null);

  useEffect(() => {
    function onOutsideClick(e) {
      if (menubarRef.current && !menubarRef.current.contains(e.target)) {
        setOpenMenu(null);
        setOpenSubmenu(null);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  function closeAll() {
    setOpenMenu(null);
    setOpenSubmenu(null);
  }

  // submenu आयटम पुनरावृत्तीने (recursively) फिल्टर करतो; रिकामा झालेला
  // submenu पूर्णपणे लपवतो (नाहीतर रिकामे फ्लायआऊट दिसेल).
  function visibleItems(items) {
    return items.reduce((acc, item) => {
      if (item.submenu) {
        const subItems = visibleItems(item.submenu);
        if (subItems.length > 0) acc.push({ ...item, submenu: subItems });
      } else if (item.adminOnly ? isAdmin : can(item.screen, 'view')) {
        acc.push(item);
      }
      return acc;
    }, []);
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
                  onClick={() => { setOpenMenu(openMenu === menu.label ? null : menu.label); setOpenSubmenu(null); }}
                >
                  {menu.label} ▾
                </button>
                {openMenu === menu.label && (
                  <div className="menubar-dropdown">
                    {items.map((item) => (
                      item.submenu ? (
                        <div className="menubar-subitem" key={item.label}>
                          <div
                            className={`menubar-sub-trigger${openSubmenu === item.label ? ' open' : ''}`}
                            onClick={() => setOpenSubmenu(openSubmenu === item.label ? null : item.label)}
                          >
                            {item.label} ▸
                          </div>
                          {openSubmenu === item.label && (
                            <div className="menubar-submenu">
                              {item.submenu.map((sub) => (
                                <NavLink key={sub.to} to={sub.to} onClick={closeAll}>
                                  {sub.label}
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <NavLink key={item.to} to={item.to} onClick={closeAll}>
                          {item.label}
                        </NavLink>
                      )
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
