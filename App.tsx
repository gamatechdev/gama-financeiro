import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Receitas from './components/Receitas';
import Despesas from './components/Despesas';
import Dashboard from './components/Dashboard';
import Medicoes from './components/Medicoes';
import Empresas from './components/Empresas';
import PrecoExames from './components/PrecoExames'; 
import PublicMedicao from './components/PublicMedicao'; 
import { LayoutDashboard, Wallet, LogOut, User as UserIcon, TrendingDown, FileText, Tag, Building } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'receitas' | 'despesas' | 'medicoes' | 'precos' | 'empresas'>('receitas');

  // Logic for Public Links
  const params = new URLSearchParams(window.location.search);
  const isPublicMedicao = params.get('action') === 'medicao';
  const publicDataToken = params.get('data');

  if (isPublicMedicao && publicDataToken) {
     return <PublicMedicao dataToken={publicDataToken} />;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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

  if (!session) {
    return <Login onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-[#050a30]">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-20 lg:w-64 glass-panel border-r-0 md:border-r border-b md:border-b-0 flex flex-col justify-between z-20 sticky top-0 md:h-screen">
        <div>
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#04a7bd] to-[#149890] flex items-center justify-center shadow-lg shadow-[#04a7bd]/20 text-white">
              <span className="font-bold text-lg">G</span>
            </div>
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
              onClick={() => setActiveTab('receitas')}
              className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'receitas' ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20' : 'text-slate-500 hover:bg-slate-100 hover:text-[#050a30]'}`}
            >
              <Wallet size={22} />
              <span className="hidden lg:block">Receitas</span>
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
              onClick={() => setActiveTab('precos')}
              className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${activeTab === 'precos' ? 'bg-[#04a7bd] text-white shadow-lg shadow-[#04a7bd]/20' : 'text-slate-500 hover:bg-slate-100 hover:text-[#050a30]'}`}
            >
              <Tag size={22} />
              <span className="hidden lg:block">Preço Exames</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden text-slate-500">
               <UserIcon size={16} />
            </div>
            <div className="hidden lg:block overflow-hidden">
              <p className="text-sm font-medium truncate text-slate-700">{session.user.email}</p>
              <p className="text-xs text-slate-400">Usuário</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full p-2 rounded-xl text-red-500 hover:bg-red-50 flex items-center justify-center lg:justify-start gap-2 transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden lg:block text-sm">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-[calc(100vh-80px)] md:h-screen relative">
        {/* Background blobs for depth - Updated Colors */}
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
          {activeTab === 'precos' && <PrecoExames />}
        </div>
      </main>
    </div>
  );
};

export default App;