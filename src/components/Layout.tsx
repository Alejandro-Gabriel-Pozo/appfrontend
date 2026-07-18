import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepción',
  WAITER: 'Mesero',
  CUSTOMER: 'Cliente',
};

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          Bitácora
          <small>Panel operativo</small>
        </div>
        <nav className="sidebar-nav" onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Panorama
          </NavLink>
          <NavLink to="/recursos" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Recursos
          </NavLink>
          <NavLink to="/reservas" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Reservas
          </NavLink>
          {user.role !== 'WAITER' && (
            <NavLink to="/ocupacion" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              Ocupación
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <strong>{user.email}</strong>
          {ROLE_LABELS[user.role] ?? user.role}
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menú">
            ☰
          </button>
          <span />
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

