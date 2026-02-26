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
import { LayoutDashboard, Wallet, LogOut, User as UserIcon, TrendingDown, FileText, Building } from 'lucide-react';
import { User } from './types';

const App: React.FC = () => {
  // FIX #11: session agora tipado corretamente como Session | null (não any)
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'receitas' | 'despesas' | 'medicoes' | 'empresas'>('dashboard');

  // FIX #10: ref para evitar atualização de estado em componente desmontado
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Logic for Public Links (lida antes do fetch de sessão mas não quebra a regra dos hooks)
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

      // FIX #10: só atualiza state se o componente ainda estiver montado
      if (!error && data && isMountedRef.current) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  useEffect(() => {
    // FIX #10: flag para cancelar callback assíncrono se componente desmontar
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      // FIX #3: parâmetro renomeado de "session" para "authSession" para evitar shadowing
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
      // FIX #3: parâmetro renomeado de "session" para "authSession"
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

  // FIX #2: renderização condicional movida para DENTRO do JSX, após todos os hooks
  if (isPublicMedicao && publicDataToken) {
    return <PublicMedicao dataToken={publicDataToken} />;
  }

  if (!session) {
    // FIX #14: onLoginSuccess removida (o fluxo de login usa onAuthStateChange automaticamente)
    return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-[#050a30]">

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-20 lg:w-64 glass-panel border-r-0 md:border-r border-b md:border-b-0 flex flex-col justify-between z-20 sticky top-0 md:h-screen">
        <div>
          <div className="p-6 flex items-center gap-3">
            <img
              src="https://wofipjazcxwxzzxjsflh.supabase.co/storage/v1/object/public/Media/Image/image-removebg-preview%20(2).png"
              alt="Gama Center Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="font-semibold text-lg hidden lg:block tracking-tight text-[#050a30]">Gama Center</span>
          </div>

          <nav className="px-3 space-y-2 mt-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'dashboard' ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20' : 'text-slate-500 hover:bg-slate-100 hover:text-[#050a30]'}`}
            >
              <LayoutDashboard size={22} />
              <span className="hidden lg:block">Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('despesas')}
              className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'despesas' ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20' : 'text-slate-500 hover:bg-slate-100 hover:text-[#050a30]'}`}
            >
              <TrendingDown size={22} />
              <span className="hidden lg:block">Despesas</span>
            </button>
            <button
              onClick={() => setActiveTab('medicoes')}
              className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'medicoes' ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20' : 'text-slate-500 hover:bg-slate-100 hover:text-[#050a30]'}`}
            >
              <FileText size={22} />
              <span className="hidden lg:block">Medições</span>
            </button>
            <button
              onClick={() => setActiveTab('empresas')}
              className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'empresas' ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20' : 'text-slate-500 hover:bg-slate-100 hover:text-[#050a30]'}`}
            >
              <Building size={22} />
              <span className="hidden lg:block">Empresas</span>
            </button>
            <button
              onClick={() => setActiveTab('receitas')}
              className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'receitas' ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20' : 'text-slate-500 hover:bg-slate-100 hover:text-[#050a30]'}`}
            >
              <Wallet size={22} />
              <span className="hidden lg:block">Receitas</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden text-slate-500 border border-slate-100 shrink-0">
              {userProfile?.img_url ? (
                <img src={userProfile.img_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={20} />
              )}
            </div>
            <div className="hidden lg:block overflow-hidden min-w-0">
              <p className="text-sm font-bold truncate text-[#050a30]">
                {userProfile?.username || 'Usuário'}
              </p>
              <p className="text-xs text-slate-400 truncate" title={session.user.email}>
                {session.user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full p-2 rounded-xl text-red-500 hover:bg-red-50 flex items-center justify-center lg:justify-start gap-2 transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden lg:block text-sm font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-[calc(100vh-80px)] md:h-screen relative">
        {/* Background blobs for depth */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden opacity-40">
          <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-[#04a7bd]/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[10%] left-[20%] w-80 h-80 bg-[#050a30]/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          {activeTab === 'receitas' && <Receitas />}
          {activeTab === 'despesas' && <Despesas />}
          {activeTab === 'medicoes' && <Medicoes />}
          {activeTab === 'empresas' && <Empresas />}
          {activeTab === 'dashboard' && <Dashboard />}
        </div>
      </main>
    </div>
  );
};

export default App;