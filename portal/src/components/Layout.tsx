import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Inici', end: true },
  { to: '/referrals', label: 'Els meus referits' },
  { to: '/wallet', label: 'Cartera' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      {/* Sidebar / capçalera per a escriptori */}
      <nav className="topnav">
        <div className="brand">
          <span className="brand-logo">P</span>
          <div className="brand-text">
            <strong>POLSER SEGURETAT</strong>
            <span>Portal de Partners</span>
          </div>
        </div>
        <div className="topnav-links">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => (isActive ? 'topnav-link active' : 'topnav-link')}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="page">
        <Outlet />
      </main>

      {/* Barra de navegació inferior fixa (mòbil) */}
      <nav className="bottomnav">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => (isActive ? 'bottomnav-item active' : 'bottomnav-item')}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}