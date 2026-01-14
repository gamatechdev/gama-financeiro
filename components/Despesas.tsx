import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FinanceiroDespesa } from '../types';
import { 
  Plus, Trash2, Calendar, TrendingDown, Layers, CheckCircle, 
  X, Check, Search, Filter, ChevronLeft, ChevronRight, ChevronDown, Tag, CreditCard, Briefcase, RefreshCw, Edit, LayoutGrid, List, UserCog, Users, DollarSign, ArrowRight, Percent, Split, AlertTriangle
} from 'lucide-react';

interface ProviderGroup {
  fornecedor: string;
  total: number;
  count: number;
  ids: number[];
  firstValue: number; 
}

const CATEGORIES_LIST = ['Medicina', 'Segurança', 'Investimento', 'Operacional'];

const Despesas: React.FC = () => {
  const [despesas, setDespesas] = useState<FinanceiroDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitPercentages, setSplitPercentages] = useState<Record<string, string>>({});

  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [selectedProviderGroup, setSelectedProviderGroup] = useState<ProviderGroup | null>(null);
  const [bulkServiceValue, setBulkServiceValue] = useState('');

  const [viewMode, setViewMode] = useState<'cards' | 'rows'>('cards');

  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 0, 1).toISOString().slice(0, 7);
  });
  
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [formData, setFormData] = useState({
    nome: '',
    desc: '',
    fornecedor: '',
    categoria: '',
    forma_pagamento: '',
    centro_custos: '',
    responsavel: 'Gama Medicina',
    valor: '',
    data_projetada: '',
    status: 'Pendente',
    qnt_parcela: '1',
    recorrente: false
  });

  const fetchBaseData = async () => {
    try {
      setLoading(true);
      const { data: despesasData, error: despesasError } = await supabase
        .from('financeiro_despesas')
        .select('*')
        .order('data_projetada', { ascending: true });

      if (despesasError) throw despesasError;
      setDespesas(despesasData as any || []);

    } catch (error: any) {
      console.error('Error fetching data:', error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (monthFilter) {
      setCalendarYear(parseInt(monthFilter.split('-')[0]));
    }
  }, [monthFilter]);

  // --- Logic Helpers ---

  const getStatusInfo = (despesa: FinanceiroDespesa) => {
    const statusDb = despesa.status?.toLowerCase() || '';

    if (statusDb === 'pago') {
      return { 
        label: 'Pago', 
        textColor: 'text-[#149890]', // Secondary
        dotColor: 'bg-[#149890]',
        bgPill: 'bg-teal-50',
        borderColor: 'border-teal-200'
      };
    }
    
    if (!despesa.data_projetada) {
      return { 
        label: 'Pendente', 
        textColor: 'text-slate-500',
        dotColor: 'bg-slate-400',
        bgPill: 'bg-slate-100',
        borderColor: 'border-slate-200'
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const dueDate = despesa.data_projetada.split('T')[0];

    if (dueDate < today) {
      return { 
        label: 'Vencido', 
        textColor: 'text-red-600',
        dotColor: 'bg-red-500',
        bgPill: 'bg-red-100',
        borderColor: 'border-red-200'
      };
    }

    if (dueDate === today) {
      return {
        label: 'Vencendo',
        textColor: 'text-orange-600',
        dotColor: 'bg-orange-500',
        bgPill: 'bg-orange-100',
        borderColor: 'border-orange-200'
      };
    }

    return { 
      label: 'Aguardando', 
      textColor: 'text-[#04a7bd]', // Primary
      dotColor: 'bg-[#04a7bd]',
      bgPill: 'bg-cyan-50',
      borderColor: 'border-cyan-200'
    };
  };

  const handleMonthChange = (step: number) => {
    if (!monthFilter) return;
    const [year, month] = monthFilter.split('-').map(Number);
    const date = new Date(year, month - 1 + step, 1);
    const newStr = date.toISOString().slice(0, 7);
    setMonthFilter(newStr);
  };

  const selectMonthFromCalendar = (monthIndex: number) => {
    const newMonth = new Date(calendarYear, monthIndex, 1);
    setMonthFilter(newMonth.toISOString().slice(0, 7));
    setShowCalendar(false);
  };

  const filterByMonth = (d: FinanceiroDespesa) => {
    if (!d.data_projetada) return false;
    const dDate = d.data_projetada.slice(0, 7);
    
    if (dDate === monthFilter) return true;
    if (d.recorrente && dDate <= monthFilter) return true;

    return false;
  };

  const kpiDespesas = useMemo(() => {
    return despesas.filter(d => filterByMonth(d));
  }, [despesas, monthFilter]);

  const filteredDespesas = useMemo(() => {
    return despesas.filter(d => {
      if (!filterByMonth(d)) return false;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (d.nome?.toLowerCase() || '').includes(searchLower) ||
        (d.fornecedor?.toLowerCase() || '').includes(searchLower);

      const statusInfo = getStatusInfo(d);
      const matchesStatus = statusFilter === 'todos' 
        ? true 
        : statusInfo.label.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [despesas, monthFilter, searchTerm, statusFilter]);

  const { specialProviderCards, regularDespesas } = useMemo(() => {
    const specialMap: Record<string, ProviderGroup> = {};
    const regular: FinanceiroDespesa[] = [];

    filteredDespesas.forEach(d => {
      if (d.desc === "Atendimento por prestador") {
        const providerName = d.fornecedor || 'Prestador Desconhecido';
        
        if (!specialMap[providerName]) {
          specialMap[providerName] = {
            fornecedor: providerName,
            total: 0,
            count: 0,
            ids: [],
            firstValue: d.valor || 0
          };
        }
        
        specialMap[providerName].total += (d.valor || 0);
        specialMap[providerName].count += 1;
        specialMap[providerName].ids.push(d.id);
      } else {
        regular.push(d);
      }
    });

    return {
      specialProviderCards: Object.values(specialMap) as ProviderGroup[],
      regularDespesas: regular
    };
  }, [filteredDespesas]);

  const kpis = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;

    kpiDespesas.forEach(d => {
      const val = d.valor || 0;
      const isPaid = d.status?.toLowerCase() === 'pago';
      
      total += val;
      if (isPaid) {
        paid += val;
      } else {
        pending += val;
      }
    });

    return { total, paid, pending };
  }, [kpiDespesas]);

  const handleOpenNew = () => {
    setEditingId(null);
    setIsSplitMode(false);
    setSplitPercentages({});
    setFormData({
        nome: '',
        desc: '',
        fornecedor: '',
        categoria: '',
        forma_pagamento: '',
        centro_custos: '',
        responsavel: 'Gama Medicina',
        valor: '',
        data_projetada: '',
        status: 'Pendente',
        qnt_parcela: '1',
        recorrente: false
    });
    setIsModalOpen(true);
  };

  const handleEdit = (despesa: FinanceiroDespesa) => {
    setEditingId(despesa.id);
    setIsSplitMode(false); 
    setSplitPercentages({});
    setFormData({
        nome: despesa.nome || '',
        desc: despesa.desc || '',
        fornecedor: despesa.fornecedor || '',
        categoria: despesa.categoria || '',
        forma_pagamento: despesa.forma_pagamento || '',
        centro_custos: despesa.centro_custos || '',
        responsavel: despesa.responsavel || 'Gama Medicina',
        valor: despesa.valor?.toString() || '',
        data_projetada: despesa.data_projetada ? despesa.data_projetada.split('T')[0] : '',
        status: despesa.status || 'Pendente',
        qnt_parcela: despesa.qnt_parcela?.toString() || '1',
        recorrente: despesa.recorrente || false
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
    try {
      const { error } = await supabase.from('financeiro_despesas').delete().eq('id', id);
      if (error) throw error;
      setDespesas(prev => prev.filter(d => d.id !== id));
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert('Erro ao excluir despesa.');
    }
  };

  const handleMarkAsPaid = async (despesa: FinanceiroDespesa) => {
    if (despesa.status?.toLowerCase() === 'pago') return;
    try {
      const { data, error } = await supabase
        .from('financeiro_despesas')
        .update({ status: 'Pago' })
        .eq('id', despesa.id)
        .select();

      if (error) throw error;

      setDespesas(prev => prev.map(d => 
        d.id === despesa.id ? { ...d, status: 'Pago' } : d
      ));
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  const openProviderModal = (group: ProviderGroup) => {
    setSelectedProviderGroup(group);
    setBulkServiceValue(group.firstValue > 0 ? group.firstValue.toString() : '');
    setIsProviderModalOpen(true);
  };

  const handleBulkUpdateValue = async () => {
    if (!selectedProviderGroup || !bulkServiceValue) return;
    setSubmitting(true);

    try {
        const newVal = parseFloat(bulkServiceValue.replace(',', '.'));
        if (isNaN(newVal)) throw new Error("Valor inválido");

        const { error } = await supabase
            .from('financeiro_despesas')
            .update({ valor: newVal })
            .in('id', selectedProviderGroup.ids);
        
        if (error) throw error;

        setDespesas(prev => prev.map(d => {
            if (selectedProviderGroup.ids.includes(d.id)) {
                return { ...d, valor: newVal };
            }
            return d;
        }));

        setIsProviderModalOpen(false);
        fetchBaseData();

    } catch (err: any) {
        console.error("Error bulk updating:", err);
        alert("Erro ao atualizar valores.");
    } finally {
        setSubmitting(false);
    }
  };

  const handleBulkPay = async () => {
    if (!selectedProviderGroup) return;
    const targetIds = selectedProviderGroup.ids;
    if (!targetIds || targetIds.length === 0) return;

    setSubmitting(true);

    try {
        const { error } = await supabase
            .from('financeiro_despesas')
            .update({ status: 'Pago' })
            .in('id', targetIds)
            .select();
        
        if (error) throw error;

        setDespesas(prev => prev.map(d => {
            if (targetIds.includes(d.id)) {
                return { ...d, status: 'Pago' };
            }
            return d;
        }));

        setIsProviderModalOpen(false);
        fetchBaseData();

    } catch (err: any) {
        console.error("CATCH ERROR:", err);
        alert(`Falha ao realizar pagamento: ${err.message || 'Erro desconhecido'}`);
    } finally {
        setSubmitting(false);
    }
  };

  const updateSplitPercentage = (category: string, value: string) => {
    const newVal = parseFloat(value);
    
    setSplitPercentages(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const totalSplitPercent = useMemo(() => {
    return Object.values(splitPercentages).reduce((acc: number, val: any) => acc + (parseFloat(val as string) || 0), 0);
  }, [splitPercentages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const totalValue = formData.valor ? parseFloat(formData.valor) : 0;
      const numInstallments = formData.qnt_parcela ? parseInt(formData.qnt_parcela) : 1;
      
      const payloads = [];

      const generatePayloads = (val: number, cat: string) => {
          const installmentValue = numInstallments > 0 ? val / numInstallments : val;
          const currentPayloads = [];

          if (formData.data_projetada && numInstallments > 1) {
             const [y, m, d] = formData.data_projetada.split('-').map(Number);
             
             for (let i = 0; i < numInstallments; i++) {
               const dueDate = new Date(y, (m - 1) + i, d);
               const dueDateStr = dueDate.toISOString().split('T')[0];
  
               let desc = formData.desc || '';
               desc = `${desc} (Parcela ${i + 1}/${numInstallments})`.trim();
  
               currentPayloads.push({
                 nome: formData.nome,
                 desc: desc,
                 fornecedor: formData.fornecedor,
                 categoria: cat,
                 forma_pagamento: formData.forma_pagamento,
                 centro_custos: formData.centro_custos,
                 responsavel: formData.responsavel,
                 valor: installmentValue,
                 data_projetada: dueDateStr,
                 status: formData.status,
                 qnt_parcela: numInstallments,
                 recorrente: formData.recorrente
               });
             }
          } else {
            currentPayloads.push({
              nome: formData.nome,
              desc: formData.desc,
              fornecedor: formData.fornecedor,
              categoria: cat,
              forma_pagamento: formData.forma_pagamento,
              centro_custos: formData.centro_custos,
              responsavel: formData.responsavel,
              valor: val,
              data_projetada: formData.data_projetada || null,
              status: formData.status,
              qnt_parcela: 1,
              recorrente: formData.recorrente
            });
          }
          return currentPayloads;
      };

      if (editingId) {
         const payload = {
            nome: formData.nome,
            desc: formData.desc,
            fornecedor: formData.fornecedor,
            categoria: formData.categoria,
            forma_pagamento: formData.forma_pagamento,
            centro_custos: formData.centro_custos,
            responsavel: formData.responsavel,
            valor: totalValue,
            data_projetada: formData.data_projetada || null,
            qnt_parcela: numInstallments,
            recorrente: formData.recorrente
         };

         const { error } = await supabase
            .from('financeiro_despesas')
            .update(payload)
            .eq('id', editingId);

         if (error) throw error;

      } else {
        
        if (isSplitMode) {
             if (Math.abs(totalSplitPercent - 100) > 0.1) {
                 alert("A soma das porcentagens deve ser exatamente 100%.");
                 setSubmitting(false);
                 return;
             }

             Object.entries(splitPercentages).forEach(([cat, percentage]) => {
                const perc = parseFloat(percentage as string);
                if (perc > 0) {
                    const splitVal = totalValue * (perc / 100);
                    payloads.push(...generatePayloads(splitVal, cat));
                }
             });
             
             if (payloads.length === 0) {
                payloads.push(...generatePayloads(totalValue, formData.categoria));
             }

        } else {
             payloads.push(...generatePayloads(totalValue, formData.categoria));
        }

        const { error } = await supabase.from('financeiro_despesas').insert(payloads);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchBaseData();

    } catch (error: any) {
      console.error('Error submitting:', error);
      alert('Erro ao salvar despesa. Verifique os dados.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const formatMonth = (isoMonth: string) => {
    if (!isoMonth) return '';
    const [year, month] = isoMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 15);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    const yearNum = date.getFullYear();
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yearNum}`;
  };
  
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="p-6 relative min-h-full space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#050a30]">Despesas</h2>
          <p className="text-slate-500 mt-1">
            Controle de saídas de <span className="font-semibold text-slate-700">{formatMonth(monthFilter)}</span>
          </p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="bg-[#050a30] hover:bg-[#030720] text-white px-5 py-3 rounded-full font-medium shadow-lg shadow-[#050a30]/20 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Nova Despesa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-1">Total Previsto</p>
            <p className="text-2xl font-bold text-[#050a30]">{formatCurrency(kpis.total)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
            <Layers size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-1">Total Pago</p>
            <p className="text-2xl font-bold text-[#149890]">{formatCurrency(kpis.paid)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-teal-50 text-[#149890] flex items-center justify-center">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-1">A Pagar</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(kpis.pending)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
            <TrendingDown size={24} />
          </div>
        </div>
      </div>

      <div className="glass-panel p-2 rounded-[20px] flex flex-col md:flex-row items-center gap-2 z-20 relative">
        <div className="flex-1 w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Buscar por nome ou fornecedor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent p-3 pl-10 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none rounded-xl hover:bg-white/40 transition-colors"
          />
        </div>

        <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

        <div className="flex w-full md:w-auto gap-2 h-10 items-center">
          
          <div className="bg-white/50 p-1 rounded-xl flex items-center gap-1 shadow-sm h-full">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em Cards"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('rows')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'rows' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização em Lista"
            >
              <List size={18} />
            </button>
          </div>

          <div className="h-full w-[1px] bg-slate-200/50 hidden md:block mx-1"></div>

          <div className="relative h-full" ref={calendarRef}>
            <div className="flex items-center bg-white/50 rounded-xl p-1 shadow-sm h-full">
              <button 
                onClick={() => handleMonthChange(-1)}
                className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              
              <button 
                onClick={() => {
                   setShowCalendar(!showCalendar);
                   setCalendarYear(parseInt(monthFilter.split('-')[0]));
                }}
                className="px-4 text-center text-xs font-bold text-slate-700 hover:text-[#04a7bd] transition-colors flex items-center justify-center gap-2 whitespace-nowrap min-w-[120px]"
              >
                {formatMonth(monthFilter)}
                <ChevronDown size={12} className={`transition-transform duration-200 ${showCalendar ? 'rotate-180' : ''}`} />
              </button>

              <button 
                onClick={() => handleMonthChange(1)}
                className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {showCalendar && (
              <div className="absolute top-full right-0 mt-2 w-72 glass-panel p-4 rounded-2xl shadow-xl animate-[scaleIn_0.15s_ease-out] border border-white/70 z-50 bg-white/90">
                <div className="flex items-center justify-between mb-4 px-1">
                  <button onClick={() => setCalendarYear(y => y - 1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <ChevronLeft size={20} />
                  </button>
                  <span className="font-bold text-lg text-slate-800">{calendarYear}</span>
                  <button onClick={() => setCalendarYear(y => y + 1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {monthNames.map((name, index) => {
                    const isSelected = parseInt(monthFilter.split('-')[1]) === index + 1 && parseInt(monthFilter.split('-')[0]) === calendarYear;
                    const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === calendarYear;
                    
                    return (
                      <button
                        key={name}
                        onClick={() => selectMonthFromCalendar(index)}
                        className={`
                          py-2 rounded-xl text-sm font-medium transition-all
                          ${isSelected 
                            ? 'bg-[#050a30] text-white shadow-lg' 
                            : isCurrentMonth 
                              ? 'bg-cyan-50 text-[#04a7bd] border border-cyan-100'
                              : 'hover:bg-slate-100 text-slate-600'}
                        `}
                      >
                        {name.substring(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative h-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Filter size={14} />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/50 hover:bg-white h-full pl-9 pr-8 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#04a7bd]/20 transition-all appearance-none cursor-pointer w-full md:w-36"
            >
              <option value="todos">Todos</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="vencido">Vencido</option>
              <option value="vencendo">Vencendo</option>
              <option value="aguardando">Aguardando</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#04a7bd]"></div>
        </div>
      ) : filteredDespesas.length === 0 ? (
        <div className="text-center py-20 text-slate-400 glass-panel rounded-[24px]">
          <p>Nenhuma despesa encontrada para os filtros selecionados.</p>
        </div>
      ) : (
        <>
        {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
          
          {specialProviderCards.map((card, idx) => (
             <div 
                key={`sp-${idx}`} 
                onClick={() => openProviderModal(card)}
                className="glass-panel p-6 rounded-[24px] relative group hover:bg-cyan-50/50 transition-all hover:translate-y-[-4px] duration-300 border border-cyan-200 border-opacity-50 overflow-hidden shadow-sm shadow-cyan-100/50 cursor-pointer"
             >
                 <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-100/50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                 
                 <div className="relative z-10">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-100 flex items-center justify-center shadow-sm text-[#04a7bd] shrink-0">
                           <UserCog size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                           <div className="flex items-center justify-between">
                             <h3 className="font-bold text-slate-800 leading-tight truncate" title={card.fornecedor}>
                                {card.fornecedor}
                             </h3>
                             <ArrowRight size={16} className="text-[#04a7bd] opacity-0 group-hover:opacity-100 transition-opacity" />
                           </div>
                           <p className="text-xs text-[#04a7bd] font-bold uppercase tracking-wider">Prestador de Serviço</p>
                        </div>
                     </div>

                     <div className="mb-6">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total a Pagar</p>
                        <p className="text-3xl font-bold text-slate-800 tracking-tight">
                           {formatCurrency(card.total)}
                        </p>
                     </div>

                     <div className="bg-white/40 p-3 rounded-2xl border border-cyan-100/50 flex items-center gap-3">
                         <div className="p-2 bg-cyan-100 rounded-full text-[#04a7bd]">
                            <Users size={14} />
                         </div>
                         <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Atendimentos</p>
                            <p className="text-sm font-bold text-slate-700">{card.count} registros</p>
                         </div>
                     </div>
                 </div>
             </div>
          ))}

          {regularDespesas.map((despesa) => {
            const status = getStatusInfo(despesa);
            const isPaid = despesa.status?.toLowerCase() === 'pago';

            return (
              <div key={despesa.id} className={`glass-panel p-6 rounded-[24px] relative group hover:bg-white/80 transition-all hover:translate-y-[-4px] duration-300 border ${status.borderColor} border-opacity-50 overflow-hidden`}>
                
                <div className={`absolute top-4 right-4 z-10 flex flex-col items-end gap-1`}>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/50 shadow-sm whitespace-nowrap ${status.bgPill} ${status.textColor}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></div>
                        <span className="text-xs font-bold uppercase tracking-wider">{status.label}</span>
                    </div>
                    {despesa.recorrente && (
                       <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/50 shadow-sm bg-purple-50 text-purple-600">
                          <RefreshCw size={10} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Recorrente</span>
                       </div>
                    )}
                </div>

                <div className="flex items-start mb-6">
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm text-red-400 shrink-0">
                      <TrendingDown size={20} />
                    </div>
                    <div className="min-w-0 pr-24">
                      <h3 className="font-bold text-slate-800 leading-tight truncate" title={despesa.nome || 'Sem Nome'}>
                        {despesa.nome || 'Despesa'}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium truncate">{despesa.responsavel}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Valor</p>
                  <p className="text-3xl font-bold text-slate-800 tracking-tight">
                    {formatCurrency(despesa.valor)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                     {despesa.fornecedor && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                           <Briefcase size={12} /> {despesa.fornecedor}
                        </p>
                     )}
                     {despesa.categoria && (
                        <p className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 truncate">
                           {despesa.categoria}
                        </p>
                     )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/40 p-3 rounded-2xl border border-white/50">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <Calendar size={12} />
                      <span className="text-xs font-bold uppercase">Vencimento</span>
                    </div>
                    <p className={`text-sm font-semibold truncate ${status.label === 'Vencido' ? 'text-red-500' : (status.label === 'Vencendo' ? 'text-orange-500' : 'text-slate-700')}`}>
                      {formatDate(despesa.data_projetada)}
                    </p>
                  </div>
                  <div className="bg-white/40 p-3 rounded-2xl border border-white/50">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                      <CreditCard size={12} />
                      <span className="text-xs font-bold uppercase">Pagamento</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      {despesa.forma_pagamento || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium bg-slate-100/50 px-3 py-1.5 rounded-full truncate max-w-[120px]">
                    <Tag size={14} />
                    <span className="truncate">{despesa.centro_custos || 'Geral'}</span>
                  </div>
                  
                  {despesa.qnt_parcela && despesa.qnt_parcela > 1 && (
                     <div className="flex items-center gap-1 text-slate-400 text-xs font-medium bg-slate-100/50 px-3 py-1.5 rounded-full">
                       <Layers size={14} />
                       <span>{despesa.qnt_parcela}x</span>
                     </div>
                  )}

                  <div className="flex items-center gap-2">
                     {!isPaid && (
                        <button 
                          onClick={() => handleMarkAsPaid(despesa)}
                          className="group h-10 bg-[#149890] hover:bg-teal-700 text-white rounded-full flex items-center transition-all duration-300 shadow-lg shadow-[#149890]/30 overflow-hidden w-10 hover:w-[160px]"
                          title="Marcar como Pago"
                        >
                           <div className="w-10 h-10 flex items-center justify-center shrink-0">
                              <Check size={18} strokeWidth={3} />
                           </div>
                           <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap text-xs font-bold pr-4 transition-opacity duration-300 delay-75">
                              Marcar como Pago
                           </span>
                        </button>
                     )}
                     <button 
                        onClick={() => handleEdit(despesa)}
                        className="w-10 h-10 rounded-full bg-white text-slate-400 flex items-center justify-center hover:text-[#04a7bd] hover:bg-cyan-50 transition-all shadow-sm border border-slate-100"
                        title="Editar"
                      >
                        <Edit size={16} />
                     </button>
                     <button 
                        onClick={() => handleDelete(despesa.id)}
                        className="w-10 h-10 rounded-full bg-white text-slate-400 flex items-center justify-center hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-slate-100"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                     </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
        ) : (
          <div className="glass-panel rounded-[32px] overflow-hidden pb-4">
               <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-4">Nome / Fornecedor</div>
                  <div className="col-span-2">Categoria</div>
                  <div className="col-span-2">Vencimento</div>
                  <div className="col-span-2">Valor</div>
                  <div className="col-span-2 text-right">Ações</div>
               </div>

               <div className="divide-y divide-slate-100">
                  {filteredDespesas.map(despesa => {
                    const status = getStatusInfo(despesa);
                    const isPaid = despesa.status?.toLowerCase() === 'pago';
                    const isProviderService = despesa.desc === "Atendimento por prestador";

                    return (
                       <div key={despesa.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/60 transition-colors items-center group ${isProviderService ? 'bg-cyan-50/20' : ''}`}>
                          
                          <div className="col-span-1 md:col-span-4 flex items-center gap-3 overflow-hidden">
                             <div className={`w-2 h-10 rounded-full shrink-0 ${status.dotColor}`}></div>
                             <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-700 truncate text-sm md:text-base">{despesa.nome || 'Despesa'}</p>
                                  {isProviderService && <UserCog size={14} className="text-[#04a7bd]" />}
                                </div>
                                <div className="flex items-center gap-2">
                                  {despesa.fornecedor && <span className="text-xs text-slate-500 truncate">{despesa.fornecedor}</span>}
                                  {despesa.recorrente && <RefreshCw size={10} className="text-purple-500" />}
                                  <span className={`md:hidden px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${status.bgPill} ${status.textColor}`}>{status.label}</span>
                                </div>
                             </div>
                          </div>

                          <div className="col-span-1 md:col-span-2 flex flex-col justify-center">
                              {despesa.categoria ? (
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md w-fit">
                                  {despesa.categoria}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                              <span className="text-[10px] text-slate-400 mt-0.5">{despesa.centro_custos}</span>
                          </div>

                          <div className="col-span-1 md:col-span-2 flex items-center gap-2 text-sm">
                              <Calendar size={14} className="text-slate-400 md:hidden" />
                              <span className={`font-medium ${status.label === 'Vencido' ? 'text-red-500' : 'text-slate-600'}`}>
                                {formatDate(despesa.data_projetada)}
                              </span>
                          </div>

                          <div className="col-span-1 md:col-span-2">
                              <p className="font-bold text-slate-800 text-sm md:text-base">{formatCurrency(despesa.valor)}</p>
                              {despesa.qnt_parcela && despesa.qnt_parcela > 1 && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Layers size={10} /> {despesa.qnt_parcela}x
                                  </span>
                              )}
                          </div>

                        <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                             {!isPaid && (
                                <button 
                                  onClick={() => handleMarkAsPaid(despesa)}
                                  className="w-8 h-8 rounded-full bg-teal-100 text-[#149890] flex items-center justify-center hover:bg-[#149890] hover:text-white transition-all shadow-sm"
                                  title="Marcar como Pago"
                                >
                                  <Check size={14} strokeWidth={3} />
                                </button>
                             )}
                             <button 
                                onClick={() => handleEdit(despesa)}
                                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-[#04a7bd] hover:border-cyan-200 transition-all shadow-sm"
                                title="Editar"
                              >
                                <Edit size={14} />
                             </button>
                             <button 
                                onClick={() => handleDelete(despesa.id)}
                                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                             </button>
                        </div>

                       </div>
                    );
                  })}
               </div>
          </div>
        )}
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-lg rounded-[32px] relative z-10 p-8 animate-[scaleIn_0.2s_ease-out] bg-white/80 shadow-2xl border border-white/60 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-[#050a30]">{editingId ? 'Editar Despesa' : 'Nova Despesa'}</h3>
                <p className="text-slate-500 text-sm">Registre ou altere uma saída financeira</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="bg-slate-100/50 p-1.5 rounded-2xl flex relative">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, responsavel: 'Gama Medicina'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${formData.responsavel === 'Gama Medicina' ? 'bg-white shadow-sm text-[#050a30]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Gama Medicina
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, responsavel: 'Gama Soluções'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${formData.responsavel === 'Gama Soluções' ? 'bg-white shadow-sm text-[#050a30]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Gama Soluções
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Título / Nome</label>
                <input 
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="glass-input w-full p-4 rounded-2xl font-medium bg-white/50"
                  placeholder="Ex: Compra de Materiais"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Valor Total</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={formData.valor}
                      onChange={(e) => setFormData({...formData, valor: e.target.value})}
                      className="glass-input w-full p-4 rounded-2xl font-semibold bg-white/50"
                      placeholder="0.00"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Parcelas</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={formData.qnt_parcela}
                      onChange={(e) => setFormData({...formData, qnt_parcela: e.target.value})}
                      className="glass-input w-full p-4 rounded-2xl bg-white/50"
                      placeholder="1"
                      disabled={formData.recorrente} 
                    />
                 </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Vencimento (1ª Parc.)</label>
                <input 
                  type="date"
                  required
                  value={formData.data_projetada}
                  onChange={(e) => setFormData({...formData, data_projetada: e.target.value})}
                  className="glass-input w-full p-4 rounded-2xl bg-white/50 text-slate-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Fornecedor</label>
                <input 
                  type="text"
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({...formData, fornecedor: e.target.value})}
                  className="glass-input w-full p-4 rounded-2xl bg-white/50"
                  placeholder="Nome do fornecedor"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 
                 <div className="space-y-1 col-span-2 md:col-span-1">
                   {!editingId && (
                       <button 
                         type="button"
                         onClick={() => setIsSplitMode(!isSplitMode)}
                         className={`w-full mb-2 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-wide shadow-sm
                            ${isSplitMode 
                                ? 'bg-[#04a7bd] text-white shadow-cyan-200' 
                                : 'bg-white border-2 border-cyan-50 text-[#04a7bd] hover:bg-cyan-50'}`}
                       >
                         {isSplitMode ? <Check size={16} /> : <Split size={16} />}
                         {isSplitMode ? 'Divisão Ativada' : 'Dividir Despesa'}
                       </button>
                   )}

                   {isSplitMode ? (
                      <div className="glass-panel p-4 rounded-2xl border border-cyan-100 bg-cyan-50/30 w-[200%] md:w-[200%] relative z-10 -ml-[0%] md:-ml-[0%]">
                          
                          <div className="mb-4">
                              <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#04a7bd]">Total Distribuído</span>
                                  <span className={`text-sm font-bold ${totalSplitPercent > 100 ? 'text-red-500' : (totalSplitPercent === 100 ? 'text-green-600' : 'text-[#04a7bd]')}`}>
                                      {totalSplitPercent.toFixed(0)}%
                                  </span>
                              </div>
                              <div className="h-2 w-full bg-white rounded-full overflow-hidden shadow-inner">
                                  <div 
                                    className={`h-full transition-all duration-300 ${totalSplitPercent > 100 ? 'bg-red-500' : (totalSplitPercent === 100 ? 'bg-green-500' : 'bg-[#04a7bd]')}`}
                                    style={{ width: `${Math.min(totalSplitPercent, 100)}%` }}
                                  ></div>
                              </div>
                              {totalSplitPercent > 100 && (
                                  <div className="flex items-center gap-1 mt-2 text-xs font-bold text-red-500 animate-pulse bg-red-100 px-2 py-1 rounded-lg w-fit">
                                      <AlertTriangle size={12} />
                                      Total excede 100%
                                  </div>
                              )}
                          </div>

                          <div className="space-y-4">
                             {CATEGORIES_LIST.map(cat => {
                                 const val = formData.valor ? parseFloat(formData.valor) : 0;
                                 const perc = parseFloat(splitPercentages[cat] || '0');
                                 const calcVal = (val * (perc / 100)).toFixed(2);

                                 return (
                                     <div key={cat} className="flex items-center gap-4 bg-white/60 p-2 rounded-xl">
                                         <span className="text-xs font-bold text-slate-600 w-24 truncate uppercase tracking-tight">{cat}</span>
                                         <div className="relative flex-1">
                                             <input 
                                                type="number" 
                                                min="0"
                                                max="100"
                                                placeholder="0"
                                                value={splitPercentages[cat] || ''}
                                                onChange={(e) => updateSplitPercentage(cat, e.target.value)}
                                                className={`w-full bg-slate-50 border-2 rounded-xl h-14 text-center text-2xl font-bold text-slate-900 focus:outline-none transition-all placeholder-slate-300
                                                    ${totalSplitPercent > 100 && perc > 0 ? 'border-red-300 focus:border-red-400 bg-red-50' : 'border-cyan-100 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'}
                                                    [&::-webkit-inner-spin-button]:appearance-none
                                                `}
                                             />
                                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">%</span>
                                         </div>
                                         <div className="w-24 text-right">
                                             <span className="block text-[10px] text-slate-400 uppercase font-bold">Valor</span>
                                             <span className="text-sm font-bold text-slate-800">R$ {perc > 0 ? calcVal : '0.00'}</span>
                                         </div>
                                     </div>
                                 );
                             })}
                          </div>
                      </div>
                   ) : (
                       <div className="relative mt-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Categoria</label>
                          <select 
                            className="glass-input w-full p-4 rounded-2xl appearance-none bg-white/50"
                            value={formData.categoria}
                            onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                          >
                            <option value="" className="text-slate-400">Selecione...</option>
                            <option value="Segurança">Segurança</option>
                            <option value="Investimento">Investimento</option>
                            <option value="Medicina">Medicina</option>
                            <option value="Operacional">Operacional</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 mt-3">
                            <ChevronDown size={14} />
                          </div>
                       </div>
                   )}
                 </div>

                 <div className="space-y-1 col-span-2 md:col-span-1">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Pagamento</label>
                   <div className="relative mt-1">
                      <select 
                        className="glass-input w-full p-4 rounded-2xl appearance-none bg-white/50"
                        value={formData.forma_pagamento}
                        onChange={(e) => setFormData({...formData, forma_pagamento: e.target.value})}
                      >
                        <option value="" className="text-slate-400">Selecione...</option>
                        <option value="Pix">Pix</option>
                        <option value="Boleto">Boleto</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Transferência">Transferência</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                   </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Centro de Custos</label>
                   <div className="relative">
                      <select 
                        className="glass-input w-full p-4 rounded-2xl appearance-none bg-white/50"
                        value={formData.centro_custos}
                        onChange={(e) => setFormData({...formData, centro_custos: e.target.value})}
                      >
                        <option value="" className="text-slate-400">Selecione...</option>
                        <option value="Fixo">Fixo</option>
                        <option value="Variavel">Variável</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                   </div>
                 </div>

                 <div className="flex items-center gap-3 bg-white/40 p-3 rounded-2xl border border-white/50 mt-5">
                    <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name="toggle" 
                            id="toggle-recorrente" 
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            checked={formData.recorrente}
                            onChange={(e) => setFormData({...formData, recorrente: e.target.checked})}
                            style={{
                                right: formData.recorrente ? '2px' : 'auto',
                                left: formData.recorrente ? 'auto' : '2px',
                                top: '4px',
                                borderColor: 'transparent',
                                transition: 'all 0.3s'
                            }}
                        />
                        <label 
                            htmlFor="toggle-recorrente" 
                            className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${formData.recorrente ? 'bg-purple-500' : 'bg-slate-300'}`}
                        ></label>
                    </div>
                    <label htmlFor="toggle-recorrente" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                        Recorrente Mensal
                    </label>
                 </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Descrição</label>
                <textarea 
                  value={formData.desc}
                  onChange={(e) => setFormData({...formData, desc: e.target.value})}
                  className="glass-input w-full p-4 rounded-2xl h-20 resize-none bg-white/50"
                  placeholder="Detalhes opcionais..."
                ></textarea>
              </div>

              <button 
                type="submit"
                disabled={submitting || (isSplitMode && Math.abs(totalSplitPercent - 100) > 0.1)}
                className={`w-full py-4 rounded-2xl font-bold transition-all shadow-xl active:scale-[0.98] mt-2
                    ${(isSplitMode && Math.abs(totalSplitPercent - 100) > 0.1) 
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                        : 'bg-[#050a30] text-white hover:bg-[#030720] shadow-[#050a30]/20'}
                `}
              >
                {submitting ? 'Salvando...' : (editingId ? 'Atualizar Despesa' : 'Adicionar Despesa')}
              </button>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Despesas;