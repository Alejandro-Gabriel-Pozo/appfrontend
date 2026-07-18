import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Resources } from './pages/Resources';
import { Reservations } from './pages/Reservations';
import { Occupancy } from './pages/Occupancy';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/occupancy" element={<Occupancy />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
