import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FinanceiroDespesa } from '../types';
import { 
  Plus, Trash2, Calendar, TrendingDown, Layers, CheckCircle, 
  X, Check, Search, Filter, ChevronLeft, ChevronRight, ChevronDown, Tag, CreditCard, Briefcase, RefreshCw, Edit, LayoutGrid, List, UserCog, Users, DollarSign, ArrowRight, Percent, Split, AlertTriangle, Building2, FileText, AlignLeft
} from 'lucide-react';

interface ProviderGroup {
  fornecedor: string;
  total: number;
  count: number;
  ids: number[];
  firstValue: number; 
}

interface Gerencia {
  id: number;
  descricao: string;
}

const Despesas: React.FC = () => {
  const [despesas, setDespesas] = useState<FinanceiroDespesa[]>([]);
  const [gerenciasList, setGerenciasList] = useState<Gerencia[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [isSplitMode, setIsSplitMode] = useState(false);
  // splitPercentages keys will now be the gerencia ID (as string)
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
    categoria: '', // Agora visualmente "Setor"
    nova_categoria: '', // Novo campo: Investimento, Custo fixo...
    gerencia_id: '', // Novo campo: ID da tabela gerencias
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
      
      // Fetch Gerencias
      const { data: gerenciasData, error: gerenciasError } = await supabase
        .from('gerencias')
        .select('id, descricao')
        .order('descricao');
      
      if (!gerenciasError && gerenciasData) {
        setGerenciasList(gerenciasData);
      }

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
        nova_categoria: '',
        gerencia_id: '',
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
    
    // Attempt to resolve Gerencia ID from centro_custos name
    const matchedGerencia = gerenciasList.find(g => g.descricao === despesa.centro_custos);
    const gId = matchedGerencia ? matchedGerencia.id.toString() : '';

    setFormData({
        nome: despesa.nome || '',
        desc: despesa.desc || '',
        fornecedor: despesa.fornecedor || '',
        categoria: despesa.categoria || '',
        nova_categoria: '', // Requires user to re-select if they want to update meta/logic
        gerencia_id: gId, 
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

  // Change: Key is now gerencia_id (string)
  const updateSplitPercentage = (id: string, value: string) => {
    setSplitPercentages(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const totalSplitPercent = useMemo(() => {
    return Object.values(splitPercentages).reduce((acc: number, val: any) => acc + (parseFloat(val as string) || 0), 0);
  }, [splitPercentages]);

  const updateGerenciaMeta = async (gerenciaId: number, categoria: string, valor: number, dateString: string) => {
      if (!gerenciaId || !categoria || !valor || !dateString) return;

      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      
      // Calculate start and end of that month
      const startOfMonth = new Date(year, month, 1).toISOString();
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const colMap: Record<string, string> = {
        'Investimento': 'in',
        'Custo fixo': 'cf',
        'Custo variavel': 'cv',
        'Despesa fixa': 'df',
        'Despesa variavel': 'dv'
      };

      const column = colMap[categoria];
      if (!column) return;

      try {
          // Check if row exists for this gerencia and month
          const { data: existingRows, error: fetchError } = await supabase
              .from('gerencia_meta')
              .select('*')
              .eq('gerencia', gerenciaId)
              .gte('created_at', startOfMonth)
              .lte('created_at', endOfMonth);
          
          if (fetchError) throw fetchError;

          if (existingRows && existingRows.length > 0) {
              // Update existing row (SUM)
              const row = existingRows[0];
              const currentVal = row[column] || 0;
              const newVal = currentVal + valor;

              const { error: updateError } = await supabase
                  .from('gerencia_meta')
                  .update({ [column]: newVal })
                  .eq('id', row.id);
              
              if (updateError) throw updateError;
          } else {
              // Create new row
              const { error: insertError } = await supabase
                  .from('gerencia_meta')
                  .insert({
                      gerencia: gerenciaId,
                      created_at: dateString, // Using the expense date as creation date for the meta record
                      [column]: valor,
                      faturamento: 0,
                      in: column === 'in' ? valor : 0,
                      cf: column === 'cf' ? valor : 0,
                      cv: column === 'cv' ? valor : 0,
                      df: column === 'df' ? valor : 0,
                      dv: column === 'dv' ? valor : 0
                  });
              
              if (insertError) throw insertError;
          }
      } catch (err) {
          console.error("Erro ao atualizar gerencia_meta:", err);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const totalValue = formData.valor ? parseFloat(formData.valor) : 0;
      const numInstallments = formData.qnt_parcela ? parseInt(formData.qnt_parcela) : 1;
      
      const payloads: any[] = [];
      const gerenciaUpdates: any[] = []; // Track updates for meta table

      // Modified to accept overrides for split logic
      const generatePayloads = (val: number, cat: string, specificGerenciaId?: number, specificGerenciaName?: string) => {
          const installmentValue = numInstallments > 0 ? val / numInstallments : val;
          const currentPayloads = [];

          // Use the specific gerencia ID if splitting, otherwise use the form's global ID
          const targetGerenciaId = specificGerenciaId || (formData.gerencia_id ? parseInt(formData.gerencia_id) : null);
          // If splitting, we override the centro_custos with the gerencia name so the user sees it in the list
          const targetCentroCustos = specificGerenciaName || formData.centro_custos;

          if (formData.data_projetada && numInstallments > 1) {
             const [y, m, d] = formData.data_projetada.split('-').map(Number);
             
             for (let i = 0; i < numInstallments; i++) {
               const dueDate = new Date(y, (m - 1) + i, d);
               const dueDateStr = dueDate.toISOString().split('T')[0];
  
               let desc = formData.desc || '';
               desc = `${desc} (Parcela ${i + 1}/${numInstallments})`.trim();
  
               const p = {
                 nome: formData.nome,
                 desc: desc,
                 fornecedor: formData.fornecedor,
                 categoria: cat, // "Setor" in UI
                 forma_pagamento: formData.forma_pagamento,
                 centro_custos: targetCentroCustos, 
                 responsavel: formData.responsavel,
                 valor: installmentValue,
                 data_projetada: dueDateStr,
                 status: formData.status,
                 qnt_parcela: numInstallments,
                 recorrente: formData.recorrente
               };
               currentPayloads.push(p);
               
               // Prepare meta update
               if (targetGerenciaId && formData.nova_categoria) {
                   gerenciaUpdates.push({
                       gerenciaId: targetGerenciaId,
                       categoria: formData.nova_categoria,
                       valor: installmentValue,
                       date: dueDateStr
                   });
               }
             }
          } else {
            const p = {
              nome: formData.nome,
              desc: formData.desc,
              fornecedor: formData.fornecedor,
              categoria: cat,
              forma_pagamento: formData.forma_pagamento,
              centro_custos: targetCentroCustos,
              responsavel: formData.responsavel,
              valor: val,
              data_projetada: formData.data_projetada || null,
              status: formData.status,
              qnt_parcela: 1,
              recorrente: formData.recorrente
            };
            currentPayloads.push(p);

            // Prepare meta update
            if (targetGerenciaId && formData.nova_categoria && formData.data_projetada) {
                 gerenciaUpdates.push({
                     gerenciaId: targetGerenciaId,
                     categoria: formData.nova_categoria,
                     valor: val,
                     date: formData.data_projetada
                 });
             }
          }
          return currentPayloads;
      };

      if (editingId && !isSplitMode) {
         // Normal Edit Mode (No Splitting)
         let finalCentroCustos = formData.centro_custos;
         if (formData.gerencia_id) {
             const g = gerenciasList.find(x => x.id.toString() === formData.gerencia_id);
             if (g) finalCentroCustos = g.descricao;
         }

         const payload = {
            nome: formData.nome,
            desc: formData.desc,
            fornecedor: formData.fornecedor,
            categoria: formData.categoria,
            forma_pagamento: formData.forma_pagamento,
            centro_custos: finalCentroCustos,
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

         // Note: We don't retroactively update gerencia_meta on simple edit as it requires complex reconciliation.
         // If user wants to update meta, they should use the split functionality or delete and recreate.

      } else {
        // Insert Mode OR Edit-with-Split Mode
        if (editingId && isSplitMode) {
            // If we are splitting an existing record, we delete the original and recreate as multiple records.
            const { error: delError } = await supabase.from('financeiro_despesas').delete().eq('id', editingId);
            if (delError) throw delError;
        }
        
        if (isSplitMode) {
             if (Math.abs(totalSplitPercent - 100) > 0.1) {
                 alert("A soma das porcentagens deve ser exatamente 100%.");
                 setSubmitting(false);
                 return;
             }

             // Iterate over gerencias to find which ones have percentage assigned
             gerenciasList.forEach(gerencia => {
                const perc = parseFloat(splitPercentages[gerencia.id.toString()] || '0');
                if (perc > 0) {
                    const splitVal = totalValue * (perc / 100);
                    // Generate payload for this specific Gerencia
                    // We use the same 'categoria' (Setor) for all, but different Gerencia/Cost Center
                    payloads.push(...generatePayloads(splitVal, formData.categoria, gerencia.id, gerencia.descricao));
                }
             });
             
             if (payloads.length === 0) {
                 // Fallback if something went wrong
                payloads.push(...generatePayloads(totalValue, formData.categoria));
             }

        } else {
             // Fallback for Insert without split
             // Resolve single gerencia name
             let singleGerenciaName = formData.centro_custos;
             if (formData.gerencia_id) {
                 const g = gerenciasList.find(x => x.id.toString() === formData.gerencia_id);
                 if (g) singleGerenciaName = g.descricao;
             }
             
             // We pass undefined for overrides so it uses formData normally, but we ensure centro_custos is set correctly
             // Actually generatePayloads uses formData.centro_custos if no override.
             // Let's override it to be safe if gerencia_id is selected.
             payloads.push(...generatePayloads(totalValue, formData.categoria, undefined, singleGerenciaName));
        }

        const { error } = await supabase.from('financeiro_despesas').insert(payloads);
        if (error) throw error;

        // Process Gerencia Meta Updates
        for (const update of gerenciaUpdates) {
            await updateGerenciaMeta(update.gerenciaId, update.categoria, update.valor, update.date);
        }
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
                  <div className="col-span-2">Setor</div>
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
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-5xl rounded-[32px] relative z-10 p-0 overflow-hidden bg-white/95 shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[95vh]">
            
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                <div>
                    <h3 className="text-2xl font-bold text-[#050a30]">{editingId ? 'Editar Despesa' : 'Nova Despesa'}</h3>
                    <p className="text-slate-500 text-sm">Preencha os detalhes do lançamento</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <form id="expenseForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full">
                    
                    {/* LEFT COLUMN: CORE DATA */}
                    <div className="lg:col-span-7 p-8 space-y-8 border-r border-slate-100">
                        
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                <UserCog size={12} /> Responsável
                            </label>
                            <div className="bg-slate-100/50 p-1.5 rounded-2xl flex relative">
                                <button
                                    type="button"
                                    onClick={() => setFormData({...formData, responsavel: 'Gama Medicina'})}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${formData.responsavel === 'Gama Medicina' ? 'bg-white shadow-sm text-[#050a30]' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Gama Medicina
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({...formData, responsavel: 'Gama Soluções'})}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${formData.responsavel === 'Gama Soluções' ? 'bg-white shadow-sm text-[#050a30]' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Gama Soluções
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                <FileText size={12} /> Título / Descrição Curta
                            </label>
                            <input 
                                type="text"
                                required
                                value={formData.nome}
                                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                                className="glass-input w-full p-4 rounded-2xl font-bold text-lg bg-white/50"
                                placeholder="Ex: Compra de Equipamentos"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                    <DollarSign size={12} /> Valor Total
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.valor}
                                        onChange={(e) => setFormData({...formData, valor: e.target.value})}
                                        className="glass-input w-full p-4 pl-10 rounded-2xl font-bold text-2xl text-slate-800 bg-white/50"
                                        placeholder="0.00"
                                    />
                                </div>
                             </div>
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                    <Layers size={12} /> Parcelas
                                </label>
                                <input 
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.qnt_parcela}
                                    onChange={(e) => setFormData({...formData, qnt_parcela: e.target.value})}
                                    className="glass-input w-full p-4 rounded-2xl font-bold bg-white/50"
                                    placeholder="1"
                                    disabled={formData.recorrente} 
                                />
                             </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                <Calendar size={12} /> Vencimento (1ª Parcela)
                            </label>
                            <input 
                                type="date"
                                required
                                value={formData.data_projetada}
                                onChange={(e) => setFormData({...formData, data_projetada: e.target.value})}
                                className="glass-input w-full p-4 rounded-2xl bg-white/50 text-slate-700 font-semibold"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                <AlignLeft size={12} /> Detalhes Opcionais
                            </label>
                            <textarea 
                                value={formData.desc}
                                onChange={(e) => setFormData({...formData, desc: e.target.value})}
                                className="glass-input w-full p-4 rounded-2xl h-24 resize-none bg-white/50 text-sm"
                                placeholder="Observações sobre a despesa..."
                            ></textarea>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: CONFIG & CLASSIFICATION */}
                    <div className="lg:col-span-5 bg-slate-50/50 p-8 space-y-8 flex flex-col">
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                <Briefcase size={12} /> Fornecedor
                            </label>
                            <input 
                                type="text"
                                value={formData.fornecedor}
                                onChange={(e) => setFormData({...formData, fornecedor: e.target.value})}
                                className="glass-input w-full p-4 rounded-2xl bg-white shadow-sm"
                                placeholder="Nome do fornecedor"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 flex items-center gap-1">
                                <CreditCard size={12} /> Forma de Pagamento
                            </label>
                            <div className="relative">
                                <select 
                                    className="glass-input w-full p-4 rounded-2xl appearance-none bg-white shadow-sm font-medium text-slate-700"
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
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                            </div>
                        </div>

                        {/* CONFIGURAÇÃO DE META / GERENCIA */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                            <div className="text-xs font-bold text-[#04a7bd] uppercase mb-2 flex items-center gap-2 pb-2 border-b border-slate-100">
                                <Building2 size={14} /> Classificação Gerencial
                            </div>

                            <div className="mb-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsSplitMode(!isSplitMode)}
                                    className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-wide border
                                        ${isSplitMode 
                                            ? 'bg-[#04a7bd] text-white border-[#04a7bd] shadow-md' 
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                >
                                    {isSplitMode ? <Check size={16} /> : <Split size={16} />}
                                    {isSplitMode ? 'Divisão por Gerência Ativa' : 'Dividir por Gerência'}
                                </button>
                            </div>

                            {!isSplitMode ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Gerência</label>
                                        <div className="relative">
                                            <select 
                                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold appearance-none focus:outline-none focus:border-[#04a7bd]"
                                                value={formData.gerencia_id}
                                                onChange={(e) => setFormData({...formData, gerencia_id: e.target.value})}
                                            >
                                                <option value="" className="text-slate-400">Selecione...</option>
                                                {gerenciasList.map(g => (
                                                    <option key={g.id} value={g.id}>{g.descricao}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Setor</label>
                                        <div className="relative">
                                            <select 
                                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold appearance-none focus:outline-none focus:border-[#04a7bd]"
                                                value={formData.categoria}
                                                onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                                            >
                                                <option value="" className="text-slate-400">Selecione...</option>
                                                <option value="Segurança">Segurança</option>
                                                <option value="Investimento">Investimento</option>
                                                <option value="Medicina">Medicina</option>
                                                <option value="Operacional">Operacional</option>
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Distribuição</span>
                                        <span className={`text-xs font-bold ${totalSplitPercent > 100 ? 'text-red-500' : (totalSplitPercent === 100 ? 'text-green-600' : 'text-[#04a7bd]')}`}>
                                            Total: {totalSplitPercent.toFixed(0)}%
                                        </span>
                                    </div>
                                    
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                        {gerenciasList.map(gerencia => (
                                            <div key={gerencia.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                <span className="text-xs font-semibold text-slate-600 truncate max-w-[120px]" title={gerencia.descricao}>{gerencia.descricao}</span>
                                                <div className="relative w-20">
                                                    <input 
                                                        type="number" 
                                                        min="0" max="100"
                                                        placeholder="0"
                                                        value={splitPercentages[gerencia.id.toString()] || ''}
                                                        onChange={(e) => updateSplitPercentage(gerencia.id.toString(), e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-lg py-1 pl-2 pr-6 text-xs font-bold text-center focus:outline-none focus:border-[#04a7bd]"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Setor is simpler in split mode, usually shared */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Setor (Geral)</label>
                                        <div className="relative">
                                            <select 
                                                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold appearance-none focus:outline-none focus:border-[#04a7bd]"
                                                value={formData.categoria}
                                                onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                                            >
                                                <option value="" className="text-slate-400">Selecione...</option>
                                                <option value="Segurança">Segurança</option>
                                                <option value="Investimento">Investimento</option>
                                                <option value="Medicina">Medicina</option>
                                                <option value="Operacional">Operacional</option>
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Categoria Financeira (Meta) */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Categoria Financeira</label>
                                <div className="relative">
                                    <select 
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold appearance-none focus:outline-none focus:border-[#04a7bd]"
                                        value={formData.nova_categoria}
                                        onChange={(e) => setFormData({...formData, nova_categoria: e.target.value})}
                                    >
                                        <option value="" className="text-slate-400">Selecione...</option>
                                        <option value="Investimento">Investimento</option>
                                        <option value="Custo fixo">Custo fixo</option>
                                        <option value="Custo variavel">Custo variavel</option>
                                        <option value="Despesa fixa">Despesa fixa</option>
                                        <option value="Despesa variavel">Despesa variavel</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* Old Cost Center & Recurring */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Centro Custos (Antigo)</label>
                                <div className="relative">
                                    <select 
                                        className="w-full p-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold appearance-none shadow-sm focus:outline-none focus:border-[#04a7bd]"
                                        value={formData.centro_custos}
                                        onChange={(e) => setFormData({...formData, centro_custos: e.target.value})}
                                    >
                                        <option value="" className="text-slate-400">Selecione...</option>
                                        <option value="Fixo">Fixo</option>
                                        <option value="Variavel">Variável</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-center bg-purple-50 rounded-xl border border-purple-100 p-2 cursor-pointer" onClick={() => setFormData({...formData, recorrente: !formData.recorrente})}>
                                <div className="flex items-center gap-2 select-none">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.recorrente ? 'bg-purple-600 border-purple-600' : 'bg-white border-purple-300'}`}>
                                        {formData.recorrente && <Check size={14} className="text-white" />}
                                    </div>
                                    <span className={`text-xs font-bold uppercase ${formData.recorrente ? 'text-purple-700' : 'text-purple-400'}`}>Recorrente Mensal</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </form>

            {/* Footer Actions */}
            <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                >
                    Cancelar
                </button>
                <button 
                    type="submit"
                    form="expenseForm"
                    disabled={submitting || (isSplitMode && Math.abs(totalSplitPercent - 100) > 0.1)}
                    className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center gap-2
                        ${(isSplitMode && Math.abs(totalSplitPercent - 100) > 0.1) 
                            ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                            : 'bg-[#050a30] hover:bg-[#030720] shadow-[#050a30]/20'}
                    `}
                >
                    {submitting ? 'Salvando...' : (
                        <>
                            <Check size={18} />
                            {editingId ? 'Atualizar Despesa' : 'Adicionar Despesa'}
                        </>
                    )}
                </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Despesas;