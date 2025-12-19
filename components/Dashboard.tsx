import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, 
  AlertTriangle, Calendar, PieChart as PieIcon, DollarSign, CheckCircle, BarChart3 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

interface ChartData {
  name: string;
  value: number;
}

interface DefaultingClient {
  name: string;
  totalDebt: number;
  count: number;
}

interface ExpenseToday {
  id: number;
  nome: string;
  valor: number;
  fornecedor: string | null;
}

const Dashboard: React.FC = () => {
  const [company, setCompany] = useState<'Gama Medicina' | 'Gama Soluções'>('Gama Medicina');
  
  // KPI States
  const [saldo, setSaldo] = useState<number>(0);
  const [aReceber, setAReceber] = useState<number>(0);
  const [aPagar, setAPagar] = useState<number>(0);
  const [receitasMes, setReceitasMes] = useState<number>(0);
  const [despesasMes, setDespesasMes] = useState<number>(0);
  
  // Charts & Alerts States
  const [pieData, setPieData] = useState<ChartData[]>([]); // Despesas por Categoria
  const [barData, setBarData] = useState<ChartData[]>([]); // Receitas por Tipo (Mês Atual)
  
  const [chartMode, setChartMode] = useState<'expenses' | 'revenues'>('expenses'); // Toggle State

  const [inadimplentes, setInadimplentes] = useState<DefaultingClient[]>([]);
  const [despesasHoje, setDespesasHoje] = useState<ExpenseToday[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Helper to format month name
  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444'];
  const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']; // Colors matching categories

  // Helper function for robust float parsing (handles commas, dots, currency symbols)
  const safeParseFloat = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // 1. Remove anything that is NOT a digit, dot, comma, or minus
      let clean = val.replace(/[^\d.,-]/g, '');

      // 2. Handle PT-BR format (1.000,00) vs Standard (1000.00)
      // If it contains both dot and comma, assume dot is thousands and comma is decimal
      if (clean.indexOf('.') !== -1 && clean.indexOf(',') !== -1) {
         clean = clean.replace(/\./g, ''); // Remove thousands dot
         clean = clean.replace(',', '.');  // Replace decimal comma with dot
      } else if (clean.indexOf(',') !== -1) {
         // If only comma exists, assume it's decimal
         clean = clean.replace(',', '.');
      }
      
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Fetch Receitas (Include Client Data & Breakdown Columns)
        const { data: receitas, error: errReceitas } = await supabase
          .from('financeiro_receitas')
          .select(`
            valor_total, status, data_projetada,
            valor_med, valor_esoc, valor_doc, valor_trein, valor_servsst,
            clientes:contratante (nome_fantasia, razao_social)
          `)
          .eq('empresa_resp', company);

        if (errReceitas) throw errReceitas;

        // 2. Fetch Despesas
        const { data: despesas, error: errDespesas } = await supabase
          .from('financeiro_despesas')
          .select('id, nome, valor, status, data_projetada, recorrente, categoria, fornecedor')
          .eq('responsavel', company); 

        if (errDespesas) throw errDespesas;

        // --- CALCULATION LOGIC ---

        const receitasList = receitas || [];
        const despesasList = despesas || [];

        // 1. Saldo Atual
        const totalRecebido = receitasList
          .filter(r => r.status?.toLowerCase() === 'pago')
          .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

        const totalPago = despesasList
          .filter(d => d.status?.toLowerCase() === 'pago')
          .reduce((acc, curr) => acc + (curr.valor || 0), 0);

        setSaldo(totalRecebido - totalPago);

        // 2. A Receber
        const totalAReceber = receitasList
          .filter(r => {
            const isPending = r.status?.toLowerCase() !== 'pago';
            const isThisMonth = r.data_projetada?.startsWith(currentMonthPrefix);
            return isPending && isThisMonth;
          })
          .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

        setAReceber(totalAReceber);

        // 3. A Pagar
        const totalAPagar = despesasList
          .filter(d => {
            const isPending = d.status?.toLowerCase() !== 'pago';
            const isThisMonth = d.data_projetada?.startsWith(currentMonthPrefix);
            const isRecurringActive = d.recorrente && d.data_projetada && d.data_projetada <= todayStr;
            return isPending && (isThisMonth || isRecurringActive);
          })
          .reduce((acc, curr) => acc + (curr.valor || 0), 0);

        setAPagar(totalAPagar);

        // 4. Receitas do Mês (KPI and Chart Data)
        const receitasMesList = receitasList.filter(r => r.data_projetada?.startsWith(currentMonthPrefix));
        const totalReceitasMes = receitasMesList.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
        setReceitasMes(totalReceitasMes);

        // --- BAR CHART DATA PREPARATION (Current Month Breakdown) ---
        let sumMed = 0;
        let sumEsoc = 0;
        let sumDoc = 0;
        let sumTrein = 0;
        let sumSst = 0;

        receitasMesList.forEach(r => {
            sumMed += safeParseFloat(r.valor_med);
            sumEsoc += safeParseFloat(r.valor_esoc);
            sumDoc += safeParseFloat(r.valor_doc);
            sumTrein += safeParseFloat(r.valor_trein);
            sumSst += safeParseFloat(r.valor_servsst);
        });

        const revenueData = [
            { name: 'Medicina', value: sumMed },
            { name: 'eSocial', value: sumEsoc },
            { name: 'Documentos', value: sumDoc },
            { name: 'Treinamentos', value: sumTrein },
            { name: 'SST', value: sumSst },
        ];
        
        setBarData(revenueData);

        // 5. Despesas do Mês & PIE CHART DATA
        const despesasMesList = despesasList.filter(d => {
            const isThisMonth = d.data_projetada?.startsWith(currentMonthPrefix);
            const isRecurringActive = d.recorrente && d.data_projetada && d.data_projetada <= todayStr;
            return isThisMonth || isRecurringActive;
        });
        const totalDespesasMes = despesasMesList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
        setDespesasMes(totalDespesasMes);

        const catMap: Record<string, number> = {};
        despesasMesList.forEach(d => {
          const cat = d.categoria || 'Sem Categoria';
          catMap[cat] = (catMap[cat] || 0) + (d.valor || 0);
        });
        
        const pieChartData = Object.keys(catMap).map(key => ({
          name: key,
          value: catMap[key]
        })).sort((a, b) => b.value - a.value);
        setPieData(pieChartData);

        // 7. Alerts: Expenses Due Today
        const expensesDueToday = despesasList
          .filter(d => {
            const isPending = d.status?.toLowerCase() !== 'pago';
            const isToday = d.data_projetada?.split('T')[0] === todayStr;
            return isPending && isToday;
          })
          .map(d => ({
            id: d.id,
            nome: d.nome || 'Despesa sem nome',
            valor: d.valor || 0,
            fornecedor: d.fornecedor
          }));
        setDespesasHoje(expensesDueToday);

        // 8. Alerts: Inadimplentes
        const overdueMap: Record<string, { debt: number, count: number }> = {};
        
        receitasList.forEach(r => {
          const isPending = r.status?.toLowerCase() !== 'pago';
          const dueDate = r.data_projetada?.split('T')[0] || '';
          
          if (isPending && dueDate < todayStr) {
            const clientName = (r as any).clientes?.nome_fantasia || (r as any).clientes?.razao_social || 'Desconhecido';
            
            if (!overdueMap[clientName]) {
              overdueMap[clientName] = { debt: 0, count: 0 };
            }
            overdueMap[clientName].debt += (r.valor_total || 0);
            overdueMap[clientName].count += 1;
          }
        });

        const sortedDefaulters = Object.entries(overdueMap)
          .map(([name, data]) => ({
            name,
            totalDebt: data.debt,
            count: data.count
          }))
          .sort((a, b) => b.totalDebt - a.totalDebt)
          .slice(0, 5);

        setInadimplentes(sortedDefaulters);

      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [company]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 pb-20">
      
      {/* Header and Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">Dashboard</h2>
          <p className="text-slate-500 mt-1">Visão geral financeira</p>
        </div>

        {/* Company Segmented Control */}
        <div className="bg-slate-200/60 p-1.5 rounded-2xl flex relative w-full md:w-auto">
          <button
            onClick={() => setCompany('Gama Medicina')}
            className={`
              flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
              ${company === 'Gama Medicina' 
                ? 'bg-white text-slate-900 shadow-md shadow-slate-200' 
                : 'text-slate-500 hover:text-slate-700'}
            `}
          >
            Gama Medicina
          </button>
          <button
            onClick={() => setCompany('Gama Soluções')}
            className={`
              flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
              ${company === 'Gama Soluções' 
                ? 'bg-white text-slate-900 shadow-md shadow-slate-200' 
                : 'text-slate-500 hover:text-slate-700'}
            `}
          >
            Gama Soluções
          </button>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* 1. Saldo Atual (Large Card) */}
        <div className="md:col-span-12 lg:col-span-4 glass-panel p-8 rounded-[32px] relative overflow-hidden group min-h-[200px] flex flex-col justify-center">
          <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl transition-colors duration-500 ${saldo >= 0 ? 'bg-blue-400/20' : 'bg-red-400/20'}`}></div>
          <div className={`absolute bottom-0 right-0 w-32 h-32 rounded-full blur-3xl transition-colors duration-500 ${saldo >= 0 ? 'bg-green-400/20' : 'bg-orange-400/20'}`}></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
                <Wallet size={24} />
              </div>
              <div>
                 <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Saldo Atual</p>
                 <p className="text-xs text-slate-500">{company}</p>
              </div>
            </div>

            <div className="space-y-1">
              {loading ? (
                <div className="h-10 w-48 bg-slate-200/50 rounded-lg animate-pulse"></div>
              ) : (
                <h3 className={`text-4xl font-bold tracking-tight ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatCurrency(saldo)}
                </h3>
              )}
              <div className="flex items-center gap-1 text-slate-400 text-xs font-medium mt-2">
                <span>Disponível em caixa</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Grid of smaller KPIs */}
        <div className="md:col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
            
            {/* Receitas do Mês */}
            <div className="glass-panel p-6 rounded-[28px] border-l-4 border-l-blue-500 flex flex-col justify-between hover:bg-white/80 transition-colors">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Receitas</p>
                        <p className="text-xs text-slate-400 capitalize">{currentMonthName}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                        <TrendingUp size={20} />
                    </div>
                </div>
                {loading ? <div className="h-8 w-24 bg-slate-200/50 rounded mt-2 animate-pulse"></div> : (
                    <h3 className="text-2xl font-bold text-slate-800 mt-2">{formatCurrency(receitasMes)}</h3>
                )}
            </div>

             {/* Despesas do Mês */}
             <div className="glass-panel p-6 rounded-[28px] border-l-4 border-l-purple-500 flex flex-col justify-between hover:bg-white/80 transition-colors">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Despesas</p>
                        <p className="text-xs text-slate-400 capitalize">{currentMonthName}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                        <TrendingDown size={20} />
                    </div>
                </div>
                {loading ? <div className="h-8 w-24 bg-slate-200/50 rounded mt-2 animate-pulse"></div> : (
                    <h3 className="text-2xl font-bold text-slate-800 mt-2">{formatCurrency(despesasMes)}</h3>
                )}
            </div>

            {/* A Receber (Fluxo) */}
            <div className="glass-panel p-6 rounded-[28px] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-100/50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                <div className="relative z-10">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <ArrowUpCircle size={14} className="text-green-500" /> A Receber
                    </p>
                    {loading ? <div className="h-7 w-20 bg-slate-200/50 rounded mt-2 animate-pulse"></div> : (
                        <h3 className="text-xl font-bold text-slate-700 mt-1">{formatCurrency(aReceber)}</h3>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">Pendente este mês</p>
                </div>
            </div>

            {/* A Pagar (Fluxo) */}
            <div className="glass-panel p-6 rounded-[28px] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-100/50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                <div className="relative z-10">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <ArrowDownCircle size={14} className="text-red-500" /> A Pagar
                    </p>
                    {loading ? <div className="h-7 w-20 bg-slate-200/50 rounded mt-2 animate-pulse"></div> : (
                        <h3 className="text-xl font-bold text-slate-700 mt-1">{formatCurrency(aPagar)}</h3>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">Pendente este mês</p>
                </div>
            </div>
        </div>
      </div>

      {/* Analytics & Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* CHARTS CARD */}
        <div className="glass-panel p-8 rounded-[32px] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${chartMode === 'expenses' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {chartMode === 'expenses' ? <PieIcon size={20} /> : <BarChart3 size={20} />}
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">
                      {chartMode === 'expenses' ? 'Despesas por Categoria' : 'Receitas (Detalhamento Mês)'}
                    </h3>
                </div>

                {/* Chart Switcher */}
                <div className="bg-slate-100/80 p-1 rounded-xl flex">
                  <button 
                    onClick={() => setChartMode('expenses')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartMode === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Despesas
                  </button>
                  <button 
                    onClick={() => setChartMode('revenues')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartMode === 'revenues' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Receitas
                  </button>
                </div>
            </div>
            
            <div className="flex-1 min-h-[300px] flex items-center justify-center relative">
                {loading ? (
                    <div className="animate-pulse w-48 h-48 rounded-full border-8 border-slate-100"></div>
                ) : (
                  <>
                    {/* PIE CHART - Expenses */}
                    {chartMode === 'expenses' && (
                       pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                                />
                                <Legend 
                                    layout="vertical" 
                                    verticalAlign="middle" 
                                    align="right"
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                       ) : (
                        <div className="text-center text-slate-400"><p>Sem dados de despesas este mês.</p></div>
                       )
                    )}

                    {/* BAR CHART - Revenues (Current Month Breakdown) */}
                    {chartMode === 'revenues' && (
                       barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                  dataKey="name" 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{fill: '#64748b', fontSize: 11}} 
                                  dy={10}
                                />
                                <YAxis 
                                  hide 
                                />
                                <RechartsTooltip 
                                    cursor={{fill: '#f1f5f9'}}
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={40}>
                                  {barData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                  ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                       ) : (
                        <div className="text-center text-slate-400"><p>Sem detalhamento de receitas este mês.</p></div>
                       )
                    )}
                  </>
                )}
                
                {/* Center Text for Donut (Only for Expenses) */}
                {!loading && chartMode === 'expenses' && pieData.length > 0 && (
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none pr-28"> 
                        <div className="text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Total</p>
                            <p className="text-sm font-bold text-slate-700">{formatCurrency(despesasMes)}</p>
                        </div>
                     </div>
                )}
            </div>
        </div>

        {/* ALERTS PANEL */}
        <div className="flex flex-col gap-6">
            
            {/* Card 1: Vencendo Hoje */}
            <div className="glass-panel p-6 rounded-[32px] flex-1 border border-orange-100 bg-white/60">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-orange-100 text-orange-600 rounded-xl animate-pulse">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Atenção Hoje</h3>
                        <p className="text-xs text-slate-500">Despesas vencendo agora</p>
                    </div>
                </div>

                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                    {loading ? (
                         <div className="space-y-2">
                             <div className="h-12 bg-white/50 rounded-xl w-full animate-pulse"></div>
                             <div className="h-12 bg-white/50 rounded-xl w-full animate-pulse"></div>
                         </div>
                    ) : despesasHoje.length > 0 ? (
                        despesasHoje.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-orange-50 hover:shadow-sm transition-shadow">
                                <div>
                                    <p className="text-sm font-bold text-slate-700">{item.nome}</p>
                                    <p className="text-xs text-slate-400">{item.fornecedor || 'Fornecedor não inf.'}</p>
                                </div>
                                <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                                    {formatCurrency(item.valor)}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-24 text-slate-400">
                            <CheckCircle size={24} className="mb-2 opacity-50 text-green-400" />
                            <p className="text-sm">Tudo pago por hoje!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Card 2: Top Inadimplentes */}
            <div className="glass-panel p-6 rounded-[32px] flex-1 border border-red-100 bg-white/60">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Inadimplência Crítica</h3>
                        <p className="text-xs text-slate-500">Maior impacto no caixa</p>
                    </div>
                </div>

                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                    {loading ? (
                        <div className="space-y-2">
                            <div className="h-12 bg-white/50 rounded-xl w-full animate-pulse"></div>
                            <div className="h-12 bg-white/50 rounded-xl w-full animate-pulse"></div>
                        </div>
                    ) : inadimplentes.length > 0 ? (
                        inadimplentes.map((client, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-red-50 hover:shadow-sm transition-shadow group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-xs font-bold text-red-300 bg-red-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">{idx + 1}</span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate" title={client.name}>{client.name}</p>
                                        <p className="text-[10px] text-slate-400">{client.count} boletos em aberto</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-red-600 whitespace-nowrap">
                                    {formatCurrency(client.totalDebt)}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-24 text-slate-400">
                            <CheckCircle size={24} className="mb-2 opacity-50 text-green-400" />
                            <p className="text-sm">Nenhuma inadimplência.</p>
                        </div>
                    )}
                </div>
            </div>
            
        </div>
      </div>
    </div>
  );
};

export default Dashboard;