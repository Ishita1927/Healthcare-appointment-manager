import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { NotificationOutboxModal } from './components/NotificationOutboxModal';
import { PatientPortal } from './pages/PatientPortal';
import { DoctorPortal } from './pages/DoctorPortal';
import { AdminPortal } from './pages/AdminPortal';
import { SystemDesignView } from './pages/SystemDesignView';
import { AuthPage } from './pages/AuthPage';
import { Activity, ShieldCheck, Heart, Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('patient');
  const [isOutboxOpen, setIsOutboxOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-brand-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenOutbox={() => setIsOutboxOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'auth' && <AuthPage onSuccess={() => setActiveTab(user?.role === 'ADMIN' ? 'admin' : user?.role === 'DOCTOR' ? 'doctor' : 'patient')} />}
        {activeTab === 'patient' && <PatientPortal />}
        {activeTab === 'doctor' && <DoctorPortal />}
        {activeTab === 'admin' && <AdminPortal />}
        {activeTab === 'system-design' && <SystemDesignView />}
      </main>

      {/* Outbox & Email Inspection Modal */}
      <NotificationOutboxModal
        isOpen={isOutboxOpen}
        onClose={() => setIsOutboxOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium">
            <Activity className="w-4 h-4 text-brand-600" />
            <span>ClinicPulse Healthcare Manager • Built with AI Summaries & Resilient Concurrency</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              RBAC Guard Active
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              LLM Fail-Safe Engine
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
