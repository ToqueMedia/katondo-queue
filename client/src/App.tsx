// App Router — role-based routing with RoleGuard

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { useAuthStore } from './store/auth-store';

// Global auth expiry listener — redirects to login when JWT expires
function AuthExpiredListener() {
  const navigate = useNavigate();
  const authStore = useAuthStore();

  useEffect(() => {
    const handler = () => {
      authStore.logout();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [authStore, navigate]);

  return null;
}
import LoginPage from './auth/login';
import FirstLoginModal from './auth/first-login-modal';
import RoleGuard from './auth/role-guard';
import AppShell from './components/layout/app-shell';
import ToastContainer from './components/common/toast-container';
import AdminManagement from './pages/root/admin-management';
import MyAccount from './pages/root/my-account';
import AdminDashboard from './pages/admin/dashboard';
import UserManagement from './pages/admin/user-management';
import AreaManagement from './pages/admin/area-management';
import ServiceManagement from './pages/admin/service-management';
import StationManagement from './pages/admin/station-management';
import DisplayManagement from './pages/admin/display-management';
import DispenserManagement from './pages/admin/dispenser-management';
import Indicators from './pages/admin/indicators';
import TicketManagement from './pages/admin/ticket-management';
import AdminSettings from './pages/admin/settings';
import BackupManagement from './pages/admin/backup';
import ReceptionQueue from './pages/reception/queue-panel';
import ManagementDashboard from './pages/management/dashboard';
import AdManagement from './pages/management/ad-management';
import TicketFormatConfig from './pages/management/ticket-format-config';
import VoiceConfig from './pages/management/voice-config';


export default function App() {
  const authStore = useAuthStore();

  return (
    <BrowserRouter>
      <AuthExpiredListener />
      <ToastContainer />
      <FirstLoginModal />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Root routes */}
        <Route path="/root/*" element={
          <RoleGuard allowedRoles={['root']}>
            <AppShell>
              <Routes>
                <Route path="admins" element={<AdminManagement />} />
                <Route path="account" element={<MyAccount />} />
                <Route path="*" element={<Navigate to="/root/admins" replace />} />
              </Routes>
            </AppShell>
          </RoleGuard>
        } />

        {/* Admin routes */}
        <Route path="/admin/*" element={
          <RoleGuard allowedRoles={['admin']}>
            <AppShell>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="areas" element={<AreaManagement />} />
                <Route path="services" element={<ServiceManagement />} />
                <Route path="stations" element={<StationManagement />} />
                <Route path="displays" element={<DisplayManagement />} />
                <Route path="dispensers" element={<DispenserManagement />} />
                <Route path="indicators" element={<Indicators />} />
                <Route path="tickets" element={<TicketManagement />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="backup" element={<BackupManagement />} />
                <Route path="account" element={<MyAccount />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </AppShell>
          </RoleGuard>
        } />

        {/* Reception routes */}
        <Route path="/reception/*" element={
          <RoleGuard allowedRoles={['reception']}>
            <Routes>
              <Route path="queue" element={<ReceptionQueue />} />
              <Route path="account" element={<Box minH="100vh" bg="#FAFAF9" p={8}><MyAccount /></Box>} />
              <Route path="*" element={<Navigate to="/reception/queue" replace />} />
            </Routes>
          </RoleGuard>
        } />

        {/* Management routes */}
        <Route path="/management/*" element={
          <RoleGuard allowedRoles={['management']}>
            <AppShell>
              <Routes>
                <Route path="dashboard" element={<ManagementDashboard />} />
                <Route path="ads" element={<AdManagement />} />
                <Route path="ticket-format" element={<TicketFormatConfig />} />
                <Route path="voice" element={<VoiceConfig />} />
                <Route path="account" element={<MyAccount />} />
                <Route path="*" element={<Navigate to="/management/dashboard" replace />} />
              </Routes>
            </AppShell>
          </RoleGuard>
        } />



        {/* Default redirect */}
        <Route path="*" element={
          authStore.isAuthenticated
            ? <Navigate to={getDefaultRoute(authStore.user?.role || '')} replace />
            : <Navigate to="/login" replace />
        } />
      </Routes>
    </BrowserRouter>
  );
}

function getDefaultRoute(role: string): string {
  switch (role) {
    case 'root': return '/root/admins';
    case 'admin': return '/admin/dashboard';
    case 'reception': return '/reception/queue';
    case 'management': return '/management/dashboard';
    case 'display': return '/display';
    case 'dispenser': return '/dispenser';
    default: return '/login';
  }
}
