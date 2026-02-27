import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
    Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
    AlertTriangle, Calendar, PieChart as PieIcon, DollarSign, CheckCircle, BarChart3, X,
    ChevronLeft, ChevronRight, Shield, Stethoscope, Briefcase, Activity, Target, AlertOctagon, Percent, Calculator, Eye, AlertCircle
} from 'lucide-react';
import {
    ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend
} from 'recharts';

interface ChartData {
    name: string;
    value: number;
    revenue: number; // Added revenue for the detail modal
    description?: string;
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

interface GerenciaMetaEdit {
    id: number;
    descricao: string;
    porcentagem: number | null;
}

interface MetaViewData {
    gerencia: string;
    porcentagemDefinida: number;
    metaValor: number;     // Valor alvo calculado (Meta Global * %)
    realizadoValor: number; // Valor faturado real
    progresso: number;     // % atingida
}

const Dashboard: React.FC = () => {
    const [company, setCompany] = useState<'Gama Medicina' | 'Gama Soluções'>('Gama Medicina');

    // KPI States
    const [saldo, setSaldo] = useState<number>(0);
    const [aReceber, setAReceber] = useState<number>(0);
    const [aPagar, setAPagar] = useState<number>(0);
    // FIX #9: estados receitasMes e despesasMes eram calculados mas nunca usados — removidos

    // Chart Data State
    const [costData, setCostData] = useState<ChartData[]>([]);

    // Filter States
    const [costMonth, setCostMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 7);
    });

    const [activeFilter, setActiveFilter] = useState<'medicina' | 'seguranca' | 'administrativo'>('medicina');

    const [inadimplentes, setInadimplentes] = useState<DefaultingClient[]>([]);
    const [despesasHoje, setDespesasHoje] = useState<ExpenseToday[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingCostGraph, setLoadingCostGraph] = useState(false);
    // FIX #4: loadingMeta separado para não bloquear o Dashboard todo ao abrir modal de meta
    const [loadingMeta, setLoadingMeta] = useState(false);

    // Modal States
    const [showAttentionModal, setShowAttentionModal] = useState(false);
    const [showDefaultsModal, setShowDefaultsModal] = useState(false);
    const [showMetaModal, setShowMetaModal] = useState(false); // New Meta Modal
    const [showOverwriteConfirmation, setShowOverwriteConfirmation] = useState(false); // Confirmation for Meta

    // View Meta Modal States
    const [showViewMetaModal, setShowViewMetaModal] = useState(false);
    const [metaViewData, setMetaViewData] = useState<MetaViewData[]>([]);
    const [currentMetaDetails, setCurrentMetaDetails] = useState<{ receita: number, despesa: number } | null>(null);

    // Meta Check State for Button
    const [hasCurrentMeta, setHasCurrentMeta] = useState(false);

    // Meta Form State
    const [metaForm, setMetaForm] = useState({
        meta_receita: '',
        meta_despesa: '',
        mes_meta: new Date().toISOString().slice(0, 7) // YYYY-MM default used internally
    });
    const [gerenciasMetaList, setGerenciasMetaList] = useState<GerenciaMetaEdit[]>([]); // New state for managing percentages
    const [savingMeta, setSavingMeta] = useState(false);
    const [existingMetaId, setExistingMetaId] = useState<number | null>(null);

    // Detail Modal State
    const [selectedBarData, setSelectedBarData] = useState<ChartData | null>(null);

    // BRAND COLORS
    const COLORS = ['#04a7bd', '#149890', '#050a30', '#f59e0b', '#10b981', '#6366f1', '#ef4444'];

    const safeParseFloat = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let clean = val.replace(/[^\d.,-]/g, '');
            if (clean.indexOf('.') !== -1 && clean.indexOf(',') !== -1) {
                clean = clean.replace(/\./g, '');
                clean = clean.replace(',', '.');
            } else if (clean.indexOf(',') !== -1) {
                clean = clean.replace(',', '.');
            }
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };

    // Funções auxiliares de data para o gráfico de custos
    const formatCostMonth = (isoMonth: string) => {
        if (!isoMonth) return '';
        const [year, month] = isoMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 15);
        const monthName = date.toLocaleString('pt-BR', { month: 'long' });
        return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
    };

    const handleCostMonthChange = (step: number) => {
        const [year, month] = costMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + step, 1);
        const newStr = date.toISOString().slice(0, 7);
        setCostMonth(newStr);
    };

    // --- META LOGIC START ---

    // Check if meta exists for current month on mount
    useEffect(() => {
        const checkMetaStatus = async () => {
            try {
                const currentMonthStr = new Date().toISOString().slice(0, 7) + '-01';
                const { data, error } = await supabase
                    .from('gama_meta')
                    .select('id')
                    .eq('mes_meta', currentMonthStr)
                    .maybeSingle();

                if (!error && data) {
                    setHasCurrentMeta(true);
                } else {
                    setHasCurrentMeta(false);
                }
            } catch (err) {
                console.error("Error checking meta status:", err);
            }
        };
        checkMetaStatus();
    }, [showMetaModal]); // Re-check when modal closes/updates

    // Calculate total percentage used
    const totalPorcentagem = useMemo(() => {
        return gerenciasMetaList.reduce((acc, curr) => acc + (curr.porcentagem || 0), 0);
    }, [gerenciasMetaList]);

    const fetchGerenciasForModal = async () => {
        try {
            const { data, error } = await supabase
                .from('gerencias')
                .select('id, descricao, porcentagem')
                .order('descricao');

            if (error) throw error;
            setGerenciasMetaList(data || []);
        } catch (err) {
            console.error("Error fetching gerencias for meta:", err);
        }
    };

    const handleGerenciaPercentageChange = (id: number, value: string) => {
        setGerenciasMetaList(prev => prev.map(g => {
            if (g.id === id) {
                // Allow empty string for better typing experience, convert to 0 for logic if needed later
                const numVal = value === '' ? null : parseFloat(value);
                return { ...g, porcentagem: numVal };
            }
            return g;
        }));
    };

    const handleOpenMetaModal = () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        setMetaForm({
            meta_receita: '',
            meta_despesa: '',
            mes_meta: currentMonth
        });
        setShowOverwriteConfirmation(false);
        setExistingMetaId(null);
        fetchGerenciasForModal();
        setShowMetaModal(true);
    };

    const handleOpenViewMeta = async () => {
        // FIX #4: usar loadingMeta separado em vez do loading global do Dashboard
        setLoadingMeta(true);
        try {
            const currentMonthStr = new Date().toISOString().slice(0, 7) + '-01';
            const [year, month] = currentMonthStr.split('-').map(Number);

            // 1. Fetch Global Meta
            const { data: metaData, error: metaError } = await supabase
                .from('gama_meta')
                .select('*')
                .eq('mes_meta', currentMonthStr)
                .maybeSingle();

            if (metaError || !metaData) throw new Error("Meta não encontrada.");

            setCurrentMetaDetails({
                receita: metaData.meta_receita || 0,
                despesa: metaData.meta_despesa || 0
            });

            // 2. Fetch Gerencias (Definitions)
            const { data: gerenciasData, error: gerenciasError } = await supabase
                .from('gerencias')
                .select('id, descricao, porcentagem');
            if (gerenciasError) throw gerenciasError;

            // 3. Fetch Actuals (Gerencia Meta - Realizado) for this month
            // Assuming 'faturamento' in gerencia_meta holds the realized revenue
            const startOfMonth = new Date(year, month - 1, 1).toISOString();
            const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

            const { data: actualsData, error: actualsError } = await supabase
                .from('gerencia_meta')
                .select('gerencia, faturamento')
                .gte('created_at', startOfMonth)
                .lte('created_at', endOfMonth);

            if (actualsError) throw actualsError;

            // 4. Calculate View Data
            const processedViewData: MetaViewData[] = gerenciasData.map(g => {
                const porcentagem = g.porcentagem || 0;
                const metaValor = (metaData.meta_receita || 0) * (porcentagem / 100);

                // Sum realized revenue for this gerencia
                const realized = (actualsData || [])
                    .filter(a => a.gerencia === g.id)
                    .reduce((sum, item) => sum + (item.faturamento || 0), 0);

                const progresso = metaValor > 0 ? (realized / metaValor) * 100 : 0;

                return {
                    gerencia: g.descricao,
                    porcentagemDefinida: porcentagem,
                    metaValor: metaValor,
                    realizadoValor: realized,
                    progresso: progresso
                };
            });

            setMetaViewData(processedViewData);
            setShowViewMetaModal(true);

        } catch (err) {
            console.error("Error opening view meta:", err);
            alert("Não foi possível carregar os detalhes da meta.");
        } finally {
            setLoadingMeta(false);
        }
    };

    // Handle Meta Check Logic
    const handleCheckMeta = async (e: React.FormEvent) => {
        e.preventDefault();

        if (totalPorcentagem > 100) {
            alert("A soma das porcentagens não pode exceder 100%.");
            return;
        }

        setSavingMeta(true);

        try {
            const dateStr = `${metaForm.mes_meta}-01`; // Convert 'YYYY-MM' to 'YYYY-MM-01' for Date type

            // Check if meta exists for this month
            const { data: existing, error: fetchError } = await supabase
                .from('gama_meta')
                .select('id')
                .eq('mes_meta', dateStr)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existing) {
                setExistingMetaId(existing.id);
                setShowOverwriteConfirmation(true);
                setSavingMeta(false); // Stop saving spinner, wait for confirmation
            } else {
                // No conflict, save directly
                await executeSaveMeta(null);
            }

        } catch (err) {
            console.error("Erro ao verificar meta:", err);
            alert("Erro ao verificar meta existente.");
            setSavingMeta(false);
        }
    };

    // Final Execute Save (Insert or Update)
    const executeSaveMeta = async (idToUpdate: number | null) => {
        setSavingMeta(true);
        try {
            const receitaVal = parseFloat(metaForm.meta_receita) || 0;
            const despesaVal = parseFloat(metaForm.meta_despesa) || 0;
            const dateStr = `${metaForm.mes_meta}-01`;

            const payload = {
                meta_receita: receitaVal,
                meta_despesa: despesaVal,
                mes_meta: dateStr
            };

            // 1. Save global Meta (Gama Meta)
            let error;
            if (idToUpdate) {
                // Update
                const res = await supabase.from('gama_meta').update(payload).eq('id', idToUpdate);
                error = res.error;
            } else {
                // Insert
                const res = await supabase.from('gama_meta').insert(payload);
                error = res.error;
            }

            if (error) throw error;

            // 2. Save Gerencia Percentages
            // We iterate and update each row in 'gerencias'
            const updates = gerenciasMetaList.map(g =>
                supabase
                    .from('gerencias')
                    .update({ porcentagem: g.porcentagem })
                    .eq('id', g.id)
            );

            await Promise.all(updates);

            alert("Meta e porcentagens definidas com sucesso!");
            setShowMetaModal(false);
            setShowOverwriteConfirmation(false);
            setExistingMetaId(null);
            setHasCurrentMeta(true); // Update UI state

        } catch (err) {
            console.error("Erro ao salvar meta:", err);
            alert("Erro ao salvar a meta.");
        } finally {
            setSavingMeta(false);
        }
    };

    // --- META LOGIC END ---

    // Fetch específico para o gráfico de Distribuição de Custos
    useEffect(() => {
        const fetchCostDistribution = async () => {
            setLoadingCostGraph(true);
            try {
                const [year, month] = costMonth.split('-').map(Number);
                const startOfMonth = new Date(year, month - 1, 1).toISOString();
                const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

                // 1. Buscar todas as gerências
                const { data: gerencias, error: errGerencias } = await supabase
                    .from('gerencias')
                    .select('id, sigla, descricao');

                if (errGerencias) throw errGerencias;

                // 2. Filtrar Gerências com base na sigla e no filtro ativo
                const filteredGerencias = (gerencias || []).filter(g => {
                    const sigla = g.sigla ? g.sigla.toUpperCase() : '';

                    if (activeFilter === 'medicina') {
                        return sigla.startsWith('GM');
                    }
                    if (activeFilter === 'seguranca') {
                        return sigla.startsWith('GS');
                    }
                    if (activeFilter === 'administrativo') {
                        return !sigla.startsWith('GM') && !sigla.startsWith('GS');
                    }
                    return true;
                });

                // Se não houver gerências após o filtro, não adianta buscar metas
                if (filteredGerencias.length === 0) {
                    setCostData([]);
                    setLoadingCostGraph(false);
                    return;
                }

                const gerenciaIds = filteredGerencias.map(g => g.id);

                // 3. Buscar dados da gerencia_meta para o mês selecionado APENAS para as gerências filtradas
                const { data: metas, error: errMetas } = await supabase
                    .from('gerencia_meta')
                    .select('gerencia, in, cf, cv, df, dv, faturamento')
                    .gte('created_at', startOfMonth)
                    .lte('created_at', endOfMonth)
                    .in('gerencia', gerenciaIds);

                if (errMetas) throw errMetas;

                // 4. Processar dados
                const processedData = filteredGerencias.map(g => {
                    // Filtrar metas relacionadas a esta gerencia
                    const relatedMetas = (metas || []).filter(m => m.gerencia === g.id);

                    const totalCost = relatedMetas.reduce((acc, curr) => {
                        const sumRow =
                            (curr.in || 0) +
                            (curr.cf || 0) +
                            (curr.cv || 0) +
                            (curr.df || 0) +
                            (curr.dv || 0);
                        return acc + sumRow;
                    }, 0);

                    const totalRevenue = relatedMetas.reduce((acc, curr) => {
                        return acc + (curr.faturamento || 0);
                    }, 0);

                    return {
                        name: g.sigla, // Somente a SIGLA
                        description: g.descricao, // Descrição completa para tooltip/modal
                        value: totalCost,
                        revenue: totalRevenue
                    };
                });

                setCostData(processedData);

            } catch (error) {
                console.error('Error fetching cost distribution:', error);
            } finally {
                setLoadingCostGraph(false);
            }
        };

        fetchCostDistribution();
    }, [costMonth, activeFilter]);

    // Fetch Geral KPI
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const currentMonthPrefix = new Date().toISOString().slice(0, 7);
                const todayStr = new Date().toISOString().split('T')[0];

                const { data: receitas, error: errReceitas } = await supabase
                    .from('financeiro_receitas')
                    .select(`
            valor_total, status, data_projetada,
            clientes:contratante (nome_fantasia, razao_social)
          `)
                    .eq('empresa_resp', company);

                if (errReceitas) throw errReceitas;

                const { data: despesas, error: errDespesas } = await supabase
                    .from('financeiro_despesas')
                    .select('id, nome, valor, status, data_projetada, recorrente, categoria, fornecedor')
                    .eq('responsavel', company);

                if (errDespesas) throw errDespesas;

                const receitasList = receitas || [];
                const despesasList = despesas || [];

                const totalRecebido = receitasList
                    .filter(r => {
                        const s = (r.status || '').toLowerCase();
                        return (s === 'pago' || s === 'pago em dia' || s === 'pago em atraso');
                    })
                    .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                const totalPago = despesasList
                    .filter(d => d.status?.toLowerCase() === 'pago')
                    .reduce((acc, curr) => acc + (curr.valor || 0), 0);

                setSaldo(totalRecebido - totalPago);

                const totalAReceber = receitasList
                    .filter(r => {
                        const s = (r.status || '').toLowerCase();
                        const isPending = (s === 'em aberto' || s === 'pendente' || s === 'vencido');
                        const isThisMonth = r.data_projetada?.startsWith(currentMonthPrefix);
                        return isPending && isThisMonth;
                    })
                    .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                setAReceber(totalAReceber);

                const totalAPagar = despesasList
                    .filter(d => {
                        const isPending = d.status?.toLowerCase() !== 'pago';
                        const isThisMonth = d.data_projetada?.startsWith(currentMonthPrefix);
                        const isRecurringActive = d.recorrente && d.data_projetada && d.data_projetada <= todayStr;
                        return isPending && (isThisMonth || isRecurringActive);
                    })
                    .reduce((acc, curr) => acc + (curr.valor || 0), 0);

                setAPagar(totalAPagar);

                const receitasMesList = receitasList.filter(r => r.data_projetada?.startsWith(currentMonthPrefix));
                // FIX #9: receitasMes e despesasMes removidos (não eram usados no JSX)
                // Valores calculados apenas para referência interna se necessário no futuro


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

                const overdueMap: Record<string, { debt: number, count: number }> = {};

                receitasList.forEach(r => {
                    const s = (r.status || '').toLowerCase();
                    const isPending = (s === 'em aberto' || s === 'pendente' || s === 'vencido');
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

    // Calculations for summaries
    const totalDespesasHoje = despesasHoje.reduce((acc, item) => acc + item.valor, 0);
    const totalInadimplencia = inadimplentes.reduce((acc, item) => acc + item.totalDebt, 0);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/60">
                    <p className="text-sm font-bold text-[#050a30]">{data.description || label}</p>
                    <p className="text-xs text-slate-500 font-medium mb-2">Sigla: {label}</p>
                    <p className="text-lg font-bold text-[#04a7bd]">
                        Custo: {formatCurrency(payload[0].value)}
                    </p>
                    <p className="text-xs font-semibold text-slate-400 mt-1">
                        (Clique para ver detalhes)
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-6 md:p-8 space-y-8 pb-20 relative">

            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-[#050a30]">Dashboard</h2>
                    <p className="text-slate-500 mt-1">Visão geral financeira</p>
                </div>

                <div className="bg-slate-200/60 p-1.5 rounded-2xl flex relative w-full md:w-auto">
                    <button
                        onClick={() => setCompany('Gama Medicina')}
                        className={`
              flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
              ${company === 'Gama Medicina'
                                ? 'bg-white text-[#050a30] shadow-md shadow-slate-200'
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
                                ? 'bg-white text-[#050a30] shadow-md shadow-slate-200'
                                : 'text-slate-500 hover:text-slate-700'}
            `}
                    >
                        Gama Soluções
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* BIG CARD: SALDO ATUAL */}
                <div className="md:col-span-12 lg:col-span-4 glass-panel p-8 rounded-[32px] relative overflow-hidden group min-h-[200px] flex flex-col justify-center">
                    <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl transition-colors duration-500 ${saldo >= 0 ? 'bg-cyan-400/20' : 'bg-red-400/20'}`}></div>
                    <div className={`absolute bottom-0 right-0 w-32 h-32 rounded-full blur-3xl transition-colors duration-500 ${saldo >= 0 ? 'bg-teal-400/20' : 'bg-orange-400/20'}`}></div>

                    <div className="relative z-10">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#050a30] text-white flex items-center justify-center shadow-lg shadow-[#050a30]/20">
                                    <Wallet size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Saldo Atual</p>
                                    <p className="text-xs text-slate-500">{company}</p>
                                </div>
                            </div>

                            {/* BUTTON: DEFINIR META vs VISUALIZAR META */}
                            {!hasCurrentMeta ? (
                                <button
                                    onClick={handleOpenMetaModal}
                                    className="bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm border border-red-100 animate-pulse"
                                >
                                    <AlertCircle size={14} />
                                    Definir Meta
                                </button>
                            ) : (
                                <button
                                    onClick={handleOpenViewMeta}
                                    className="bg-white/50 hover:bg-white text-[#050a30] text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm border border-white/60 hover:shadow-md"
                                >
                                    <Eye size={14} />
                                    Visualizar Meta
                                </button>
                            )}
                        </div>

                        <div className="space-y-1">
                            {loading ? (
                                <div className="h-10 w-48 bg-slate-200/50 rounded-lg animate-pulse"></div>
                            ) : (
                                <h3 className={`text-4xl font-bold tracking-tight ${saldo >= 0 ? 'text-[#149890]' : 'text-red-500'}`}>
                                    {formatCurrency(saldo)}
                                </h3>
                            )}
                            <div className="flex items-center gap-1 text-slate-400 text-xs font-medium mt-2">
                                <span>Disponível em caixa</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SUMMARY CARDS GRID */}
                <div className="md:col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">

                    {/* CARD: A RECEBER */}
                    <div className="glass-panel p-6 rounded-[28px] flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-100/50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                        <div className="relative z-10">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                <ArrowUpCircle size={14} className="text-[#149890]" /> A Receber
                            </p>
                            {loading ? <div className="h-7 w-20 bg-slate-200/50 rounded mt-2 animate-pulse"></div> : (
                                <h3 className="text-xl font-bold text-slate-700 mt-1">{formatCurrency(aReceber)}</h3>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">Pendente este mês</p>
                        </div>
                    </div>

                    {/* CARD: A PAGAR */}
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

                    {/* CARD: ATENÇÃO HOJE (Interactive) */}
                    <div
                        onClick={() => setShowAttentionModal(true)}
                        className="glass-panel p-6 rounded-[28px] border-l-4 border-l-orange-400 flex flex-col justify-between cursor-pointer hover:bg-orange-50/50 transition-colors relative overflow-hidden group shadow-sm hover:shadow-md"
                    >
                        <div className="absolute right-4 top-4 text-orange-200 group-hover:text-orange-300 transition-colors">
                            <AlertTriangle size={32} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                Atenção Hoje
                            </p>
                            {loading ? <div className="h-8 w-24 bg-slate-200/50 rounded mt-2 animate-pulse"></div> : (
                                <div>
                                    <h3 className="text-2xl font-bold text-orange-500 mt-2">{formatCurrency(totalDespesasHoje)}</h3>
                                    <p className="text-xs text-orange-400 font-semibold mt-1">{despesasHoje.length} despesas vencendo</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CARD: INADIMPLÊNCIA (Interactive) */}
                    <div
                        onClick={() => setShowDefaultsModal(true)}
                        className="glass-panel p-6 rounded-[28px] border-l-4 border-l-red-500 flex flex-col justify-between cursor-pointer hover:bg-red-50/50 transition-colors relative overflow-hidden group shadow-sm hover:shadow-md"
                    >
                        <div className="absolute right-4 top-4 text-red-200 group-hover:text-red-300 transition-colors">
                            <DollarSign size={32} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                Inadimplência Crítica
                            </p>
                            {loading ? <div className="h-8 w-24 bg-slate-200/50 rounded mt-2 animate-pulse"></div> : (
                                <div>
                                    <h3 className="text-2xl font-bold text-red-600 mt-2">{formatCurrency(totalInadimplencia)}</h3>
                                    <p className="text-xs text-red-400 font-semibold mt-1">Top {inadimplentes.length} devedores</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* FULL WIDTH CHART - DISTRIBUTION COST ONLY */}
            <div className="glass-panel p-8 rounded-[32px] flex flex-col">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6">

                    {/* Title and Icon */}
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                            <BarChart3 size={20} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">
                            Distribuição de Custos por Centro de Custo
                        </h3>
                    </div>

                    {/* Controls Area: Filters + Date */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">

                        {/* Category Tabs */}
                        <div className="bg-slate-100/80 p-1 rounded-xl flex w-full sm:w-auto">
                            <button
                                onClick={() => setActiveFilter('medicina')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeFilter === 'medicina' ? 'bg-white text-[#04a7bd] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Stethoscope size={14} />
                                Medicina
                            </button>
                            <button
                                onClick={() => setActiveFilter('seguranca')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeFilter === 'seguranca' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Shield size={14} />
                                Segurança
                            </button>
                            <button
                                onClick={() => setActiveFilter('administrativo')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeFilter === 'administrativo' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Briefcase size={14} />
                                Administrativo
                            </button>
                        </div>

                        {/* Month Navigator */}
                        <div className="flex items-center bg-slate-100/80 rounded-xl p-1 w-full sm:w-auto justify-between sm:justify-center">
                            <button onClick={() => handleCostMonthChange(-1)} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-colors"><ChevronLeft size={16} /></button>
                            <span className="px-3 text-xs font-bold text-slate-700 min-w-[120px] text-center">{formatCostMonth(costMonth)}</span>
                            <button onClick={() => handleCostMonthChange(1)} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-[400px] flex items-center justify-center relative">
                    {loading || loadingCostGraph ? (
                        <div className="animate-pulse w-full h-[300px] bg-slate-50 rounded-2xl"></div>
                    ) : (
                        costData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={Math.max(400, costData.length * 40)}>
                                <BarChart
                                    data={costData}
                                    layout="vertical"
                                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#e2e8f0" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}
                                        width={50}
                                    />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                                    <Bar
                                        dataKey="value"
                                        radius={[0, 8, 8, 0]}
                                        barSize={24}
                                        onClick={(data) => setSelectedBarData(data as any)}
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                    >
                                        {costData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-slate-400"><p>Nenhuma gerência encontrada para este filtro.</p></div>
                        )
                    )}
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* VIEW META MODAL (Redesigned - Wider) */}
            {showViewMetaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowViewMetaModal(false)}></div>

                    <div className="glass-panel w-full max-w-6xl rounded-[32px] relative z-10 p-0 overflow-hidden shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Progresso da Meta</h3>
                                    <p className="text-xs text-slate-500">Acompanhamento mensal por gerência</p>
                                </div>
                            </div>
                            <button onClick={() => setShowViewMetaModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50/30">
                            {/* Summary Header */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Meta Global Receita</p>
                                    <p className="text-3xl font-bold text-slate-700">{formatCurrency(currentMetaDetails?.receita || 0)}</p>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Meta Global Despesa</p>
                                    <p className="text-3xl font-bold text-red-500">{formatCurrency(currentMetaDetails?.despesa || 0)}</p>
                                </div>
                            </div>

                            <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Detalhamento por Gerência</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {metaViewData.map((item, idx) => (
                                    <div key={idx} className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex flex-col justify-between">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-lg">{item.gerencia}</h5>
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider mt-1 inline-block">
                                                    Meta: {item.porcentagemDefinida}%
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Alvo</p>
                                                <p className="text-sm font-bold text-[#04a7bd]">{formatCurrency(item.metaValor)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-auto">
                                            <div className="flex justify-between text-xs font-bold mb-2">
                                                <span className="text-slate-500">Realizado: {formatCurrency(item.realizadoValor)}</span>
                                                <span className={`${item.progresso >= 100 ? 'text-green-500' : 'text-[#04a7bd]'}`}>
                                                    {item.progresso.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    style={{ width: `${Math.min(item.progresso, 100)}%` }}
                                                    className={`h-full rounded-full transition-all duration-700 ease-out ${item.progresso >= 100 ? 'bg-green-500' : 'bg-[#04a7bd]'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {metaViewData.length === 0 && (
                                    <p className="col-span-full text-center text-slate-400 text-sm py-4">Nenhuma gerência configurada.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* META MODAL (Redesigned - Wider) */}
            {showMetaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowMetaModal(false)}></div>

                    <div className="glass-panel w-full max-w-5xl rounded-[32px] relative z-10 p-0 overflow-hidden shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[95vh]">
                        <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-cyan-100 text-[#04a7bd] rounded-xl">
                                    <Target size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">
                                        Definir Meta - {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                                    </h3>
                                    <p className="text-xs text-slate-500">Distribuição de resultados</p>
                                </div>
                            </div>
                            <button onClick={() => setShowMetaModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                            <form id="metaForm" onSubmit={handleCheckMeta} className="space-y-8">

                                {/* Primary Inputs Row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="glass-panel p-5 rounded-[24px] border-l-4 border-l-[#04a7bd] shadow-sm bg-white/60">
                                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mb-2">
                                            <DollarSign size={12} /> Meta de Receita
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={metaForm.meta_receita}
                                                onChange={(e) => setMetaForm({ ...metaForm, meta_receita: e.target.value })}
                                                className="w-full bg-transparent pl-8 text-2xl font-bold text-slate-700 outline-none placeholder:text-slate-200"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="glass-panel p-5 rounded-[24px] border-l-4 border-l-red-400 shadow-sm bg-white/60">
                                        <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 mb-2">
                                            <DollarSign size={12} /> Meta de Custo
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={metaForm.meta_despesa}
                                                onChange={(e) => setMetaForm({ ...metaForm, meta_despesa: e.target.value })}
                                                className="w-full bg-transparent pl-8 text-2xl font-bold text-slate-700 outline-none placeholder:text-slate-200"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="glass-panel p-5 rounded-[24px] bg-slate-50 border border-slate-100 flex flex-col justify-center">
                                        <div className="flex justify-between w-full text-xs font-bold uppercase tracking-wide mb-2">
                                            <span className="text-slate-500">Alocação Total</span>
                                            <span className={`${totalPorcentagem > 100 ? 'text-red-500' : 'text-[#04a7bd]'}`}>
                                                {totalPorcentagem.toFixed(1)}% / 100%
                                            </span>
                                        </div>
                                        <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                style={{ width: `${Math.min(totalPorcentagem, 100)}%` }}
                                                className={`h-full transition-all duration-500 rounded-full ${totalPorcentagem > 100 ? 'bg-red-500' : (totalPorcentagem === 100 ? 'bg-green-500' : 'bg-[#04a7bd]')}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Distribution Section - Grid Layout */}
                                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Percent size={18} className="text-[#04a7bd]" />
                                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Distribuição de Lucro por Gerência</h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                        {gerenciasMetaList.map(gerencia => {
                                            const calculatedValue = (parseFloat(metaForm.meta_receita || '0') * (gerencia.porcentagem || 0)) / 100;

                                            return (
                                                <div key={gerencia.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#04a7bd]/30 transition-all group">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0 group-hover:bg-cyan-50 group-hover:text-[#04a7bd] transition-colors">
                                                            {gerencia.descricao.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-700 truncate" title={gerencia.descricao}>
                                                            {gerencia.descricao}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="relative w-24">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                max="100"
                                                                placeholder="0"
                                                                value={gerencia.porcentagem ?? ''}
                                                                onChange={(e) => handleGerenciaPercentageChange(gerencia.id, e.target.value)}
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-3 pr-8 text-sm font-bold text-right focus:outline-none focus:border-[#04a7bd] transition-colors"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                                        </div>

                                                        <div className="text-right">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Valor</p>
                                                            <span className="text-sm font-bold text-[#04a7bd] block">
                                                                {formatCurrency(calculatedValue)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {gerenciasMetaList.length === 0 && (
                                            <div className="text-center py-8 text-slate-400 flex flex-col items-center col-span-full">
                                                <AlertOctagon size={24} className="mb-2 opacity-50" />
                                                <p className="text-xs">Nenhuma gerência cadastrada.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* OVERWRITE WARNING */}
                                {showOverwriteConfirmation && (
                                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl animate-[scaleIn_0.1s_ease-out]">
                                        <div className="flex items-start gap-3 mb-2">
                                            <AlertOctagon size={24} className="text-red-500 shrink-0" />
                                            <div>
                                                <h4 className="text-sm font-bold text-red-700">Meta Existente!</h4>
                                                <p className="text-xs text-red-600 mt-1 leading-snug">
                                                    Já existe uma meta cadastrada para este mês. Deseja sobrescrever os valores e as porcentagens?
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowOverwriteConfirmation(false)}
                                                className="flex-1 py-3 text-xs font-bold text-red-500 bg-white border border-red-100 rounded-xl hover:bg-red-50"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => executeSaveMeta(existingMetaId)}
                                                className="flex-1 py-3 text-xs font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 shadow-md"
                                            >
                                                Sobrescrever Tudo
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {!showOverwriteConfirmation && (
                            <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 items-center">
                                {totalPorcentagem > 100 && (
                                    <span className="text-xs font-bold text-red-500 mr-auto flex items-center gap-1 animate-pulse">
                                        <AlertOctagon size={12} /> Total excede 100%
                                    </span>
                                )}
                                <button
                                    onClick={() => setShowMetaModal(false)}
                                    className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    form="metaForm"
                                    disabled={savingMeta || totalPorcentagem > 100}
                                    className={`px-8 py-3 font-bold rounded-xl transition-all shadow-lg flex items-center gap-2
                            ${totalPorcentagem > 100
                                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                            : 'bg-[#050a30] text-white hover:bg-[#030720] shadow-[#050a30]/20'}
                        `}
                                >
                                    {savingMeta ? 'Processando...' : 'Salvar Meta'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DETAIL MODAL (New) */}
            {selectedBarData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setSelectedBarData(null)}></div>
                    <div className="glass-panel w-full max-w-lg rounded-[32px] relative z-10 p-6 bg-white/95 shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out]">

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-[#04a7bd] text-white text-xs font-bold px-2 py-0.5 rounded-lg">{selectedBarData.name}</span>
                                    <span className="text-xs text-slate-400 font-bold uppercase">{formatCostMonth(costMonth)}</span>
                                </div>
                                <h3 className="text-xl font-bold text-[#050a30] leading-tight">{selectedBarData.description}</h3>
                            </div>
                            <button onClick={() => setSelectedBarData(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { name: 'Custos', value: selectedBarData.value },
                                        { name: 'Faturamento', value: selectedBarData.revenue }
                                    ]}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                                    <YAxis hide />
                                    <RechartsTooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                                        <Cell fill="#ef4444" /> {/* Red for Costs */}
                                        <Cell fill="#10b981" /> {/* Green for Revenue */}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-2xl bg-red-50 border border-red-100">
                                <p className="text-xs text-red-500 font-bold uppercase mb-1">Total Custos</p>
                                <p className="text-lg font-bold text-red-600">{formatCurrency(selectedBarData.value)}</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-green-50 border border-green-100">
                                <p className="text-xs text-green-600 font-bold uppercase mb-1">Total Faturamento</p>
                                <p className="text-lg font-bold text-green-700">{formatCurrency(selectedBarData.revenue)}</p>
                            </div>
                        </div>

                        <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Saldo Resultante</span>
                            <span className={`text-lg font-bold ${selectedBarData.revenue - selectedBarData.value >= 0 ? 'text-[#149890]' : 'text-red-500'}`}>
                                {formatCurrency(selectedBarData.revenue - selectedBarData.value)}
                            </span>
                        </div>

                    </div>
                </div>
            )}

            {/* ATENÇÃO HOJE MODAL */}
            {showAttentionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowAttentionModal(false)}></div>

                    <div className="glass-panel w-full max-w-lg rounded-[32px] relative z-10 p-6 bg-white/95 shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Despesas de Hoje</h3>
                                    <p className="text-xs text-slate-500">Vencimento: {new Date().toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAttentionModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {despesasHoje.length > 0 ? (
                                despesasHoje.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{item.nome}</p>
                                            <p className="text-xs text-slate-400">{item.fornecedor || 'Fornecedor não inf.'}</p>
                                        </div>
                                        <span className="text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                                            {formatCurrency(item.valor)}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                    <CheckCircle size={32} className="mb-2 opacity-50 text-[#149890]" />
                                    <p className="text-sm font-medium">Tudo pago por hoje!</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Total do Dia</span>
                            <span className="text-xl font-bold text-orange-600">{formatCurrency(totalDespesasHoje)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* INADIMPLÊNCIA MODAL */}
            {showDefaultsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowDefaultsModal(false)}></div>

                    <div className="glass-panel w-full max-w-lg rounded-[32px] relative z-10 p-6 bg-white/95 shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                                    <DollarSign size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Inadimplência Crítica</h3>
                                    <p className="text-xs text-slate-500">Clientes com maiores débitos em aberto</p>
                                </div>
                            </div>
                            <button onClick={() => setShowDefaultsModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {inadimplentes.length > 0 ? (
                                inadimplentes.map((client, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className="text-xs font-bold text-red-500 bg-red-50 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-red-100">{idx + 1}</span>
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
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                    <CheckCircle size={32} className="mb-2 opacity-50 text-[#149890]" />
                                    <p className="text-sm font-medium">Nenhuma inadimplência encontrada.</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Total Crítico</span>
                            <span className="text-xl font-bold text-red-600">{formatCurrency(totalInadimplencia)}</span>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Dashboard;