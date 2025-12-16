import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FinanceiroReceita, Cliente } from '../types';
import { Layers, Calendar, CheckCircle, AlertCircle, Printer, Check, X, User, XCircle } from 'lucide-react';

interface PublicMedicaoProps {
  dataToken: string;
}

const PublicMedicao: React.FC<PublicMedicaoProps> = ({ dataToken }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [receitas, setReceitas] = useState<FinanceiroReceita[]>([]);
  const [monthStr, setMonthStr] = useState('');

  // Approval Flow States
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approverCpf, setApproverCpf] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

    setIsProcessing(true);
    try {
        const approvalData = {
            nome: approverName,
            cpf: approverCpf,
            data: new Date().toISOString()
        };

        const { error } = await supabase
            .from('clientes')
            .update({ 
                status_medicao: 'Aceita',
                aprovado_por: approvalData
            })
            .eq('id', cliente.id);
        
        if (error) throw error;
        
        setCliente({ ...cliente, status_medicao: 'Aceita', aprovado_por: approvalData });
        setShowAcceptModal(false);
        alert("Medição aceita com sucesso!");
    } catch (err) {
        console.error(err);
        alert("Erro ao aceitar medição.");
    } finally {
        setIsProcessing(false);
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

  const formatMonthFull = (isoMonth: string) => {
    if (!isoMonth) return '';
    const [year, month] = isoMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 15);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
  };

  const total = receitas.reduce((acc, r) => acc + (r.valor_total || 0), 0);

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
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center print:hidden">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
               G
             </div>
             <span className="font-semibold text-slate-700">Gama Center</span>
           </div>
           <button 
             onClick={() => window.print()}
             className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors shadow-sm font-medium text-sm"
           >
             <Printer size={16} /> Imprimir / Salvar PDF
           </button>
        </div>

        {/* Main Invoice Card */}
        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 print:shadow-none print:border-none">
          
          {/* Top Banner */}
          <div className="bg-slate-900 text-white p-8 md:p-10 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -ml-16 -mb-16"></div>
             
             <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
               <div>
                 <div className="flex items-center gap-3 mb-2">
                    <p className="text-blue-300 font-bold uppercase tracking-widest text-xs">Demonstrativo de Serviços</p>
                    {isAccepted && <span className="px-2 py-0.5 rounded bg-green-500/20 border border-green-500/50 text-green-300 text-[10px] font-bold uppercase">Aprovado</span>}
                    {isRejected && <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/50 text-red-300 text-[10px] font-bold uppercase">Recusado</span>}
                 </div>
                 <h1 className="text-3xl md:text-4xl font-bold">{cliente.nome_fantasia || cliente.razao_social}</h1>
                 <p className="text-slate-400 mt-2 text-sm max-w-md">{cliente.razao_social}</p>
               </div>
               <div className="text-left md:text-right">
                 <p className="text-slate-400 text-xs uppercase font-bold mb-1">Referência</p>
                 <p className="text-2xl font-bold">{formatMonthFull(monthStr)}</p>
               </div>
             </div>
          </div>

          {/* Body */}
          <div className="p-8 md:p-10">
            
            {/* Items Table */}
            <div className="mb-10">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-6">Detalhamento</h3>
              
              <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                <div className="col-span-6">Descrição</div>
                <div className="col-span-3 text-center">Vencimento</div>
                <div className="col-span-3 text-right">Valor</div>
              </div>

              <div className="space-y-4 md:space-y-0 mt-4 md:mt-0">
                {receitas.length === 0 ? (
                  <p className="text-slate-400 py-4 italic">Nenhum registro encontrado para este mês.</p>
                ) : (
                  receitas.map((receita) => (
                    <div key={receita.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 py-4 border-b border-slate-50 items-center">
                      <div className="col-span-6">
                        <p className="font-bold text-slate-700 text-sm md:text-base">
                          {receita.descricao || 'Serviços Prestados'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Responsável: {receita.empresa_resp}
                          {receita.qnt_parcela && receita.qnt_parcela > 1 && ` • Parcela ${receita.qnt_parcela}x`}
                        </p>
                      </div>
                      <div className="col-span-3 flex items-center md:justify-center gap-2 text-slate-500 text-sm">
                         <Calendar size={14} className="md:hidden" />
                         {formatDate(receita.data_projetada)}
                      </div>
                      <div className="col-span-3 text-left md:text-right font-bold text-slate-800">
                        {formatCurrency(receita.valor_total)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Total Footer */}
            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <Layers size={18} />
                <span>Total de <strong>{receitas.length}</strong> lançamentos no período</span>
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Valor Total</p>
                <p className="text-3xl font-bold text-slate-900">{formatCurrency(total)}</p>
              </div>
            </div>

            {/* Approval Actions or Status Banner */}
            <div className="mt-8 print:hidden">
                {isPending && (
                    <div className="flex flex-col md:flex-row gap-4 justify-end">
                        <button 
                            onClick={handleReject}
                            disabled={isProcessing}
                            className="px-6 py-3 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <X size={18} /> Recusar Medição
                        </button>
                        <button 
                            onClick={() => setShowAcceptModal(true)}
                            disabled={isProcessing}
                            className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                        >
                            <Check size={18} /> Aprovar Medição
                        </button>
                    </div>
                )}

                {isAccepted && (
                     <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-green-800">Medição Aprovada</h4>
                            <p className="text-sm text-green-600">
                                Aprovado por <strong>{cliente.aprovado_por?.nome || 'Usuário'}</strong>.
                            </p>
                        </div>
                     </div>
                )}

                {isRejected && (
                     <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0">
                            <XCircle size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-red-800">Medição Recusada</h4>
                            <p className="text-sm text-red-600">
                                O cliente apontou divergências nesta medição. Entre em contato para regularizar.
                            </p>
                        </div>
                     </div>
                )}
            </div>

            {/* Note */}
            <div className="mt-10 text-center">
               <p className="text-xs text-slate-400 max-w-lg mx-auto">
                 Este documento é um demonstrativo de conferência gerado eletronicamente pelo sistema Gama Center. 
                 Dúvidas entrar em contato com o financeiro.
               </p>
            </div>

          </div>
        </div>
      </div>

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
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Seu CPF</label>
                    <input 
                        type="text" 
                        required
                        value={approverCpf}
                        onChange={(e) => setApproverCpf(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                        placeholder="000.000.000-00"
                    />
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
    </div>
  );
};

export default PublicMedicao;