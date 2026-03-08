import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Login from './components/Login';
import Receitas from './components/Receitas';
import Despesas from './components/Despesas';
import Dashboard from './components/Dashboard';
import Medicoes from './components/Medicoes';
import Empresas from './components/Empresas';
import PublicMedicao from './components/PublicMedicao';
import { LayoutDashboard, Wallet, LogOut, User as UserIcon, TrendingDown, FileText, Building, Menu, X } from 'lucide-react';
import { User } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'receitas' | 'despesas' | 'medicoes' | 'empresas'>('dashboard');

  // Shared filters for better UX cross-navigation
  const [sharedCompany, setSharedCompany] = useState<'Consolidado' | 'Gama Medicina' | 'Gama Soluções'>('Consolidado');
  const [sharedDate, setSharedDate] = useState<Date>(new Date());
  const [sharedViewMode, setSharedViewMode] = useState<'mensal' | 'anual'>('mensal');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const params = new URLSearchParams(window.location.search);
  const isPublicMedicao = params.get('action') === 'medicao';
  const publicDataToken = params.get('data');

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data && isMountedRef.current) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (cancelled) return;
      setSession(authSession);
      setLoading(false);
      if (authSession?.user) {
        fetchUserProfile(authSession.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (cancelled) return;
      setSession(authSession);
      if (authSession?.user) {
        fetchUserProfile(authSession.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-slate-200 rounded-full mb-4"></div>
          <div className="text-sm tracking-wider uppercase opacity-50">Carregando Gama Financial...</div>
        </div>
      </div>
    );
  }

  if (isPublicMedicao && publicDataToken) {
    return <PublicMedicao dataToken={publicDataToken} />;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="h-screen flex flex-col md:flex-row text-[#050a30] bg-[#f8fafc] overflow-hidden">

      {/* MOBILE HEADER */}
      <header className="md:hidden glass-panel sticky top-0 z-[60] px-4 py-3 flex items-center justify-between border-b border-white/60">
        <div className="flex items-center gap-3">
          <img
            src="https://wofipjazcxwxzzxjsflh.supabase.co/storage/v1/object/public/Media/Image/image-removebg-preview%20(2).png"
            alt="Gama Center Logo"
            className="w-8 h-8 object-contain"
          />
          <span className="font-bold text-base tracking-tight text-[#050a30]">Gama Center</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:text-[#04a7bd] transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[70] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR / DRAWER */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-white/98 backdrop-blur-xl border-r border-slate-200/50 z-[80] 
        transform transition-transform duration-300 ease-in-out flex flex-col justify-between 
        md:relative md:translate-x-0 md:w-20 lg:w-64 md:z-10 md:h-screen md:sticky md:top-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 mb-2 flex items-center justify-between md:mb-4 lg:mb-6">
            <div className="flex items-center gap-3">
              <img
                src="https://wofipjazcxwxzzxjsflh.supabase.co/storage/v1/object/public/Media/Image/image-removebg-preview%20(2).png"
                alt="Gama Center Logo"
                className="w-10 h-10 object-contain"
              />
              <span className="font-bold text-lg hidden lg:block md:hidden tracking-tight text-[#050a30] lg:block">Gama Center</span>
              <span className="font-bold text-lg md:hidden tracking-tight text-[#050a30]">Gama Center</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1 px-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'receitas', label: 'Receitas', icon: Wallet },
              { id: 'despesas', label: 'Despesas', icon: TrendingDown },
              { id: 'medicoes', label: 'Medições', icon: FileText },
              { id: 'empresas', label: 'Empresas', icon: Building }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full p-3.5 rounded-[20px] flex items-center gap-3 transition-all duration-200 group
                    ${isActive
                      ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-[#050a30]'}
                  `}
                >
                  <Icon size={22} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="font-semibold text-sm md:hidden lg:block">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-100/60 p-4">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-white shadow-sm shrink-0">
              {userProfile?.img_url ? (
                <img src={userProfile.img_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={22} className="text-slate-400" />
              )}
            </div>
            <div className="md:hidden lg:block overflow-hidden min-w-0">
              <p className="text-sm font-bold truncate text-[#050a30]">
                {userProfile?.username || 'Usuário'}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5" title={session?.user?.email}>
                {userProfile?.role || 'Membro'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full p-4 rounded-2xl text-red-500 bg-red-50/50 hover:bg-red-50 flex items-center justify-center lg:justify-start gap-3 transition-colors group"
          >
            <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="font-bold text-xs uppercase tracking-widest md:hidden lg:block">Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto h-screen relative scroll-smooth">
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden opacity-40">
          <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-[#04a7bd]/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[10%] left-[20%] w-80 h-80 bg-[#050a30]/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto">
          {activeTab === 'receitas' && (
            <Receitas
              sharedCompany={sharedCompany}
              setSharedCompany={setSharedCompany}
              sharedDate={sharedDate}
              setSharedDate={setSharedDate}
              sharedViewMode={sharedViewMode}
              setSharedViewMode={setSharedViewMode}
            />
          )}
          {activeTab === 'despesas' && (
            <Despesas
              sharedCompany={sharedCompany}
              setSharedCompany={setSharedCompany}
              sharedDate={sharedDate}
              setSharedDate={setSharedDate}
              sharedViewMode={sharedViewMode}
              setSharedViewMode={setSharedViewMode}
            />
          )}
          {activeTab === 'medicoes' && (
            <Medicoes
              sharedCompany={sharedCompany}
              setSharedCompany={setSharedCompany}
              sharedDate={sharedDate}
              setSharedDate={setSharedDate}
              sharedViewMode={sharedViewMode}
              setSharedViewMode={setSharedViewMode}
            />
          )}
          {activeTab === 'empresas' && (
            <Empresas
              sharedCompany={sharedCompany}
              setSharedCompany={setSharedCompany}
              sharedDate={sharedDate}
              setSharedDate={setSharedDate}
              sharedViewMode={sharedViewMode}
              setSharedViewMode={setSharedViewMode}
            />
          )}
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={setActiveTab}
              sharedCompany={sharedCompany}
              setSharedCompany={setSharedCompany}
              sharedDate={sharedDate}
              setSharedDate={setSharedDate}
              sharedViewMode={sharedViewMode}
              setSharedViewMode={setSharedViewMode}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;