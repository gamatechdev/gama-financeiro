import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Cliente, Unidade } from '../types';
import { 
  Building2, Search, Plus, X, Save, Trash2, MapPin, 
  CheckCircle, AlertCircle, Building, Edit, Mail, Phone, Map, DollarSign, Calendar, User, Briefcase, FileText, Settings
} from 'lucide-react';

const Empresas: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form Data for Company (Full Schema)
  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    status: '',
    fatura_para: '',
    fatura_em: '', // integer input as string
    servicos: '', // text array input as comma separated string
    valor_total: '',
    faturou_em: '', // date input
    responsavel: '',
    clientefrequente: false,
    tipo: '1', // bigint
    modalidade: '',
    envia_esoc: false,
    valor_esoc: ''
  });

  // Units Management State
  const [clientUnits, setClientUnits] = useState<Unidade[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [loadingUnits, setLoadingUnits] = useState(false);

  const fetchClientes = async () => {
    setLoading(true);
    try {
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

  useEffect(() => {
    fetchClientes();
  }, []);

  // --- Units Logic ---
  const fetchUnits = async (clienteId: string) => {
      setLoadingUnits(true);
      try {
          const { data, error } = await supabase
            .from('unidades')
            .select('*')
            .eq('empresaid', clienteId)
            .order('nome_unidade');
          
          if (error) throw error;
          setClientUnits(data || []);
      } catch (err) {
          console.error(err);
      } finally {
          setLoadingUnits(false);
      }
  };

  const handleAddUnit = async () => {
      if (!editingId || !newUnitName.trim()) return;
      try {
          const { data, error } = await supabase
            .from('unidades')
            .insert([{ nome_unidade: newUnitName, empresaid: editingId }])
            .select();

          if (error) throw error;

          if (data) {
              setClientUnits([...clientUnits, data[0]]);
              setNewUnitName('');
          }
      } catch (err) {
          console.error("Erro ao adicionar unidade:", err);
          alert("Erro ao adicionar unidade.");
      }
  };

  const handleDeleteUnit = async (unitId: number) => {
      if (!confirm("Remover esta unidade?")) return;
      try {
          const { error } = await supabase.from('unidades').delete().eq('id', unitId);
          if (error) throw error;
          setClientUnits(prev => prev.filter(u => u.id !== unitId));
      } catch (err) {
          console.error(err);
          alert("Erro ao remover unidade.");
      }
  };

  // --- Company Logic ---

  const handleOpenNew = () => {
    setEditingId(null);
    setClientUnits([]);
    setFormData({
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      email: '',
      telefone: '',
      endereco: '',
      status: 'Ativo',
      fatura_para: '',
      fatura_em: '',
      servicos: '',
      valor_total: '',
      faturou_em: '',
      responsavel: '',
      clientefrequente: false,
      tipo: '1',
      modalidade: '',
      envia_esoc: false,
      valor_esoc: ''
    });
    setIsModalOpen(true);
  };

  const handleEdit = async (cliente: Cliente) => {
    setEditingId(cliente.id);
    setFormData({
      razao_social: cliente.razao_social || '',
      nome_fantasia: cliente.nome_fantasia || '',
      cnpj: cliente.cnpj || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      status: cliente.status || 'Ativo',
      fatura_para: cliente.fatura_para || '',
      fatura_em: cliente.fatura_em ? cliente.fatura_em.toString() : '',
      servicos: cliente.servicos ? cliente.servicos.join(', ') : '',
      valor_total: cliente.valor_total ? cliente.valor_total.toString() : '',
      faturou_em: cliente.faturou_em ? cliente.faturou_em.split('T')[0] : '',
      responsavel: cliente.responsavel || '',
      clientefrequente: cliente.clientefrequente || false,
      tipo: cliente.tipo ? cliente.tipo.toString() : '1',
      modalidade: cliente.modalidade || '',
      envia_esoc: cliente.envia_esoc || false,
      valor_esoc: cliente.valor_esoc ? cliente.valor_esoc.toString() : ''
    });
    setIsModalOpen(true);
    fetchUnits(cliente.id);
  };

  const handleDeleteClient = async (id: string) => {
      if (!confirm("Tem certeza? Isso apagará a empresa e pode afetar registros vinculados.")) return;
      try {
          const { error } = await supabase.from('clientes').delete().eq('id', id);
          if (error) throw error;
          setClientes(prev => prev.filter(c => c.id !== id));
      } catch (err) {
          console.error(err);
          alert("Erro ao excluir empresa.");
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
        // Prepare arrays and numbers
        const servicosArray = formData.servicos 
            ? formData.servicos.split(',').map(s => s.trim()).filter(s => s !== '') 
            : null;

        const payload = {
            razao_social: formData.razao_social,
            nome_fantasia: formData.nome_fantasia,
            cnpj: formData.cnpj,
            email: formData.email,
            telefone: formData.telefone,
            endereco: formData.endereco,
            status: formData.status,
            fatura_para: formData.fatura_para,
            fatura_em: formData.fatura_em ? parseInt(formData.fatura_em) : null,
            servicos: servicosArray,
            valor_total: formData.valor_total ? parseFloat(formData.valor_total) : null,
            faturou_em: formData.faturou_em || null, // Supabase handles date string for timestamp
            responsavel: formData.responsavel,
            clientefrequente: formData.clientefrequente,
            tipo: formData.tipo ? parseInt(formData.tipo) : 1,
            modalidade: formData.modalidade,
            envia_esoc: formData.envia_esoc,
            valor_esoc: formData.valor_esoc ? parseFloat(formData.valor_esoc) : null
        };

        if (editingId) {
            const { error } = await supabase
                .from('clientes')
                .update(payload)
                .eq('id', editingId);
            if (error) throw error;
        } else {
            const { data, error } = await supabase
                .from('clientes')
                .insert([payload])
                .select();
            if (error) throw error;
            if (data && data[0]) {
                setEditingId(data[0].id);
                fetchClientes(); 
                setSubmitting(false);
                alert("Empresa criada! Agora você pode adicionar unidades.");
                return; 
            }
        }

        setIsModalOpen(false);
        fetchClientes();

    } catch (err) {
        console.error(err);
        alert("Erro ao salvar empresa.");
    } finally {
        setSubmitting(false);
    }
  };

  const filteredClientes = clientes.filter(c => 
    (c.nome_fantasia?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.razao_social?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 relative min-h-full space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#050a30]">Empresas</h2>
          <p className="text-slate-500 mt-1">Gestão completa de cadastro e unidades</p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="bg-[#050a30] hover:bg-[#030720] text-white px-5 py-3 rounded-full font-medium shadow-lg shadow-[#050a30]/20 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Nova Empresa
        </button>
      </div>

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

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#04a7bd]"></div>
        </div>
      ) : filteredClientes.length === 0 ? (
         <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl">
             Nenhuma empresa encontrada.
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClientes.map(cliente => (
                <div key={cliente.id} className="glass-panel p-6 rounded-[24px] relative group hover:bg-white/80 transition-all hover:translate-y-[-4px] border border-white/60">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-[#04a7bd] flex items-center justify-center shadow-sm">
                            <Building2 size={24} />
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => handleEdit(cliente)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#04a7bd] hover:bg-cyan-50 transition-colors"
                             >
                                <Edit size={16} />
                             </button>
                             <button 
                                onClick={() => handleDeleteClient(cliente.id)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                             >
                                <Trash2 size={16} />
                             </button>
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-[#050a30] line-clamp-1" title={cliente.nome_fantasia || ''}>
                        {cliente.nome_fantasia || 'Sem Nome Fantasia'}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2 h-5">
                        {cliente.razao_social}
                    </p>
                    
                    {cliente.cnpj && (
                        <p className="text-xs text-slate-400 mb-4 font-mono">CNPJ: {cliente.cnpj}</p>
                    )}

                    <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                        {cliente.envia_esoc && (
                            <span className="px-2 py-1 rounded-lg bg-teal-50 text-[#149890] text-[10px] font-bold uppercase flex items-center gap-1">
                                <CheckCircle size={10} /> eSocial
                            </span>
                        )}
                        {cliente.status && (
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 ${cliente.status === 'Ativo' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                {cliente.status}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-6xl rounded-[32px] relative z-10 p-0 overflow-hidden bg-white/95 shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[95vh]">
             <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                <div>
                    <h3 className="text-2xl font-bold text-[#050a30]">{editingId ? 'Editar Empresa' : 'Nova Empresa'}</h3>
                    <p className="text-slate-500 text-sm">Preencha os dados cadastrais completos</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT: FORM (8 Cols) */}
                    <div className="lg:col-span-8 space-y-8">
                        <form id="companyForm" onSubmit={handleSubmit}>
                            
                            {/* SECTION 1: DADOS GERAIS */}
                            <div className="mb-8">
                                <div className="flex items-center gap-2 text-[#04a7bd] mb-4 border-b border-slate-100 pb-2">
                                    <Building size={18} />
                                    <h4 className="font-bold uppercase tracking-wide text-xs">Dados Cadastrais</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Razão Social</label>
                                        <input 
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.razao_social}
                                            onChange={e => setFormData({...formData, razao_social: e.target.value})}
                                            placeholder="Ex: Empresa X LTDA"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome Fantasia</label>
                                        <input 
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm font-semibold text-slate-700"
                                            value={formData.nome_fantasia}
                                            onChange={e => setFormData({...formData, nome_fantasia: e.target.value})}
                                            required
                                            placeholder="Ex: Empresa X"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CNPJ</label>
                                        <input 
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.cnpj}
                                            onChange={e => setFormData({...formData, cnpj: e.target.value})}
                                            placeholder="00.000.000/0000-00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Status</label>
                                        <select 
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.status}
                                            onChange={e => setFormData({...formData, status: e.target.value})}
                                        >
                                            <option value="Ativo">Ativo</option>
                                            <option value="Inativo">Inativo</option>
                                            <option value="Pendente">Pendente</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: CONTATO E LOCALIZAÇÃO */}
                            <div className="mb-8">
                                <div className="flex items-center gap-2 text-[#04a7bd] mb-4 border-b border-slate-100 pb-2">
                                    <MapPin size={18} />
                                    <h4 className="font-bold uppercase tracking-wide text-xs">Contato & Endereço</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Mail size={10}/> Email</label>
                                        <input 
                                            type="email"
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                            placeholder="contato@empresa.com"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Phone size={10}/> Telefone</label>
                                        <input 
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.telefone}
                                            onChange={e => setFormData({...formData, telefone: e.target.value})}
                                            placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><User size={10}/> Responsável</label>
                                        <input 
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.responsavel}
                                            onChange={e => setFormData({...formData, responsavel: e.target.value})}
                                            placeholder="Nome do contato"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Map size={10}/> Endereço Completo</label>
                                        <input 
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.endereco}
                                            onChange={e => setFormData({...formData, endereco: e.target.value})}
                                            placeholder="Rua, Número, Bairro, Cidade - UF"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: FINANCEIRO */}
                            <div className="mb-8">
                                <div className="flex items-center gap-2 text-[#04a7bd] mb-4 border-b border-slate-100 pb-2">
                                    <DollarSign size={18} />
                                    <h4 className="font-bold uppercase tracking-wide text-xs">Financeiro & Faturamento</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Dia Faturamento</label>
                                        <input 
                                            type="number"
                                            className="glass-input w-full p-2.5 rounded-xl bg-white/50 text-sm"
                                            value={formData.fatura_em}
                                            onChange={e => setFormData({...formData, fatura_em: e.target.value})}
                                            placeholder="Ex: 5, 10, 15"
                                        />
                                    </div>
                                    {/* Outros campos removidos conforme solicitação: Faturar para, valor contrato, ultimo faturamento, modalidade */}
                                </div>
                            </div>

                            {/* SECTION 4: OUTROS / CONFIGURAÇÕES */}
                            <div className="mb-8">
                                <div className="flex items-center gap-2 text-[#04a7bd] mb-4 border-b border-slate-100 pb-2">
                                    <Settings size={18} />
                                    <h4 className="font-bold uppercase tracking-wide text-xs">Configurações & Serviços</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    {/* Removido: Serviços Contratados e Tipo de Cliente */}
                                    <div className="space-y-4">
                                        
                                        {/* eSocial Toggle */}
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative inline-block w-8 h-5 align-middle select-none transition duration-200 ease-in">
                                                        <input 
                                                            type="checkbox" 
                                                            className="toggle-checkbox absolute block w-3 h-3 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                                            checked={formData.envia_esoc}
                                                            onChange={(e) => setFormData({...formData, envia_esoc: e.target.checked})}
                                                            style={{
                                                                right: formData.envia_esoc ? '2px' : 'auto',
                                                                left: formData.envia_esoc ? 'auto' : '2px',
                                                                top: '4px',
                                                                borderColor: 'transparent',
                                                                transition: 'all 0.3s'
                                                            }}
                                                        />
                                                        <label className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${formData.envia_esoc ? 'bg-teal-500' : 'bg-slate-300'}`}></label>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700">Envia eSocial?</span>
                                                </div>
                                            </div>
                                            {formData.envia_esoc && (
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Valor Unit. eSocial</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold mt-1"
                                                        value={formData.valor_esoc}
                                                        onChange={e => setFormData({...formData, valor_esoc: e.target.value})}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Frequent Client Toggle */}
                                        <div className="flex items-center gap-2 px-2">
                                            <input 
                                                type="checkbox"
                                                id="chk-frequent"
                                                checked={formData.clientefrequente}
                                                onChange={e => setFormData({...formData, clientefrequente: e.target.checked})}
                                                className="w-4 h-4 text-[#04a7bd] rounded focus:ring-[#04a7bd] border-gray-300"
                                            />
                                            <label htmlFor="chk-frequent" className="text-sm text-slate-600 font-medium">Marcar como Cliente Frequente</label>
                                        </div>

                                    </div>
                                </div>
                            </div>

                        </form>
                    </div>

                    {/* RIGHT: UNITS MANAGEMENT (4 Cols) */}
                    <div className="lg:col-span-4 bg-slate-50/50 rounded-3xl p-6 border border-slate-100 flex flex-col h-full max-h-[600px] lg:max-h-full lg:sticky lg:top-0">
                        <div className="flex items-center gap-2 text-[#04a7bd] mb-4">
                            <MapPin size={20} />
                            <h4 className="font-bold uppercase tracking-wide text-sm">Unidades Vinculadas</h4>
                        </div>

                        {!editingId ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-4 border-2 border-dashed border-slate-200 rounded-2xl">
                                <AlertCircle size={32} className="mb-2 opacity-50" />
                                <p className="text-sm">Salve a empresa primeiro para adicionar unidades.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="flex gap-2 mb-4">
                                    <input 
                                        type="text" 
                                        placeholder="Nome da nova unidade"
                                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#04a7bd]"
                                        value={newUnitName}
                                        onChange={e => setNewUnitName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddUnit()}
                                    />
                                    <button 
                                        onClick={handleAddUnit}
                                        className="bg-[#050a30] text-white p-2 rounded-xl hover:bg-[#030720] transition-colors"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-2xl border border-slate-200 shadow-sm">
                                    {loadingUnits ? (
                                        <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-[#04a7bd] border-t-transparent rounded-full mx-auto"></div></div>
                                    ) : clientUnits.length === 0 ? (
                                        <p className="p-6 text-center text-sm text-slate-400">Nenhuma unidade cadastrada.</p>
                                    ) : (
                                        <ul className="divide-y divide-slate-100">
                                            {clientUnits.map(unit => (
                                                <li key={unit.id} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-[#04a7bd]"></div>
                                                        <span className="text-sm font-medium text-slate-700">{unit.nome_unidade}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteUnit(unit.id)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                >
                    Cancelar
                </button>
                <button 
                    type="submit"
                    form="companyForm"
                    disabled={submitting}
                    className="px-8 py-3 bg-[#04a7bd] text-white font-bold rounded-xl hover:bg-[#038fa3] transition-all shadow-lg shadow-[#04a7bd]/20 flex items-center gap-2"
                >
                    {submitting ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Criar Empresa')}
                </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Empresas;