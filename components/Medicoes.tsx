import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Cliente, FinanceiroReceita } from '../types';
import { 
  Building2, Search, ChevronRight, ArrowLeft, Calendar, 
  CheckCircle, AlertCircle, Layers, TrendingUp, Filter, ChevronLeft, ChevronDown, Check, Plus, X, Share2, Copy, Clock, XCircle, Edit, Stethoscope, CloudUpload, FileText
} from 'lucide-react';

const Medicoes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Detail View
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteReceitas, setClienteReceitas] = useState<FinanceiroReceita[]>([]);
  const [loadingReceitas, setLoadingReceitas] = useState(false);

  // Local state for Client Settings Input (Controlled)
  const [clientEsocValue, setClientEsocValue] = useState<string>('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false); // Add Revenue Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); // Share Link Modal
  const [generatedLink, setGeneratedLink] = useState('');
  
  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  // Snapshot Item State for Editing
  const [snapshotItems, setSnapshotItems] = useState<{name: string, value: string}[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    empresa_resp: 'Gama Medicina',
    valor_total: '',
    valor_esoc: '', // Novo campo para o valor unitário do eSocial na RECEITA
    qnt_parcela: '1',
    data_projetada: '',
    data_executada: '',
    descricao: ''
  });

  // --- Date Filtering State ---
  const [viewMode, setViewMode] = useState<'recent' | 'monthly'>('recent'); // 'recent' = Current + Past Month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 7);
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

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

  // Sync calendar year
  useEffect(() => {
    if (selectedMonth) {
      setCalendarYear(parseInt(selectedMonth.split('-')[0]));
    }
  }, [selectedMonth]);

  // Sync Local Input State when Client Changes
  useEffect(() => {
    if (selectedCliente) {
        setClientEsocValue(selectedCliente.valor_esoc ? selectedCliente.valor_esoc.toString() : '29.90');
    }
  }, [selectedCliente]);


  // Fetch Clients on mount
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('nome_fantasia', { ascending: true });

        if (error) throw error;
        setClientes(data || []);
      } catch (error) {
        console.error('Error fetching clientes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, []);

  // Actions for Fetching
  const fetchReceitasDoCliente = async () => {
    if (!selectedCliente) return;

    try {
      setLoadingReceitas(true);
      let query = supabase
        .from('financeiro_receitas')
        .select('*')
        .eq('contratante', selectedCliente.id)
        .order('data_projetada', { ascending: false });

      // Date Logic
      const now = new Date();
      let startDateStr = '';
      let endDateStr = '';

      if (viewMode === 'recent') {
        // Current Month + Previous Month
        // 1st day of Previous Month
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDateStr = prevMonth.toISOString().split('T')[0];
        
        // Last day of Current Month
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDateStr = nextMonth.toISOString().split('T')[0];
      } else {
        // Specific Selected Month
        const [y, m] = selectedMonth.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0); // Last day of month
        startDateStr = start.toISOString().split('T')[0];
        endDateStr = end.toISOString().split('T')[0];
      }

      // Apply Date Filters
      query = query.gte('data_projetada', startDateStr).lte('data_projetada', endDateStr);

      const { data, error } = await query;

      if (error) throw error;
      setClienteReceitas(data as any || []);
    } catch (error) {
      console.error('Error fetching receitas:', error);
    } finally {
      setLoadingReceitas(false);
    }
  };

  // Fetch Revenues when client or date filters change
  useEffect(() => {
    fetchReceitasDoCliente();
  }, [selectedCliente, viewMode, selectedMonth]);

  // Actions
  const handleMarkAsPaid = async (receita: FinanceiroReceita) => {
    if (receita.status?.toLowerCase() === 'pago') return;
    
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('financeiro_receitas')
        .update({ status: 'Pago', data_executada: todayStr })
        .eq('id', receita.id);

      if (error) throw error;
      
      // Update local state
      setClienteReceitas(prev => prev.map(r => 
        r.id === receita.id ? { ...r, status: 'Pago', data_executada: todayStr } : r
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  // NEW: Toggle eSocial Function
  const handleToggleEsocial = async () => {
    if (!selectedCliente) return;

    const newValue = !selectedCliente.envia_esoc;
    let newDefaultValue = selectedCliente.valor_esoc;

    // Se estiver ativando e não tiver valor, define padrão 29.90
    if (newValue && (!newDefaultValue || newDefaultValue === 0)) {
        newDefaultValue = 29.90;
        setClientEsocValue('29.90'); // Update input visual immediately
    }

    // 1. Optimistic Update (Immediate Feedback)
    const updatedClient = { 
        ...selectedCliente, 
        envia_esoc: newValue,
        valor_esoc: newDefaultValue
    };
    setSelectedCliente(updatedClient);
    setClientes(prev => prev.map(c => c.id === selectedCliente.id ? updatedClient : c));

    try {
        const { error } = await supabase
            .from('clientes')
            .update({ 
                envia_esoc: newValue,
                valor_esoc: newDefaultValue
            })
            .eq('id', selectedCliente.id);

        if (error) throw error;
        
    } catch (err) {
        console.error("Erro ao atualizar eSocial:", err);
        alert("Erro ao salvar alteração do eSocial. Revertendo...");
        // Revert State
        setSelectedCliente(selectedCliente);
        setClientes(prev => prev.map(c => c.id === selectedCliente.id ? selectedCliente : c));
    }
  };

  // NEW: Update Client eSocial Value (Manual Change onBlur)
  const handleUpdateClientEsocValue = async () => {
      if (!selectedCliente) return;
      const numVal = parseFloat(clientEsocValue);
      if (isNaN(numVal)) return;

      // Only update if value changed
      if (numVal === selectedCliente.valor_esoc) return;

      // Optimistic Update
      const updatedClient = { ...selectedCliente, valor_esoc: numVal };
      setSelectedCliente(updatedClient);
      
      try {
          const { error } = await supabase
            .from('clientes')
            .update({ valor_esoc: numVal })
            .eq('id', selectedCliente.id);
          
          if (error) throw error;
      } catch (err) {
          console.error("Erro ao atualizar valor eSocial:", err);
      }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setSnapshotItems([]);
    
    // Auto-fill eSocial value from Client Settings if available
    let initialEsoc = '';
    if (selectedCliente && selectedCliente.envia_esoc && selectedCliente.valor_esoc) {
        initialEsoc = selectedCliente.valor_esoc.toString();
    } else if (selectedCliente && selectedCliente.envia_esoc) {
        initialEsoc = '29.90'; // Default fallback
    }

    setFormData({
      empresa_resp: 'Gama Medicina',
      valor_total: '',
      valor_esoc: initialEsoc,
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
        // ... Logic to load snapshot items
        const examNames = receita.exames_snapshot.map((item: any) => 
            typeof item === 'string' ? item : item.name
        );

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

        initialSnapshotItems = receita.exames_snapshot.map((item: any) => {
            const name = typeof item === 'string' ? item : item.name;
            const savedValue = typeof item === 'object' && item.value ? parseFloat(item.value) : 0;
            const tablePrice = priceMap[name] || 0;
            const finalValue = savedValue > 0 ? savedValue : tablePrice;
            return { name, value: finalValue > 0 ? finalValue.toString() : '' };
        });
    }

    setSnapshotItems(initialSnapshotItems);

    const snapshotTotal = initialSnapshotItems.reduce((acc, item) => acc + (parseFloat(item.value) || 0), 0);
    
    // LOGIC TO STRIP ESOCIAL FROM DISPLAY TOTAL IF "Atendimento -"
    // So the user sees the "Base Exam Value" in the Total field, and eSocial in the eSocial field
    let baseTotal = receita.valor_total || 0;
    const esocVal = receita.valor_esoc || 0;
    
    // If it's an "Atendimento" and has eSocial value saved, the total in DB includes (esocVal * 2).
    // We reverse this for display purposes.
    if (receita.descricao?.includes('Atendimento - ') && esocVal > 0) {
        baseTotal = baseTotal - (esocVal * 2);
        if (baseTotal < 0) baseTotal = 0; // Safety
    } else if (snapshotTotal > 0 && (!receita.valor_total || receita.valor_total === 0)) {
        // Fallback to snapshot if total is 0 (first edit scenario)
        baseTotal = snapshotTotal;
    }

    // Determine default eSocial value for the form if empty
    let finalEsocValue = '';
    if (esocVal > 0) {
        finalEsocValue = esocVal.toString();
    } else if (selectedCliente && selectedCliente.envia_esoc) {
        // Apply default if current is 0/empty but client has eSocial enabled
        finalEsocValue = selectedCliente.valor_esoc ? selectedCliente.valor_esoc.toString() : '29.90';
    }

    setFormData({
      empresa_resp: receita.empresa_resp || 'Gama Medicina',
      valor_total: baseTotal > 0 ? baseTotal.toFixed(2) : '',
      valor_esoc: finalEsocValue,
      qnt_parcela: receita.qnt_parcela?.toString() || '1',
      data_projetada: receita.data_projetada ? receita.data_projetada.split('T')[0] : '',
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

  const handleGenerateLink = async () => {
    if (!selectedCliente) return;

    try {
        const { error } = await supabase
            .from('clientes')
            .update({ status_medicao: 'Aguardando' })
            .eq('id', selectedCliente.id);

        if (error) throw error;

        const updatedClient = { ...selectedCliente, status_medicao: 'Aguardando' };
        setSelectedCliente(updatedClient);
        setClientes(prev => prev.map(c => c.id === selectedCliente.id ? updatedClient : c));

        const targetMonth = viewMode === 'monthly' ? selectedMonth : new Date().toISOString().slice(0, 7);
        const payload = {
            clientId: selectedCliente.id,
            month: targetMonth
        };

        const encodedData = btoa(JSON.stringify(payload));
        const baseUrl = window.location.origin;
        const link = `${baseUrl}?action=medicao&data=${encodedData}`;

        setGeneratedLink(link);
        setIsShareModalOpen(true);

    } catch (err) {
        console.error("Error generating link:", err);
        alert("Erro ao gerar link e atualizar status.");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    alert("Link copiado para a área de transferência!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente) return;
    
    setSubmitting(true);
    
    try {
      let baseTotalValue = formData.valor_total ? parseFloat(formData.valor_total) : 0;
      const numInstallments = formData.qnt_parcela ? parseInt(formData.qnt_parcela) : 1;
      const esocialUnitValue = formData.valor_esoc ? parseFloat(formData.valor_esoc) : 0;
      
      // LOGIC: If client sends eSocial AND description contains "Atendimento - ", add 2x eSocial value to total
      let finalTotalValue = baseTotalValue;
      
      if (selectedCliente.envia_esoc && formData.descricao.includes('Atendimento - ') && esocialUnitValue > 0) {
          finalTotalValue = baseTotalValue + (esocialUnitValue * 2);
      }

      // Determine extra fields for snapshot and valor_med
      const snapshotFields = snapshotItems.length > 0 ? {
          valor_med: finalTotalValue, // Update Medicine Value with the total
          exames_snapshot: snapshotItems 
      } : {};

      // LOGIC FOR UPDATE (EDIT)
      if (editingId) {
         const payload = {
            empresa_resp: formData.empresa_resp,
            contratante: selectedCliente.id,
            valor_total: finalTotalValue,
            valor_esoc: esocialUnitValue, // Save the unit value
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
        // LOGIC FOR INSERT (CREATE)
        const installmentValue = numInstallments > 0 ? finalTotalValue / numInstallments : finalTotalValue;
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
              contratante: selectedCliente.id, 
              valor_total: installmentValue,
              valor_esoc: esocialUnitValue,
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
              contratante: selectedCliente.id,
              valor_total: finalTotalValue,
              valor_esoc: esocialUnitValue,
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
      fetchReceitasDoCliente(); 

    } catch (error) {
      console.error('Error submitting:', error);
      alert('Erro ao salvar receita. Verifique os dados.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helpers
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

  const handleMonthChange = (step: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + step, 1);
    const newStr = date.toISOString().slice(0, 7);
    setSelectedMonth(newStr);
  };

  const selectMonthFromCalendar = (monthIndex: number) => {
    const newMonth = new Date(calendarYear, monthIndex, 1);
    setSelectedMonth(newMonth.toISOString().slice(0, 7));
    setShowCalendar(false);
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getStatusColor = (status: string | null, date: string | null) => {
    const s = status?.toLowerCase() || '';
    if (s === 'pago') return 'text-green-600 bg-green-100 border-green-200';
    
    if (date) {
      const today = new Date().toISOString().split('T')[0];
      const dueDate = date.split('T')[0];
      if (dueDate < today) return 'text-red-600 bg-red-100 border-red-200';
    }
    return 'text-blue-600 bg-blue-100 border-blue-200';
  };

  // Helper for Medição Status Logic
  const getMedicaoStatusInfo = (status: string | null | undefined) => {
      switch (status) {
          case 'Aceita':
              return { label: 'Medição Aceita', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle size={14} /> };
          case 'Recusada':
              return { label: 'Medição Recusada', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={14} /> };
          case 'Aguardando':
              return { label: 'Aguardando Aprovação', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock size={14} /> };
          default:
              return { label: 'Não enviada', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <AlertCircle size={14} /> };
      }
  };

  // Filter Clients
  const filteredClientes = useMemo(() => {
    return clientes.filter(c => 
      (c.nome_fantasia?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (c.razao_social?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [clientes, searchTerm]);

  // KPI Calculations for Selected Client
  const clientKpis = useMemo(() => {
    const total = clienteReceitas.reduce((acc, r) => acc + (r.valor_total || 0), 0);
    const paid = clienteReceitas
      .filter(r => r.status?.toLowerCase() === 'pago')
      .reduce((acc, r) => acc + (r.valor_total || 0), 0);
    const pending = total - paid;
    return { total, paid, pending };
  }, [clienteReceitas]);


  // --- VIEW 1: CLIENT LIST ---
  if (!selectedCliente) {
    return (
      <div className="p-6 relative min-h-full space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-800">Medições</h2>
            <p className="text-slate-500 mt-1">Selecione uma empresa para ver o histórico</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="glass-panel p-2 rounded-[20px] flex items-center gap-2 relative z-10">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Buscar empresa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent p-3 pl-10 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none rounded-xl hover:bg-white/40 transition-colors"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClientes.map((cliente) => {
               const statusInfo = getMedicaoStatusInfo(cliente.status_medicao);

               return (
                <div 
                  key={cliente.id} 
                  onClick={() => setSelectedCliente(cliente)}
                  className="glass-panel p-6 rounded-[24px] relative group hover:bg-white/80 transition-all hover:translate-y-[-4px] duration-300 cursor-pointer border border-white/60"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                      <Building2 size={24} />
                    </div>
                    {/* Status Badge */}
                    <div className={`px-2 py-1 rounded-lg border flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-800 line-clamp-1" title={cliente.nome_fantasia}>
                    {cliente.nome_fantasia || 'Sem Nome Fantasia'}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-1 mb-4">
                    {cliente.razao_social || 'Razão Social não informada'}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">
                      Ver Medições
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- VIEW 2: CLIENT DETAILS ---
  const detailStatusInfo = getMedicaoStatusInfo(selectedCliente.status_medicao);

  return (
    <div className="p-6 relative min-h-full space-y-6">
      
      {/* Header with Back Button and Add Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setSelectedCliente(null);
              setClienteReceitas([]);
              setViewMode('recent'); // Reset filter
            }}
            className="w-10 h-10 rounded-full bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
               <h2 className="text-2xl font-bold tracking-tight text-slate-800">
                {selectedCliente.nome_fantasia || selectedCliente.razao_social}
               </h2>
               <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${detailStatusInfo.color}`}>
                    {detailStatusInfo.icon}
                    {detailStatusInfo.label}
               </div>
            </div>
            
            <div className="flex items-start gap-4 mt-2">
                <p className="text-slate-500 text-sm mt-1">Histórico de Receitas e Medições</p>
                <span className="text-slate-300 mt-1">•</span>
                
                {/* ESOCIAL CONFIGURATION BLOCK */}
                <div className="flex flex-col items-start gap-1">
                    {/* TOGGLE */}
                    <div 
                        onClick={handleToggleEsocial}
                        className="flex items-center gap-2 cursor-pointer group select-none bg-white/50 px-2 py-0.5 rounded-lg border border-transparent hover:border-slate-200 transition-all"
                    >
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Envia eSocial?</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${selectedCliente.envia_esoc ? 'bg-green-500' : 'bg-slate-300'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${selectedCliente.envia_esoc ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${selectedCliente.envia_esoc ? 'text-green-600' : 'text-slate-400'}`}>
                            {selectedCliente.envia_esoc ? 'Sim' : 'Não'}
                        </span>
                    </div>

                    {/* INPUT FIELD (CONDITIONAL) */}
                    {selectedCliente.envia_esoc && (
                        <div className="flex items-center gap-2 animate-fadeIn bg-white/40 px-2 py-1 rounded-lg border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Valor Padrão:</span>
                            <div className="relative w-20">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={clientEsocValue}
                                    onChange={(e) => setClientEsocValue(e.target.value)}
                                    onBlur={handleUpdateClientEsocValue}
                                    className="w-full pl-5 pr-1 py-0.5 text-xs font-bold border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-700 bg-white bg-opacity-80"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleOpenNew}
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-full font-medium shadow-lg shadow-slate-900/20 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Nova Receita
        </button>
      </div>

      {/* Date Filter Controls */}
      <div className="glass-panel p-2 rounded-[20px] flex flex-col md:flex-row items-center gap-2 justify-between">
        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl w-full md:w-auto">
          <button 
            onClick={() => setViewMode('recent')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewMode === 'recent' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Atual e Anterior
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Selecionar Mês
          </button>
        </div>

        {viewMode === 'monthly' && (
          <div className="relative w-full md:w-auto" ref={calendarRef}>
             <div className="flex items-center bg-white/50 rounded-xl p-1 shadow-sm justify-between md:justify-start">
              <button 
                onClick={() => handleMonthChange(-1)}
                className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              
              <button 
                onClick={() => {
                   setShowCalendar(!showCalendar);
                   setCalendarYear(parseInt(selectedMonth.split('-')[0]));
                }}
                className="px-4 py-1.5 min-w-[150px] text-center text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                {formatMonth(selectedMonth)}
                <ChevronDown size={14} className={`transition-transform duration-200 ${showCalendar ? 'rotate-180' : ''}`} />
              </button>

              <button 
                onClick={() => handleMonthChange(1)}
                className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Calendar Popover */}
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
                    const isSelected = parseInt(selectedMonth.split('-')[1]) === index + 1 && parseInt(selectedMonth.split('-')[0]) === calendarYear;
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
        )}
      </div>

      {/* Mini Dashboard for Client */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Contratado</p>
            <p className="text-xs text-slate-400 mb-1 font-medium">{viewMode === 'recent' ? '(2 Meses)' : '(Mensal)'}</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(clientKpis.total)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <Layers size={20} />
          </div>
        </div>
        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Pago</p>
            <p className="text-xs text-slate-400 mb-1 font-medium">{viewMode === 'recent' ? '(2 Meses)' : '(Mensal)'}</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(clientKpis.paid)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <CheckCircle size={20} />
          </div>
        </div>
        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Em Aberto</p>
            <p className="text-xs text-slate-400 mb-1 font-medium">{viewMode === 'recent' ? '(2 Meses)' : '(Mensal)'}</p>
            <p className="text-xl font-bold text-red-500">{formatCurrency(clientKpis.pending)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* Revenues List */}
      <div className="glass-panel rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-white/50 bg-white/30 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={18} />
            Receitas Vinculadas
          </h3>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
             {viewMode === 'recent' ? 'Visualizando Mês Atual e Anterior' : `Visualizando ${formatMonth(selectedMonth)}`}
          </span>
        </div>

        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          {loadingReceitas ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : clienteReceitas.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Nenhuma receita encontrada neste período.
            </div>
          ) : (
            <div className="divide-y divide-slate-100/50">
              {clienteReceitas.map((receita) => {
                 const statusStyle = getStatusColor(receita.status, receita.data_projetada);
                 const statusLabel = receita.status === 'Pago' ? 'Pago' : 'Pendente';

                 return (
                  <div key={receita.id} className="p-4 hover:bg-white/50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="font-semibold text-slate-800">
                           {formatCurrency(receita.valor_total)}
                         </span>
                         {receita.qnt_parcela && receita.qnt_parcela > 1 && (
                           <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                             {receita.qnt_parcela}x
                           </span>
                         )}
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-1">
                        {receita.descricao || 'Sem descrição'}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar size={12} />
                          <span>Venc: {formatDate(receita.data_projetada)}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Resp: {receita.empresa_resp}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {receita.status?.toLowerCase() !== 'pago' && (
                          <button 
                            onClick={() => handleMarkAsPaid(receita)}
                            className="group h-8 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center transition-all duration-300 shadow-lg shadow-green-500/30 overflow-hidden w-8 hover:w-[140px]"
                            title="Confirmar Pagamento"
                          >
                             <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                <Check size={16} strokeWidth={3} />
                             </div>
                             <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap text-xs font-bold pr-3 transition-opacity duration-300 delay-75">
                                Confirmar
                             </span>
                          </button>
                      )}
                      
                      <button 
                         onClick={() => handleEdit(receita)}
                         className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-blue-500 hover:border-blue-200 transition-all shadow-sm"
                         title="Editar"
                       >
                         <Edit size={14} />
                      </button>

                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${statusStyle}`}>
                        {statusLabel}
                      </div>
                    </div>
                  </div>
                 );
              })}
            </div>
          )}
        </div>

        {/* Footer with Generate Link Button */}
        <div className="p-4 border-t border-white/50 bg-slate-50/50 flex justify-end">
            <button 
              onClick={handleGenerateLink}
              className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600 text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 shadow-sm text-sm"
            >
              <Share2 size={16} />
              Gerar Link de Medição
            </button>
        </div>
      </div>

      {/* NEW MODAL for Adding Revenue */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-lg rounded-[32px] relative z-10 p-8 animate-[scaleIn_0.2s_ease-out] bg-white/80 shadow-2xl border border-white/60 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{editingId ? 'Editar Medição' : 'Nova Medição'}</h3>
                <p className="text-slate-500 text-sm">Empresa: {selectedCliente.nome_fantasia}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
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

              {/* eSocial Breakdown Visualizer */}
              {selectedCliente.envia_esoc && formData.valor_esoc && parseFloat(formData.valor_esoc) > 0 && (
                  <div className="bg-blue-50/80 rounded-2xl p-4 border border-blue-100 mb-2">
                      <div className="flex items-center gap-2 text-blue-600 mb-3">
                          <FileText size={16} />
                          <span className="text-xs font-bold uppercase tracking-wide">Envios eSocial</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-blue-100 flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-500">2220</span>
                              <span className="text-sm font-bold text-slate-800">{formatCurrency(parseFloat(formData.valor_esoc))}</span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-blue-100 flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-500">2240</span>
                              <span className="text-sm font-bold text-slate-800">{formatCurrency(parseFloat(formData.valor_esoc))}</span>
                          </div>
                      </div>
                      <div className="pt-3 mt-2 border-t border-blue-100 flex justify-between items-center text-blue-800">
                          <span className="text-xs font-semibold">Adicional Total</span>
                          <span className="text-sm font-bold">{formatCurrency(parseFloat(formData.valor_esoc) * 2)}</span>
                      </div>
                  </div>
              )}

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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Valor Base (Exames)</label>
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
                
                {/* CONDITIONAL ESOCIAL INPUT */}
                {selectedCliente.envia_esoc ? (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-blue-500 uppercase tracking-wide ml-2">Valor Unitário eSocial</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={formData.valor_esoc}
                        onChange={(e) => setFormData({...formData, valor_esoc: e.target.value})}
                        className="glass-input w-full p-4 rounded-2xl bg-blue-50/50 border-blue-200 text-blue-700 font-bold focus:bg-white"
                        placeholder="0.00"
                      />
                    </div>
                ) : (
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
                )}
              </div>

              {/* Show Parcelas separately if eSocial took the slot */}
              {selectedCliente.envia_esoc && (
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
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Vencimento</label>
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
                {submitting ? 'Salvando...' : (editingId ? 'Atualizar Medição' : 'Adicionar Medição')}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-md" onClick={() => setIsShareModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-md rounded-[28px] relative z-10 p-8 bg-white/90 shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out]">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Link de Medição Gerado</h3>
              <p className="text-slate-500 text-sm mt-1">
                O status da medição foi alterado para <strong className="text-orange-600">Aguardando Aprovação</strong>.
              </p>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl flex items-center gap-2 mb-6 border border-slate-200">
               <input 
                  type="text" 
                  readOnly 
                  value={generatedLink} 
                  className="bg-transparent w-full text-xs text-slate-600 focus:outline-none font-mono"
               />
               <button 
                onClick={copyToClipboard}
                className="p-2 bg-white rounded-lg shadow-sm hover:text-blue-600 transition-colors"
                title="Copiar"
               >
                 <Copy size={16} />
               </button>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Fechar
              </button>
              <button 
                onClick={() => {
                   window.open(generatedLink, '_blank');
                   setIsShareModalOpen(false);
                }}
                className="flex-1 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
              >
                Abrir Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Medicoes;