import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/20 animate-pulse mb-4">
          🪙
        </div>
        <p className="text-slate-400 text-sm font-medium tracking-wide">
          Cargando Centavo...
        </p>
      </div>
    );
  }

  return isAuthenticated ? <DashboardView /> : <LoginView />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
