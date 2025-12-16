import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Mail, Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 rounded-[20px] relative overflow-hidden bg-white/70">
        {/* Decorative elements - Light */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"></div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-center mb-2 tracking-tight text-slate-800">Gama Center</h1>
          <p className="text-center text-slate-500 mb-8 text-sm uppercase tracking-widest">Financeiro</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input w-full pl-10 pr-4 py-3 rounded-2xl text-sm transition-all focus:ring-2 focus:ring-blue-500/50"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full pl-10 pr-4 py-3 rounded-2xl text-sm transition-all focus:ring-2 focus:ring-blue-500/50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white font-semibold py-3 rounded-2xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Acessar Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;