import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { FinanceiroReceita, Cliente } from '../types';
import { 
  Layers, Calendar, CheckCircle, AlertCircle, Printer, Check, X, User, XCircle, 
  QrCode, Copy, Barcode, Download, Smartphone, CreditCard, Stethoscope, ArrowRight, LayoutList, Eye
} from 'lucide-react';

interface PublicMedicaoProps {
  dataToken: string;
}

const PublicMedicao: React.FC<PublicMedicaoProps> = ({ dataToken }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [receitas, setReceitas] = useState<FinanceiroReceita[]>([]);
  const [monthStr, setMonthStr] = useState('');

  // Selected Exam for Modal Details
  const [selectedExamReceita, setSelectedExamReceita] = useState<FinanceiroReceita | null>(null);

  // Approval Flow States
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Payment Mockup States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto'>('pix');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Decode the token (Base64)
        const decoded = atob(dataToken);
        const { clientId, month } = JSON.parse(decoded);

        if (!clientId || !month) throw new Error("Link inválido");

        setMonthStr(month);

        // Fetch Cliente
        const { data: clientData, error: clientError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', clientId)
          .single();

        if (clientError) throw clientError;
        setCliente(clientData);

        // Fetch Receitas for that month
        const [y, m] = month.split('-').map(Number);
        const start = new Date(y, m - 1, 1).toISOString().split('T')[0];
        const end = new Date(y, m, 0).toISOString().split('T')[0];

        const { data: receitasData, error: receitasError } = await supabase
          .from('financeiro_receitas')
          .select('*')
          .eq('contratante', clientId)
          .gte('data_projetada', start)
          .lte('data_projetada', end)
          .order('data_projetada', { ascending: true });

        if (receitasError) throw receitasError;
        setReceitas(receitasData as any || []);

      } catch (err: any) {
        console.error(err);
        setError("Não foi possível carregar a medição. O link pode estar expirado ou incorreto.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataToken]);

  const handleReject = async () => {
    if (!cliente) return;
    if (!confirm("Tem certeza que deseja recusar esta medição?")) return;

    setIsProcessing(true);
    try {
        const { error } = await supabase
            .from('clientes')
            .update({ status_medicao: 'Recusada' })
            .eq('id', cliente.id);
        
        if (error) throw error;
        setCliente({ ...cliente, status_medicao: 'Recusada' });
        alert("Medição recusada com sucesso.");
    } catch (err) {
        console.error(err);
        alert("Erro ao recusar medição.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleConfirmAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return;
    if (!approverName.trim()) {
      alert("Por favor, insira seu nome.");
      return;
    }

    setIsProcessing(true);
    try {
        const approvalData = {
            nome: approverName,
            data: new Date().toISOString()
        };

        const payload = [approvalData];

        const { error } = await supabase
            .from('clientes')
            .update({ 
                status_medicao: 'Aceita',
                aprovado_por: payload
            })
            .eq('id', cliente.id);
        
        if (error) throw error;
        
        setCliente({ ...cliente, status_medicao: 'Aceita', aprovado_por: payload });
        setShowAcceptModal(false);
        setShowPaymentModal(true); 
    } catch (err) {
        console.error(err);
        alert("Erro ao aceitar medição.");
    } finally {
        setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Código copiado!");
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

  const formatDayMonth = (dateStr: string | null) => {
     if (!dateStr) return '--/--';
     const cleanDate = dateStr.split('T')[0];
     const parts = cleanDate.split('-');
     if (parts.length === 3) {
       const [year, month, day] = parts;
       return `${day}/${month}`;
     }
     return dateStr;
  };

  const formatMonthFull = (isoMonth: string) => {
    if (!isoMonth) return '';
    const [year, month] = isoMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 15);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
  };

  const getApproverName = () => {
    if (!cliente?.aprovado_por) return 'Usuário';
    if (Array.isArray(cliente.aprovado_por)) {
       return cliente.aprovado_por[0]?.nome || 'Usuário';
    }
    return cliente.aprovado_por?.nome || 'Usuário';
  };

  // --- Helper function to extract JUST the exam name cleanly ---
  const getCleanExamName = (item: any): string => {
      if (!item) return '';
      if (typeof item === 'string') {
          if (item.trim().startsWith('{')) {
              try {
                  const parsed = JSON.parse(item);
                  return parsed.name || parsed.nome || 'Exame sem nome';
              } catch (e) {
                  return item; 
              }
          }
          return item; 
      }
      if (typeof item === 'object') {
          return item.name || item.nome || 'Exame sem nome';
      }
      return 'Item desconhecido';
  };

  // --- Separation Logic ---
  const examReceitas = useMemo(() => {
    return receitas.filter(r => r.exames_snapshot && Array.isArray(r.exames_snapshot) && r.exames_snapshot.length > 0);
  }, [receitas]);

  const otherReceitas = useMemo(() => {
    return receitas.filter(r => !r.exames_snapshot || !Array.isArray(r.exames_snapshot) || r.exames_snapshot.length === 0);
  }, [receitas]);

  const total = receitas.reduce((acc, r) => acc + (r.valor_total || 0), 0);
  const pixCode = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913GAMA MEDICINA6008BRASILIA62070503***6304E2CA";
  const boletoCode = "34191.79001 01043.510047 91020.150008 1 89450000015000";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Carregando medição...</p>
        </div>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="glass-panel p-8 rounded-3xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Erro ao acessar</h2>
          <p className="text-slate-500">{error || "Cliente não encontrado."}</p>
        </div>
      </div>
    );
  }

  const isPending = !cliente.status_medicao || cliente.status_medicao === 'Aguardando';
  const isAccepted = cliente.status_medicao === 'Aceita';
  const isRejected = cliente.status_medicao === 'Recusada';

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8">
      
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-8 print:hidden">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
               G
             </div>
             <div>
                <span className="font-bold text-slate-700 block text-lg leading-none">Gama Center</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Portal do Cliente</span>
             </div>
           </div>
           <button 
             onClick={() => window.print()}
             className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors shadow-sm font-medium text-sm"
           >
             <Printer size={16} /> <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
           </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: SOMENTE EXAMES / ATENDIMENTOS COM SNAPSHOT */}
        <div className="lg:col-span-4 space-y-4 print:w-full">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <LayoutList size={16} /> Atendimentos Médicos
                </h3>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{examReceitas.length}</span>
            </div>

            <div className="space-y-3">
                {examReceitas.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        Nenhum atendimento médico listado.
                    </div>
                ) : (
                    examReceitas.map((receita) => (
                        <div 
                            key={receita.id} 
                            onClick={() => setSelectedExamReceita(receita)}
                            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex justify-between items-center group cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="flex flex-col items-center justify-center w-10 h-10 bg-slate-50 rounded-lg text-slate-500 border border-slate-100 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    <span className="text-[10px] font-bold uppercase">{formatDayMonth(receita.data_projetada).split('/')[1]}</span>
                                    <span className="text-sm font-bold">{formatDayMonth(receita.data_projetada).split('/')[0]}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                                        {receita.descricao || 'Atendimento'}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                                        <Stethoscope size={10} />
                                        Clique para ver exames
                                    </p>
                                </div>
                            </div>
                            <div className="text-right pl-2 flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-800">{formatCurrency(receita.valor_total)}</p>
                                <ArrowRight size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {/* Total Summary Sticky Card */}
            <div className="bg-slate-800 p-5 rounded-2xl text-white shadow-xl shadow-slate-900/10 mt-4">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Geral</span>
                    <span className="text-2xl font-bold">{formatCurrency(total)}</span>
                 </div>
                 <p className="text-[10px] text-slate-500 mt-1">Inclui atendimentos e serviços administrativos.</p>
            </div>
        </div>

        {/* RIGHT COLUMN: SOMENTE SERVIÇOS ADMINISTRATIVOS / SEM EXAMES */}
        <div className="lg:col-span-8 space-y-6">
            
            {/* Invoice Header */}
            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 print:shadow-none print:border-none relative">
                 <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            {isAccepted && <span className="px-2 py-0.5 rounded bg-green-500/20 border border-green-500/50 text-green-300 text-[10px] font-bold uppercase flex items-center gap-1"><Check size={10} /> Aprovado</span>}
                            {isRejected && <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/50 text-red-300 text-[10px] font-bold uppercase flex items-center gap-1"><X size={10} /> Recusado</span>}
                            {isPending && <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/50 text-blue-300 text-[10px] font-bold uppercase flex items-center gap-1">Pendente</span>}
                        </div>
                        <h1 className="text-3xl font-bold">{cliente.nome_fantasia || cliente.razao_social}</h1>
                        <p className="text-slate-400 text-sm mt-1">{cliente.razao_social}</p>
                        
                        <div className="mt-6 flex flex-wrap gap-6 border-t border-white/10 pt-6">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Referência</p>
                                <p className="text-lg font-semibold">{formatMonthFull(monthStr)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Vencimento Geral</p>
                                <p className="text-lg font-semibold">{formatDate(receitas[0]?.data_projetada || null)}</p>
                            </div>
                        </div>
                    </div>
                 </div>

                 <div className="p-8">
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-6">Serviços Administrativos e Outros</h3>
                     
                     <div className="space-y-6">
                        {otherReceitas.length === 0 ? (
                            <p className="text-slate-400 text-sm italic">Nenhum serviço administrativo avulso neste período. (Apenas atendimentos médicos)</p>
                        ) : (
                            otherReceitas.map((receita) => (
                                <div key={receita.id} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-lg">{receita.descricao || 'Serviço / Mensalidade'}</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                <span className="flex items-center gap-1"><User size={12}/> {receita.empresa_resp}</span>
                                                <span>•</span>
                                                <span>{formatDate(receita.data_projetada)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-bold text-slate-700">{formatCurrency(receita.valor_total)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                     </div>

                     <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium">Subtotal Serviços ({otherReceitas.length})</span>
                            <span className="text-slate-700 font-bold">{formatCurrency(otherReceitas.reduce((acc, r) => acc + (r.valor_total || 0), 0))}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mt-2">
                            <span className="text-slate-500 font-medium">Subtotal Atendimentos Médicos ({examReceitas.length})</span>
                            <span className="text-slate-700 font-bold">{formatCurrency(examReceitas.reduce((acc, r) => acc + (r.valor_total || 0), 0))}</span>
                        </div>
                     </div>
                 </div>
            </div>

            {/* Actions Section */}
            <div className="print:hidden">
                {isPending && (
                    <div className="bg-white p-6 rounded-[24px] shadow-lg border border-slate-100">
                        <h4 className="font-bold text-slate-800 mb-4">Ações da Medição</h4>
                        <div className="flex flex-col md:flex-row gap-4">
                            <button 
                                onClick={handleReject}
                                disabled={isProcessing}
                                className="flex-1 px-6 py-4 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <X size={18} /> Recusar e Solicitar Correção
                            </button>
                            <button 
                                onClick={() => setShowAcceptModal(true)}
                                disabled={isProcessing}
                                className="flex-[2] px-6 py-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                            >
                                <Check size={18} /> Aprovar Medição
                            </button>
                        </div>
                    </div>
                )}

                {isAccepted && (
                     <div className="bg-white p-6 rounded-[24px] shadow-lg border border-green-100 flex flex-col md:flex-row justify-between items-center gap-6 animate-fadeIn">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-green-800">Aprovado</h4>
                                <p className="text-sm text-green-600">
                                    Por <strong>{getApproverName()}</strong>.
                                </p>
                            </div>
                         </div>
                         <button 
                            onClick={() => setShowPaymentModal(true)}
                            className="px-8 py-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg flex items-center gap-2 w-full md:w-auto justify-center"
                         >
                            <CreditCard size={20} />
                            Pagar Agora
                         </button>
                     </div>
                )}
            </div>

        </div>
      </div>

      {/* --- MODAL DETALHES DE EXAMES --- */}
      {selectedExamReceita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedExamReceita(null)}></div>
            
            <div className="glass-panel w-full max-w-lg rounded-[32px] relative z-10 p-0 overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out] bg-white border border-white/60">
                <div className="bg-slate-900 p-6 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-blue-300 mb-1">
                            <Stethoscope size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">Detalhes do Atendimento</span>
                        </div>
                        <h3 className="text-xl font-bold">{selectedExamReceita.descricao}</h3>
                        <p className="text-slate-400 text-sm mt-1">{formatDate(selectedExamReceita.data_projetada)}</p>
                    </div>
                    <button 
                        onClick={() => setSelectedExamReceita(null)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8">
                    <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Eye size={16} className="text-blue-500" />
                            Exames Realizados
                        </h4>
                        
                        {selectedExamReceita.exames_snapshot && Array.isArray(selectedExamReceita.exames_snapshot) ? (
                            <ul className="space-y-3">
                                {selectedExamReceita.exames_snapshot.map((item: any, idx: number) => {
                                    const name = getCleanExamName(item);
                                    return (
                                        <li key={idx} className="flex items-center gap-3 text-sm font-medium text-slate-700 p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-1"></div>
                                            <span className="uppercase">{name}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-slate-400">Nenhum exame detalhado.</p>
                        )}
                    </div>

                    <div className="mt-6 flex justify-between items-center pt-4 border-t border-slate-100">
                        <span className="text-sm font-medium text-slate-500">Valor do Atendimento</span>
                        <span className="text-xl font-bold text-slate-800">{formatCurrency(selectedExamReceita.valor_total)}</span>
                    </div>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={() => setSelectedExamReceita(null)}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm text-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Approval Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowAcceptModal(false)}></div>
          
          <div className="bg-white w-full max-w-md rounded-3xl relative z-10 p-8 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Aprovar Medição</h3>
            <p className="text-slate-500 text-sm mb-6">Por favor, identifique-se para confirmar a aprovação deste demonstrativo.</p>

            <form onSubmit={handleConfirmAccept} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Seu Nome</label>
                    <div className="relative">
                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            required
                            value={approverName}
                            onChange={(e) => setApproverName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                            placeholder="Nome Completo"
                        />
                    </div>
                </div>
                
                <div className="pt-4 flex gap-3">
                    <button 
                        type="button"
                        onClick={() => setShowAcceptModal(false)}
                        className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit"
                        disabled={isProcessing}
                        className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                    >
                        {isProcessing ? 'Processando...' : 'Confirmar'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL (Mockups) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={() => setShowPaymentModal(false)}></div>

           <div className="bg-white w-full max-w-md rounded-3xl relative z-10 overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out]">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-bold">Pagamento</h3>
                    <p className="text-slate-400 text-xs">Total a pagar: {formatCurrency(total)}</p>
                 </div>
                 <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                    <X size={18} />
                 </button>
              </div>

              <div className="p-6">
                 {/* Tabs */}
                 <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
                    <button 
                        onClick={() => setPaymentMethod('pix')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === 'pix' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <QrCode size={16} /> PIX
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('boleto')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === 'boleto' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Barcode size={16} /> Boleto
                    </button>
                 </div>

                 {/* Content - PIX */}
                 {paymentMethod === 'pix' && (
                    <div className="flex flex-col items-center animate-fadeIn">
                       <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm mb-4">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCode)}`} 
                            alt="QR Code Pix" 
                            className="w-40 h-40 opacity-90"
                          />
                       </div>
                       <p className="text-xs text-slate-500 mb-4 text-center max-w-[200px]">
                          Abra o app do seu banco e escaneie o código acima.
                       </p>

                       <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 mb-6">
                          <div className="min-w-0 flex-1">
                             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Pix Copia e Cola</p>
                             <p className="text-xs font-mono text-slate-600 truncate">{pixCode}</p>
                          </div>
                          <button 
                            onClick={() => copyToClipboard(pixCode)}
                            className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm hover:text-green-600 transition-colors"
                          >
                             <Copy size={16} />
                          </button>
                       </div>
                    </div>
                 )}

                 {/* Content - Boleto */}
                 {paymentMethod === 'boleto' && (
                    <div className="flex flex-col items-center animate-fadeIn">
                       <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 mb-6 relative overflow-hidden group">
                          <div className="h-16 w-full flex items-center justify-center bg-slate-100 rounded mb-4 overflow-hidden relative">
                             <div className="font-mono tracking-[0.2em] text-slate-400 text-4xl scale-y-150 select-none opacity-50">||| ||| || | |</div>
                          </div>
                          
                          <div className="text-center">
                             <p className="text-sm font-bold text-slate-800 break-all font-mono">{boletoCode}</p>
                          </div>
                       </div>

                       <div className="flex gap-3 w-full">
                          <button 
                             onClick={() => copyToClipboard(boletoCode)}
                             className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
                          >
                             <Copy size={16} /> Copiar Código
                          </button>
                          <button className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 flex items-center justify-center gap-2">
                             <Download size={16} /> Baixar PDF
                          </button>
                       </div>
                    </div>
                 )}

                 <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full mt-2 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
                 >
                    Concluir
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PublicMedicao;