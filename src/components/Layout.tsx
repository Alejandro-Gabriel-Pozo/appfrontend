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
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <nav className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          Panel de Reservas
          <small>reservations-panel</small>
        </div>
        <div className="sidebar-nav">
          <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/">Panorama</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/resources">Recursos</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/reservations">Reservas</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} to="/occupancy">Ocupación</NavLink>
        </div>
        <div className="sidebar-footer">
          <strong>{user.email}</strong>
          {ROLE_LABELS[user.role] ?? user.role}
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menú">☰</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Cerrar sesión</button>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
