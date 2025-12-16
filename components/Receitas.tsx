import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FinanceiroReceita, Cliente } from '../types';
import { 
  Plus, Trash2, Calendar, Building2, Layers, CheckCircle, 
  X, Check, Search, Filter, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, Edit, LayoutGrid, List, Stethoscope 
} from 'lucide-react';

const Receitas: React.FC = () => {
  const [receitas, setReceitas] = useState<FinanceiroReceita[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Snapshot Item State for Editing
  const [snapshotItems, setSnapshotItems] = useState<{name: string, value: string}[]>([]);

  // View Mode State
  const [viewMode, setViewMode] = useState<'cards' | 'rows'>('cards');

  // Calendar State
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Initialize with current month YYYY-MM
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 0, 1).toISOString().slice(0, 7);
  });
  
  // State for the custom calendar year navigation
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Form State
  const [formData, setFormData] = useState({
    empresa_resp: 'Gama Medicina',
    contratante: '',
    valor_total: '',
    qnt_parcela: '1',
    data_projetada: '',
    data_executada: '',
    descricao: ''
  });

  const fetchBaseData = async () => {
    try {
      setLoading(true);
      
      const { data: receitasData, error: receitasError } = await supabase
        .from('financeiro_receitas')
        .select(`
          *,
          clientes:contratante (
            id,
            nome_fantasia,
            razao_social
          )
        `)
        .order('data_projetada', { ascending: true });

      if (receitasError) throw receitasError;
      setReceitas(receitasData as any || []);

      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome_fantasia, razao_social')
        .order('nome_fantasia', { ascending: true });
      
      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

    } catch (error: any) {
      console.error('Error fetching data:', error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  // Close calendar when clicking outside
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

  // Sync calendar year when monthFilter changes externally
  useEffect(() => {
    if (monthFilter) {
      setCalendarYear(parseInt(monthFilter.split('-')[0]));
    }
  }, [monthFilter]);

  // --- Logic Helpers ---

  const getStatusInfo = (receita: FinanceiroReceita) => {
    const statusDb = receita.status?.toLowerCase() || '';

    if (statusDb === 'pago') {
      return { 
        label: 'Pago', 
        textColor: 'text-green-600',
        dotColor: 'bg-green-500',
        bgPill: 'bg-green-100',
        borderColor: 'border-green-200'
      };
    }
    
    if (!receita.data_projetada) {
      return { 
        label: 'Pendente', 
        textColor: 'text-slate-500',
        dotColor: 'bg-slate-400',
        bgPill: 'bg-slate-100',
        borderColor: 'border-slate-200'
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const dueDate = receita.data_projetada.split('T')[0];

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
      textColor: 'text-blue-600',
      dotColor: 'bg-blue-500',
      bgPill: 'bg-blue-100',
      borderColor: 'border-blue-200'
    };
  };

  const getClienteName = (receita: FinanceiroReceita) => {
    if (receita.clientes?.nome_fantasia) return receita.clientes.nome_fantasia;
    if (receita.clientes?.razao_social) return receita.clientes.razao_social;
    return 'Cliente não identificado';
  };

  // --- Month Navigation Logic ---

  const handleMonthChange = (step: number) => {
    if (!monthFilter) return;
    const [year, month] = monthFilter.split('-').map(Number);
    const date = new Date(year, month - 1 + step, 1);
    const newStr = date.toISOString().slice(0, 7);
    setMonthFilter(newStr);
  };

  const selectMonthFromCalendar = (monthIndex: number) => {
    // monthIndex is 0-11
    const newMonth = new Date(calendarYear, monthIndex, 1);
    setMonthFilter(newMonth.toISOString().slice(0, 7));
    setShowCalendar(false);
  };

  // --- Filter Logic ---

  // 1. KPI Data: Filters ONLY by Month
  const kpiReceitas = useMemo(() => {
    return receitas.filter(r => {
      if (!r.data_projetada) return false;
      const rDate = r.data_projetada.slice(0, 7);
      return rDate === monthFilter;
    });
  }, [receitas, monthFilter]);

  // 2. Grid Data: Filters by Month + Search + Status
  const filteredReceitas = useMemo(() => {
    return receitas.filter(r => {
      // Month
      if (!r.data_projetada && monthFilter) return false;
      const rDate = r.data_projetada ? r.data_projetada.slice(0, 7) : '';
      const matchesMonth = monthFilter ? rDate === monthFilter : true;

      // Search
      const clientName = getClienteName(r).toLowerCase();
      const matchesSearch = clientName.includes(searchTerm.toLowerCase());

      // Status
      const statusInfo = getStatusInfo(r);
      const matchesStatus = statusFilter === 'todos' 
        ? true 
        : statusInfo.label.toLowerCase() === statusFilter.toLowerCase();

      return matchesMonth && matchesSearch && matchesStatus;
    });
  }, [receitas, monthFilter, searchTerm, statusFilter]);

  // --- KPI Calculations ---

  const kpis = useMemo(() => {
    let total = 0;
    let received = 0;
    let pending = 0;

    kpiReceitas.forEach(r => {
      const val = r.valor_total || 0;
      const isPaid = r.status?.toLowerCase() === 'pago';
      
      total += val;
      if (isPaid) {
        received += val;
      } else {
        pending += val;
      }
    });

    return { total, received, pending };
  }, [kpiReceitas]);


  // --- Actions ---

  const handleOpenNew = () => {
    setEditingId(null);
    setSnapshotItems([]);
    setFormData({
      empresa_resp: 'Gama Medicina',
      contratante: '',
      valor_total: '',
      qnt_parcela: '1',
      data_projetada: '',
      data_executada: '',
      descricao: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = async (receita: FinanceiroReceita) => {
    setEditingId(receita.id);
    
    let initialSnapshotItems: {name: string, value: string}[] = [];

    // Check for exames_snapshot
    if (receita.exames_snapshot && Array.isArray(receita.exames_snapshot) && receita.exames_snapshot.length > 0) {
        
        // 1. Get List of Exam Names
        const examNames = receita.exames_snapshot.map((item: any) => 
            typeof item === 'string' ? item : item.name
        );

        // 2. Fetch Prices from `preco_exames` if client is set
        let priceMap: Record<string, number> = {};
        
        if (receita.contratante) {
            try {
                const { data: prices } = await supabase
                    .from('preco_exames')
                    .select('nome, preco')
                    .eq('empresaId', receita.contratante)
                    .in('nome', examNames);

                if (prices) {
                    prices.forEach((p: any) => {
                        priceMap[p.nome] = p.preco;
                    });
                }
            } catch (err) {
                console.error("Error fetching exam prices:", err);
            }
        }

        // 3. Map items, preferring saved value, fallback to table price, else 0
        initialSnapshotItems = receita.exames_snapshot.map((item: any) => {
            const name = typeof item === 'string' ? item : item.name;
            const savedValue = typeof item === 'object' && item.value ? parseFloat(item.value) : 0;
            
            // If saved value is 0, try to populate from table
            const tablePrice = priceMap[name] || 0;
            const finalValue = savedValue > 0 ? savedValue : tablePrice;

            return { name, value: finalValue > 0 ? finalValue.toString() : '' };
        });
    }
    
    setSnapshotItems(initialSnapshotItems);

    // Recalculate total from snapshot if original total is 0 (first edit)
    const snapshotTotal = initialSnapshotItems.reduce((acc, item) => acc + (parseFloat(item.value) || 0), 0);
    const displayTotal = receita.valor_total && receita.valor_total > 0 
        ? receita.valor_total.toString() 
        : (snapshotTotal > 0 ? snapshotTotal.toFixed(2) : '');

    setFormData({
      empresa_resp: receita.empresa_resp || 'Gama Medicina',
      contratante: receita.contratante || '',
      valor_total: displayTotal,
      qnt_parcela: receita.qnt_parcela?.toString() || '1',
      data_projetada: receita.data_projetada ? receita.data_projetada.split('T')[0] : '',
      // Only set data_executada if status is actually 'Pago'. Otherwise keep it empty.
      data_executada: (receita.status?.toLowerCase() === 'pago' && receita.data_executada) 
        ? receita.data_executada.split('T')[0] 
        : '',
      descricao: receita.descricao || ''
    });
    setIsModalOpen(true);
  };

  const handleSnapshotItemChange = (index: number, val: string) => {
      const newItems = [...snapshotItems];
      newItems[index].value = val;
      setSnapshotItems(newItems);

      // Recalculate total
      const totalSum = newItems.reduce((acc, item) => {
          const v = parseFloat(item.value);
          return acc + (isNaN(v) ? 0 : v);
      }, 0);

      // Update main value form only if > 0 (to avoid overwriting with 0 if just initializing)
      if (totalSum >= 0) {
          setFormData(prev => ({ ...prev, valor_total: totalSum.toFixed(2) }));
      }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta receita?')) return;
    try {
      const { error } = await supabase.from('financeiro_receitas').delete().eq('id', id);
      if (error) throw error;
      setReceitas(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert('Erro ao excluir receita.');
    }
  };

  const handleMarkAsPaid = async (receita: FinanceiroReceita) => {
    if (receita.status?.toLowerCase() === 'pago') return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('financeiro_receitas')
        .update({ status: 'Pago', data_executada: todayStr })
        .eq('id', receita.id);

      if (error) throw error;
      setReceitas(prev => prev.map(r => 
        r.id === receita.id ? { ...r, status: 'Pago', data_executada: todayStr } : r
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const totalValue = formData.valor_total ? parseFloat(formData.valor_total) : 0;
      const numInstallments = formData.qnt_parcela ? parseInt(formData.qnt_parcela) : 1;
      
      // Determine extra fields for snapshot and valor_med
      const snapshotFields = snapshotItems.length > 0 ? {
          valor_med: totalValue, // Update Medicine Value with the total of exams
          exames_snapshot: snapshotItems // Save the detailed list with values
      } : {};

      // LOGIC FOR UPDATE (EDIT)
      if (editingId) {
        // When editing, we typically update the single record.
        const payload = {
            empresa_resp: formData.empresa_resp,
            contratante: formData.contratante || null,
            valor_total: totalValue,
            qnt_parcela: numInstallments,
            data_projetada: formData.data_projetada || null,
            data_executada: formData.data_executada || null,
            descricao: formData.descricao,
            status: formData.data_executada ? 'Pago' : 'Pendente',
            ...snapshotFields
        };

        const { error } = await supabase
          .from('financeiro_receitas')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;

      } else {
        // LOGIC FOR CREATE (INSERT)
        const installmentValue = numInstallments > 0 ? totalValue / numInstallments : totalValue;
        const payloads = [];

        if (formData.data_projetada && numInstallments > 0) {
          const [y, m, d] = formData.data_projetada.split('-').map(Number);
          
          for (let i = 0; i < numInstallments; i++) {
            const dueDate = new Date(y, (m - 1) + i, d);
            const dueDateStr = dueDate.toISOString().split('T')[0];

            let desc = formData.descricao || '';
            if (numInstallments > 1) {
              desc = `${desc} (Parcela ${i + 1}/${numInstallments})`.trim();
            }

            payloads.push({
              empresa_resp: formData.empresa_resp,
              contratante: formData.contratante || null,
              valor_total: installmentValue,
              qnt_parcela: numInstallments,
              data_projetada: dueDateStr,
              data_executada: formData.data_executada || null,
              descricao: desc,
              status: formData.data_executada ? 'Pago' : 'Pendente',
              ...snapshotFields
            });
          }
        } else {
           payloads.push({
              empresa_resp: formData.empresa_resp,
              contratante: formData.contratante || null,
              valor_total: totalValue,
              qnt_parcela: 1,
              data_projetada: formData.data_projetada || null,
              data_executada: formData.data_executada || null,
              descricao: formData.descricao,
              status: formData.data_executada ? 'Pago' : 'Pendente',
              ...snapshotFields
            });
        }

        const { error } = await supabase.from('financeiro_receitas').insert(payloads);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchBaseData();

    } catch (error) {
      console.error('Error submitting:', error);
      alert('Erro ao salvar receita. Verifique os dados.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Formatters ---

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
      
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">Receitas</h2>
          <p className="text-slate-500 mt-1">
            Visão financeira de <span className="font-semibold text-slate-700">{formatMonth(monthFilter)}</span>
          </p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-full font-medium shadow-lg shadow-slate-900/20 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Nova Receita
        </button>
      </div>

      {/* KPI Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-1">Total Esperado</p>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(kpis.total)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <Layers size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-1">Recebido</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(kpis.received)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-slate-500 mb-1">Pendente</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(kpis.pending)}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-2 rounded-[20px] flex flex-col md:flex-row items-center gap-2 z-20 relative">
        <div className="flex-1 w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Buscar por cliente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent p-3 pl-10 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none rounded-xl hover:bg-white/40 transition-colors"
          />
        </div>

        <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

        <div className="flex w-full md:w-auto gap-2 h-10 items-center">
          
          {/* View Toggle */}
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

          {/* Custom Month Picker */}
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
                className="px-4 text-center text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 whitespace-nowrap min-w-[120px]"
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

            {/* In-App Custom Calendar Popover */}
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
                            ? 'bg-slate-800 text-white shadow-lg shadow-slate-900/20' 
                            : isCurrentMonth 
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
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
              className="bg-white/50 hover:bg-white h-full pl-9 pr-8 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer w-full md:w-36"
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

      {/* Grid or List Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredReceitas.length === 0 ? (
        <div className="text-center py-20 text-slate-400 glass-panel rounded-[24px]">
          <p>Nenhuma receita encontrada para os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {viewMode === 'cards' ? (
            /* CARD VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
              {filteredReceitas.map((receita) => {
                const status = getStatusInfo(receita);
                const isPaid = receita.status?.toLowerCase() === 'pago';

                return (
                  <div key={receita.id} className={`glass-panel p-6 rounded-[24px] relative group hover:bg-white/80 transition-all hover:translate-y-[-4px] duration-300 border ${status.borderColor} border-opacity-50 overflow-hidden`}>
                    
                    {/* Status Badge */}
                    <div className={`absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/50 shadow-sm whitespace-nowrap ${status.bgPill} ${status.textColor}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></div>
                        <span className="text-xs font-bold uppercase tracking-wider">{status.label}</span>
                    </div>

                    {/* Header: Company */}
                    <div className="flex items-start mb-6">
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm text-slate-400 shrink-0">
                          <Building2 size={20} />
                        </div>
                        <div className="min-w-0 pr-24">
                          <h3 className="font-bold text-slate-800 leading-tight truncate" title={getClienteName(receita)}>
                            {getClienteName(receita)}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium truncate">{receita.empresa_resp}</p>
                        </div>
                      </div>
                    </div>

                    {/* Main Value */}
                    <div className="mb-6">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Valor Total</p>
                      <p className="text-3xl font-bold text-slate-800 tracking-tight">
                        {formatCurrency(receita.valor_total)}
                      </p>
                      {receita.descricao && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-1 italic">{receita.descricao}</p>
                      )}
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white/40 p-3 rounded-2xl border border-white/50">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Calendar size={12} />
                          <span className="text-xs font-bold uppercase">Vencimento</span>
                        </div>
                        <p className={`text-sm font-semibold truncate ${status.label === 'Vencido' ? 'text-red-500' : (status.label === 'Vencendo' ? 'text-orange-500' : 'text-slate-700')}`}>
                          {formatDate(receita.data_projetada)}
                        </p>
                      </div>
                      <div className="bg-white/40 p-3 rounded-2xl border border-white/50">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <CheckCircle size={12} />
                          <span className="text-xs font-bold uppercase">Pago Em</span>
                        </div>
                        <p className={`text-sm font-semibold truncate ${isPaid ? 'text-green-600' : 'text-slate-300'}`}>
                          {formatDate(receita.data_executada)}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium bg-slate-100/50 px-3 py-1.5 rounded-full">
                        <Layers size={14} />
                        <span>{receita.qnt_parcela}x</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isPaid && (
                            <button 
                              onClick={() => handleMarkAsPaid(receita)}
                              className="group h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center transition-all duration-300 shadow-lg shadow-green-500/30 overflow-hidden w-10 hover:w-[200px]"
                              title="Confirmar Pagamento"
                            >
                              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                  <Check size={18} strokeWidth={3} />
                              </div>
                              <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap text-xs font-bold pr-4 transition-opacity duration-300 delay-75">
                                  Confirmar Pagamento
                              </span>
                            </button>
                        )}
                        <button 
                            onClick={() => handleEdit(receita)}
                            className="w-10 h-10 rounded-full bg-white text-slate-400 flex items-center justify-center hover:text-blue-500 hover:bg-blue-50 transition-all shadow-sm border border-slate-100"
                            title="Editar"
                          >
                            <Edit size={16} />
                        </button>
                        <button 
                            onClick={() => handleDelete(receita.id)}
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
            /* ROW VIEW (LIST) */
            <div className="glass-panel rounded-[32px] overflow-hidden pb-4">
               {/* Header Row */}
               <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-4">Cliente / Empresa</div>
                  <div className="col-span-2">Vencimento</div>
                  <div className="col-span-2">Pagamento</div>
                  <div className="col-span-2">Valor</div>
                  <div className="col-span-2 text-right">Ações</div>
               </div>
               
               <div className="divide-y divide-slate-100">
                  {filteredReceitas.map(receita => {
                    const status = getStatusInfo(receita);
                    const isPaid = receita.status?.toLowerCase() === 'pago';

                    return (
                      <div key={receita.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-white/60 transition-colors items-center group">
                        
                        {/* Column 1: Client & Company */}
                        <div className="col-span-1 md:col-span-4 flex items-center gap-3 overflow-hidden">
                           <div className={`w-2 h-10 rounded-full shrink-0 ${status.dotColor}`}></div>
                           <div className="min-w-0">
                              <p className="font-bold text-slate-700 truncate text-sm md:text-base">{getClienteName(receita)}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">{receita.empresa_resp}</span>
                                <span className={`md:hidden px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${status.bgPill} ${status.textColor}`}>{status.label}</span>
                              </div>
                           </div>
                        </div>

                        {/* Column 2: Due Date */}
                        <div className="col-span-1 md:col-span-2 flex items-center gap-2 text-sm">
                           <Calendar size={14} className="text-slate-400 md:hidden" />
                           <span className={`font-medium ${status.label === 'Vencido' ? 'text-red-500' : 'text-slate-600'}`}>
                             {formatDate(receita.data_projetada)}
                           </span>
                        </div>

                        {/* Column 3: Paid Date */}
                        <div className="col-span-1 md:col-span-2 flex items-center gap-2 text-sm">
                           <CheckCircle size={14} className="text-slate-400 md:hidden" />
                           <span className={isPaid ? 'text-green-600 font-medium' : 'text-slate-300'}>
                             {formatDate(receita.data_executada)}
                           </span>
                        </div>

                        {/* Column 4: Value */}
                        <div className="col-span-1 md:col-span-2">
                           <p className="font-bold text-slate-800 text-sm md:text-base">{formatCurrency(receita.valor_total)}</p>
                           {receita.qnt_parcela && receita.qnt_parcela > 1 && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Layers size={10} /> {receita.qnt_parcela}x
                              </span>
                           )}
                        </div>

                        {/* Column 5: Actions */}
                        <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                             {!isPaid && (
                                <button 
                                  onClick={() => handleMarkAsPaid(receita)}
                                  className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all shadow-sm"
                                  title="Confirmar Pagamento"
                                >
                                  <Check size={14} strokeWidth={3} />
                                </button>
                             )}
                             <button 
                                onClick={() => handleEdit(receita)}
                                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-blue-500 hover:border-blue-200 transition-all shadow-sm"
                                title="Editar"
                              >
                                <Edit size={14} />
                             </button>
                             <button 
                                onClick={() => handleDelete(receita.id)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-lg rounded-[32px] relative z-10 p-8 animate-[scaleIn_0.2s_ease-out] bg-white/80 shadow-2xl border border-white/60 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{editingId ? 'Editar Receita' : 'Nova Receita'}</h3>
                <p className="text-slate-500 text-sm">Preencha os dados abaixo</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Radio Group */}
              <div className="bg-slate-100/50 p-1.5 rounded-2xl flex relative">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, empresa_resp: 'Gama Medicina'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${formData.empresa_resp === 'Gama Medicina' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Gama Medicina
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, empresa_resp: 'Gama Soluções'})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${formData.empresa_resp === 'Gama Soluções' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Gama Soluções
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Cliente</label>
                <div className="relative">
                  <select 
                    className="glass-input w-full p-4 rounded-2xl appearance-none bg-white/50"
                    value={formData.contratante}
                    onChange={(e) => setFormData({...formData, contratante: e.target.value})}
                    required
                  >
                    <option value="" className="text-slate-400">Selecione o cliente...</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id} className="text-slate-800">
                        {cliente.nome_fantasia || cliente.razao_social || 'Sem Nome'}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Snapshot Exams List (If Available) */}
              {snapshotItems.length > 0 && (
                  <div className="space-y-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                          <Stethoscope size={16} />
                          <span className="text-xs font-bold uppercase tracking-wide">Detalhamento de Exames</span>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {snapshotItems.map((item, index) => (
                              <div key={index} className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-600 flex-1 truncate" title={item.name}>
                                      {item.name}
                                  </span>
                                  <div className="relative w-28">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                                      <input 
                                          type="number" 
                                          step="0.01"
                                          placeholder="0.00"
                                          value={item.value}
                                          onChange={(e) => handleSnapshotItemChange(index, e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-8 pr-2 text-xs font-bold text-right focus:outline-none focus:border-blue-400 transition-colors"
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">Soma automática aplicada ao total.</span>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Valor Total</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={formData.valor_total}
                    onChange={(e) => setFormData({...formData, valor_total: e.target.value})}
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
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Pago em</label>
                  <input 
                    type="date"
                    value={formData.data_executada}
                    onChange={(e) => setFormData({...formData, data_executada: e.target.value})}
                    className="glass-input w-full p-4 rounded-2xl bg-white/50 text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Descrição</label>
                <textarea 
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  className="glass-input w-full p-4 rounded-2xl h-24 resize-none bg-white/50"
                  placeholder="Detalhes opcionais..."
                ></textarea>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
              >
                {submitting ? 'Salvando...' : (editingId ? 'Atualizar Receita' : 'Adicionar Receita')}
              </button>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Receitas;