import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
    Wallet, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
    AlertTriangle, Calendar, PieChart as PieIcon, DollarSign, CheckCircle, BarChart3, X,
    ChevronLeft, ChevronRight, Shield, Stethoscope, Briefcase, Activity, Target, AlertOctagon, Percent, Calculator, Eye, AlertCircle
} from 'lucide-react';
import {
    ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend,
    ComposedChart, LineChart, Line, AreaChart, Area
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
}interface MetaViewData {
    gerencia: string;
    porcentagemDefinida: number;
    metaValor: number;     // Valor alvo calculado (Meta Global * %)
    realizadoValor: number; // Valor faturado real
    progresso: number;     // % atingida
}

interface MonthlyData {
    month: string;
    receitas: number;
    despesas: number;
    lucro: number;
    saldoAcumulado: number;
}

interface DashboardProps {
    onNavigate: (tab: 'dashboard' | 'receitas' | 'despesas' | 'medicoes' | 'empresas') => void;
    sharedCompany: 'Consolidado' | 'Gama Medicina' | 'Gama Soluções';
    setSharedCompany: (company: 'Consolidado' | 'Gama Medicina' | 'Gama Soluções') => void;
    sharedDate: Date;
    setSharedDate: (date: Date) => void;
    sharedViewMode: 'mensal' | 'anual';
    setSharedViewMode: (mode: 'mensal' | 'anual') => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    onNavigate,
    sharedCompany: company,
    setSharedCompany: setCompany,
    sharedDate: referenceDate,
    setSharedDate: setReferenceDate,
    sharedViewMode: viewMode,
    setSharedViewMode: setViewMode
}) => {
    // KPI States
    const [saldo, setSaldo] = useState<number>(0);
    const [aReceber, setAReceber] = useState<number>(0);
    const [aAtraso, setAAtraso] = useState<number>(0);
    const [aPagar, setAPagar] = useState<number>(0);

    // Annual KPIs
    const [annualKpis, setAnnualKpis] = useState({ receita: 0, despesa: 0, lucro: 0, margem: 0 });
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

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
                const todayStr = new Date().toISOString().split('T')[0];

                let receitasList: any[] = [];
                let despesasList: any[] = [];

                let hasMoreRec = true;
                let fromRec = 0;
                while (hasMoreRec) {
                    let query = supabase
                        .from('financeiro_receitas')
                        .select(`
            valor_total, status, data_projetada, data_executada,
            clientes:contratante (nome_fantasia, razao_social)
          `);

                    if (company === 'Gama Medicina') {
                        query = query.or('empresa_resp.ilike.%Gama Medicina%,empresa_resp.is.null');
                    } else if (company !== 'Consolidado') {
                        query = query.ilike('empresa_resp', company);
                    }

                    const { data: receitas, error: errReceitas } = await query.range(fromRec, fromRec + 999);

                    if (errReceitas) throw errReceitas;
                    if (receitas) receitasList = [...receitasList, ...receitas];
                    if (!receitas || receitas.length < 1000) hasMoreRec = false;
                    fromRec += 1000;
                }

                let hasMoreDes = true;
                let fromDes = 0;
                while (hasMoreDes) {
                    let query = supabase
                        .from('financeiro_despesas')
                        .select('id, nome, valor, status, data_projetada, recorrente, categoria, fornecedor');

                    if (company === 'Gama Medicina') {
                        query = query.or('responsavel.ilike.%Gama Medicina%,responsavel.is.null');
                    } else if (company !== 'Consolidado') {
                        query = query.ilike('responsavel', company);
                    }

                    const { data: despesas, error: errDespesas } = await query.range(fromDes, fromDes + 999);

                    if (errDespesas) throw errDespesas;
                    if (despesas) despesasList = [...despesasList, ...despesas];
                    if (!despesas || despesas.length < 1000) hasMoreDes = false;
                    fromDes += 1000;
                }

                const year = referenceDate.getFullYear();
                const month = referenceDate.getMonth();
                const isMensal = viewMode === 'mensal';

                let totRec = 0;
                let totDes = 0;

                const numDays = new Date(year, month + 1, 0).getDate();

                const timelineData: MonthlyData[] = isMensal
                    ? Array.from({ length: numDays }, (_, i) => ({
                        month: String(i + 1),
                        receitas: 0, despesas: 0, lucro: 0, saldoAcumulado: 0
                    }))
                    : Array.from({ length: 12 }, (_, i) => ({
                        month: new Date(year, i, 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', ''),
                        receitas: 0, despesas: 0, lucro: 0, saldoAcumulado: 0
                    }));

                receitasList.forEach(r => {
                    const status = (r.status || '').toLowerCase();
                    const dateRef = r.data_projetada;
                    if (dateRef) {
                        const [yStr, mStr, dStr] = dateRef.split('T')[0].split('-');
                        const rYear = parseInt(yStr, 10);
                        const rMonth = parseInt(mStr, 10) - 1;
                        const rDay = parseInt(dStr, 10);

                        // Check if it's considered paid to accumulate total dashboard KPIs
                        const isPaid = status === 'pago' || status === 'pago em dia' || status === 'pago em atraso' || status === 'recebido' || status === 'concluido';

                        if (isMensal) {
                            if (rYear === year && rMonth === month) {
                                if (rDay >= 1 && rDay <= numDays) timelineData[rDay - 1].receitas += (r.valor_total || 0);
                                totRec += (r.valor_total || 0);
                            }
                        } else {
                            if (rYear === year) {
                                if (rMonth >= 0 && rMonth < 12) timelineData[rMonth].receitas += (r.valor_total || 0);
                                totRec += (r.valor_total || 0);
                            }
                        }
                    }
                });

                despesasList.forEach(d => {
                    const status = (d.status || '').toLowerCase();
                    const dateRef = d.data_projetada;
                    if (dateRef) {
                        const [yStr, mStr, dStr] = dateRef.split('T')[0].split('-');
                        const rYear = parseInt(yStr, 10);
                        const rMonth = parseInt(mStr, 10) - 1;
                        const rDay = parseInt(dStr, 10);

                        const isPaid = status === 'pago' || status === 'pago em atraso';

                        if (isMensal) {
                            if (rYear === year && rMonth === month) {
                                if (rDay >= 1 && rDay <= numDays) timelineData[rDay - 1].despesas += (d.valor || 0);
                                totDes += (d.valor || 0);
                            }
                        } else {
                            if (rYear === year) {
                                if (rMonth >= 0 && rMonth < 12) timelineData[rMonth].despesas += (d.valor || 0);
                                totDes += (d.valor || 0);
                            }
                        }
                    }
                });

                let saldoAcum = 0;
                timelineData.forEach(md => {
                    md.lucro = md.receitas - md.despesas;
                    saldoAcum += md.lucro;
                    md.saldoAcumulado = saldoAcum;
                });

                setMonthlyData(timelineData);
                const lucroLiquido = totRec - totDes;
                const margem = totRec > 0 ? (lucroLiquido / totRec) * 100 : 0;
                setAnnualKpis({ receita: totRec, despesa: totDes, lucro: lucroLiquido, margem });

                const limiteData = isMensal
                    ? `${year}-${String(month + 1).padStart(2, '0')}-31`
                    : `${year}-12-31`;

                const totalReceitaHistorica = receitasList
                    .filter(r => r.data_projetada && r.data_projetada <= limiteData)
                    .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                const totalDespesaHistorica = despesasList
                    .filter(d => d.data_projetada && d.data_projetada <= limiteData)
                    .reduce((acc, curr) => acc + (curr.valor || 0), 0);

                setSaldo(totalReceitaHistorica - totalDespesaHistorica);

                const selectedMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
                const comparePrefix = isMensal ? selectedMonthPrefix : `${year}-`;

                const totalRecebidoPeriod = receitasList
                    .filter(r => {
                        const s = (r.status || '').toLowerCase();
                        const isPaid = (s === 'pago' || s === 'pago em dia' || s === 'pago em atraso' || s === 'recebido' || s === 'concluido');
                        const matchesPeriod = r.data_projetada?.startsWith(comparePrefix);
                        return isPaid && matchesPeriod;
                    })
                    .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                const totalAReceberPeriod = receitasList
                    .filter(r => {
                        const s = (r.status || '').toLowerCase();
                        const isPaid = (s === 'pago' || s === 'pago em dia' || s === 'pago em atraso' || s === 'recebido' || s === 'concluido');
                        const matchesPeriod = r.data_projetada?.startsWith(comparePrefix);
                        const isOverdue = r.data_projetada?.split('T')[0] < todayStr;
                        return !isPaid && matchesPeriod && !isOverdue;
                    })
                    .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                const totalAtrasoPeriod = receitasList
                    .filter(r => {
                        const s = (r.status || '').toLowerCase();
                        const isPaid = (s === 'pago' || s === 'pago em dia' || s === 'pago em atraso' || s === 'recebido' || s === 'concluido');
                        const matchesPeriod = r.data_projetada?.startsWith(comparePrefix);
                        const isOverdue = r.data_projetada?.split('T')[0] < todayStr;
                        return !isPaid && matchesPeriod && isOverdue;
                    })
                    .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

                const totalDespesasPeriod = despesasList
                    .filter(d => d.data_projetada?.startsWith(comparePrefix))
                    .reduce((acc, curr) => acc + (curr.valor || 0), 0);

                const totalAPagarPeriod = despesasList
                    .filter(d => {
                        const isPending = d.status?.toLowerCase() !== 'pago';
                        const matchesPeriod = d.data_projetada?.startsWith(comparePrefix);
                        return isPending && matchesPeriod;
                    })
                    .reduce((acc, curr) => acc + (curr.valor || 0), 0);

                setSaldo(totalRecebidoPeriod);
                setAReceber(totalAReceberPeriod);
                setAAtraso(totalAtrasoPeriod);
                setAPagar(totalAPagarPeriod);

                // Update annualKpis for the summary cards
                setAnnualKpis({
                    receita: totRec,
                    despesa: totDes,
                    lucro: totRec - totDes,
                    margem: totRec > 0 ? ((totRec - totDes) / totRec) * 100 : 0
                });

                const receitasMesList = receitasList.filter(r => r.data_projetada?.startsWith(comparePrefix));
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
    }, [company, referenceDate, viewMode]);

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

    const periodText = viewMode === 'mensal' ? `em ${referenceDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${referenceDate.getFullYear()}` : `em ${referenceDate.getFullYear()}`;
    const fullPeriodText = viewMode === 'mensal' ? referenceDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) : referenceDate.getFullYear().toString();

    return (
        <div className="p-6 md:p-8 space-y-8 pb-20 relative">

            <div className="flex flex-col xl:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-[#050a30]">Dashboard Financeiro</h2>
                    <p className="text-slate-500 mt-1">Visão consolidada de <span className="capitalize">{fullPeriodText}</span></p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center w-full xl:w-auto overflow-auto pb-4 sm:pb-0">
                    {/* ViewMode Switcher */}
                    <div className="bg-slate-200/60 p-1.5 rounded-2xl flex relative min-w-max">
                        <button onClick={() => setViewMode('mensal')} className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${viewMode === 'mensal' ? 'bg-white text-[#04a7bd] shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Mensal</button>
                        <button onClick={() => setViewMode('anual')} className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${viewMode === 'anual' ? 'bg-white text-[#04a7bd] shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Anual</button>
                    </div>
                    {/* Company Selection */}
                    <div className="bg-slate-200/60 p-1.5 rounded-2xl flex relative min-w-max">
                        <button
                            onClick={() => setCompany('Consolidado')}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${company === 'Consolidado' ? 'bg-white text-[#04a7bd] shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                        >Consolidado</button>
                        <button
                            onClick={() => setCompany('Gama Medicina')}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${company === 'Gama Medicina' ? 'bg-white text-[#04a7bd] shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                        >Gama Medicina</button>
                        <button
                            onClick={() => setCompany('Gama Soluções')}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${company === 'Gama Soluções' ? 'bg-white text-[#04a7bd] shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                        >Gama Soluções</button>
                    </div>

                    <div className="flex items-center justify-between bg-white rounded-2xl p-1 shadow-sm border border-slate-100 min-w-max">
                        <button onClick={() => setReferenceDate(d => { const nd = new Date(d); viewMode === 'mensal' ? nd.setMonth(nd.getMonth() - 1) : nd.setFullYear(nd.getFullYear() - 1); return nd; })} className="p-2 text-slate-400 hover:text-[#04a7bd] transition-colors"><ChevronLeft size={20} /></button>
                        <span className="font-bold text-[#050a30] px-3 min-w-[100px] text-center capitalize">
                            {viewMode === 'mensal' ? referenceDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '') : referenceDate.getFullYear()}
                        </span>
                        <button onClick={() => setReferenceDate(d => { const nd = new Date(d); viewMode === 'mensal' ? nd.setMonth(nd.getMonth() + 1) : nd.setFullYear(nd.getFullYear() + 1); return nd; })} className="p-2 text-slate-400 hover:text-[#04a7bd] transition-colors"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>

            {/* KEY METRICS ROW 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. Total Receita */}
                <div
                    onClick={() => onNavigate('receitas')}
                    className="glass-panel p-6 rounded-[24px] flex flex-col justify-center relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-[#149890]"
                >
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-[#149890]" /> Total Receita
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(annualKpis.receita)}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Estimado em {periodText}</p>
                </div>

                {/* 2. Total Despesas */}
                <div
                    onClick={() => onNavigate('despesas')}
                    className="glass-panel p-6 rounded-[24px] flex flex-col justify-center relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-red-500"
                >
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <TrendingDown size={14} className="text-red-500" /> Total Despesas
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(annualKpis.despesa)}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Estimado em {periodText}</p>
                </div>

                {/* 3. Valor Recebido */}
                <div
                    onClick={() => onNavigate('receitas')}
                    className="glass-panel p-6 rounded-[24px] flex flex-col justify-center relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all bg-emerald-50/30 border-l-4 border-l-emerald-500"
                >
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <CheckCircle size={14} /> Valor Recebido (Pago)
                    </p>
                    <h3 className="text-2xl font-bold text-emerald-700">{formatCurrency(saldo)}</h3>
                    <p className="text-[10px] text-emerald-600/60 mt-1">Liquidado em {periodText}</p>
                </div>

                {/* 4. Valor a Receber / Em Atraso */}
                <div
                    onClick={() => onNavigate('receitas')}
                    className="glass-panel p-6 rounded-[24px] flex flex-col justify-center relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all bg-amber-50/30 border-l-4 border-l-amber-500"
                >
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <AlertCircle size={14} /> Valor a Receber
                    </p>
                    <div className="flex flex-col">
                        <h3 className="text-2xl font-bold text-amber-700">{formatCurrency(aReceber + aAtraso)}</h3>
                        <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Pendentes</span>
                                <span className="text-xs font-bold text-slate-600">{formatCurrency(aReceber)}</span>
                            </div>
                            <div className="w-px h-6 bg-slate-200" />
                            <div className="flex flex-col">
                                <span className="text-[10px] text-red-400 font-bold uppercase">Em Atraso</span>
                                <span className="text-xs font-bold text-red-600">{formatCurrency(aAtraso)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECONDARY METRICS: PROFITABILITY & MARGIN */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Profit KPI */}
                <div className="lg:col-span-8 glass-panel p-6 bg-gradient-to-br from-white to-slate-50 rounded-[32px] flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                        <Calculator size={120} />
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                            <Wallet size={18} className="text-[#04a7bd]" />
                            Lucro Líquido Projetado ({periodText})
                        </p>
                    </div>
                    <h3 className={`text-4xl font-bold ${annualKpis.lucro >= 0 ? 'text-[#149890]' : 'text-red-500'}`}>
                        {formatCurrency(annualKpis.lucro)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">Diferença entre receitas e despesas projetadas.</p>
                </div>

                {/* Margin Graph */}
                <div className="lg:col-span-4 glass-panel p-6 rounded-[32px] flex flex-col items-center justify-center bg-white border border-slate-100 shadow-sm">
                    <div className="relative flex items-center justify-center w-24 h-24 mb-3">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path strokeDasharray={`${annualKpis.margem > 0 ? (annualKpis.margem > 100 ? 100 : annualKpis.margem) : 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#04a7bd" strokeWidth="3" strokeLinecap="round" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" className="opacity-30" />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-lg font-black text-[#050a30] leading-none">{annualKpis.margem.toFixed(1)}%</span>
                        </div>
                    </div>
                    <p className="text-xs font-bold text-[#04a7bd] uppercase tracking-wider text-center">Margem Operacional</p>
                </div>
            </div>

            {/* MAIN CHART */}
            <div className="glass-panel p-8 rounded-[32px] flex flex-col">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                    <Target size={20} className="text-[#04a7bd]" /> Receitas e Despesas (<span className="capitalize">{fullPeriodText}</span>)
                </h3>
                <div className="w-full h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
                            <RechartsTooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                            <Bar dataKey="receitas" name="Total Receita" fill="#149890" radius={[6, 6, 0, 0]} barSize={24} />
                            <Bar dataKey="despesas" name="Total Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} />
                            <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke="#050a30" strokeWidth={3} dot={{ r: 5, fill: '#050a30', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* BOTTOM CHARTS AND TABLE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel p-8 rounded-[32px] flex flex-col">
                    <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-[#04a7bd]" /> Saldo no final do mês
                    </h3>
                    <div className="w-full h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
                                <RechartsTooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                <Area type="monotone" dataKey="saldoAcumulado" name="Acumulado Histórico Ano" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorSaldo)" dot={{ r: 4, fill: '#fff', stroke: '#f59e0b', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#f59e0b' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel p-8 rounded-[32px] flex flex-col">
                    <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                        <BarChart3 size={20} className="text-[#04a7bd]" /> Demonstração de Resultados (<span className="capitalize">{fullPeriodText}</span>)
                    </h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors">
                            <span className="text-sm font-medium text-slate-600">Total Receita</span>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-bold text-[#149890]">{formatCurrency(annualKpis.receita)}</span>
                                <span className="text-[10px] w-10 text-right font-bold text-slate-400">100%</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors">
                            <span className="text-sm font-medium text-slate-600">Total Despesas</span>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-bold text-red-500">{formatCurrency(annualKpis.despesa)}</span>
                                <span className="text-[10px] w-10 text-right font-bold text-slate-400">{(annualKpis.receita > 0 ? (annualKpis.despesa / annualKpis.receita) * 100 : 0).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-4 border border-slate-100 bg-[#04a7bd]/10 shadow-sm rounded-xl mt-2">
                            <span className="text-sm font-bold text-[#050a30]">Lucro Líquido</span>
                            <div className="flex items-center gap-4">
                                <span className={`text-base font-bold ${annualKpis.lucro >= 0 ? 'text-[#149890]' : 'text-red-500'}`}>{formatCurrency(annualKpis.lucro)}</span>
                                <span className="text-[10px] w-10 text-right font-bold text-[#04a7bd]">{annualKpis.margem.toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* VIEW META MODAL (Redesigned - Wider) */}
            {
                showViewMetaModal && (
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
                )
            }

            {/* META MODAL (Redesigned - Wider) */}
            {
                showMetaModal && (
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
                                            Definir Meta - {referenceDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
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
                )
            }

            {/* DETAIL MODAL (New) */}
            {
                selectedBarData && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedBarData(null)}></div>
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
                )
            }

            {/* ATENÇÃO HOJE MODAL */}
            {
                showAttentionModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAttentionModal(false)}></div>

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
                )
            }

            {/* INADIMPLÊNCIA MODAL */}
            {
                showDefaultsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDefaultsModal(false)}></div>

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
                )
            }
        </div>
    );
};

export default Dashboard;