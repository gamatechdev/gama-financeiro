import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Cliente } from '../types';
import { 
  Search, Save, Building2, DollarSign, Filter, CheckCircle, AlertCircle, Stethoscope, ChevronDown, X 
} from 'lucide-react';

// Lista de Exames Fornecida
const EXAMS_LIST = [
  {"idx":0,"id":447,"nome":"Avaliação Clínica"},
  {"idx":1,"id":448,"nome":"Audiometria"},
  {"idx":2,"id":449,"nome":"Acuidade Visual"},
  {"idx":3,"id":450,"nome":"Espirometria"},
  {"idx":4,"id":451,"nome":"Eletrocardiograma"},
  {"idx":5,"id":452,"nome":"Eletroencefalograma"},
  {"idx":6,"id":453,"nome":"Raio-X Tórax PA OIT"},
  {"idx":7,"id":454,"nome":"Raio-X Coluna L-Sacra"},
  {"idx":8,"id":455,"nome":"Raio-X Mãos e Braços"},
  {"idx":9,"id":456,"nome":"Raio-X Punho"},
  {"idx":10,"id":457,"nome":"Hemograma Completo"},
  {"idx":11,"id":458,"nome":"Glicemia em Jejum"},
  {"idx":12,"id":459,"nome":"EPF (parasitológico fezes)"},
  {"idx":13,"id":460,"nome":"EAS (urina)"},
  {"idx":14,"id":461,"nome":"Grupo Sanguíneo + Fator RH"},
  {"idx":15,"id":462,"nome":"Gama GT"},
  {"idx":16,"id":463,"nome":"TGO / TGP"},
  {"idx":17,"id":464,"nome":"Ácido Trans. Muconico"},
  {"idx":18,"id":465,"nome":"Ácido Úrico"},
  {"idx":19,"id":466,"nome":"Ácido Hipúr. (Tolueno urina)"},
  {"idx":20,"id":467,"nome":"Ácido Metil Hipúrico"},
  {"idx":21,"id":468,"nome":"Ácido Mandélico"},
  {"idx":22,"id":469,"nome":"ALA-U"},
  {"idx":23,"id":470,"nome":"Hemoglobina glicada"},
  {"idx":24,"id":471,"nome":"Coprocultura"},
  {"idx":25,"id":472,"nome":"Colesterol T e F"},
  {"idx":26,"id":473,"nome":"Chumbo Sérico"},
  {"idx":27,"id":474,"nome":"Creatinina"},
  {"idx":28,"id":475,"nome":"Ferro Sérico"},
  {"idx":29,"id":476,"nome":"Manganês Urinário"},
  {"idx":30,"id":477,"nome":"Manganês Sanguíneo"},
  {"idx":31,"id":478,"nome":"Reticulócitos"},
  {"idx":32,"id":479,"nome":"Triglicerídeos"},
  {"idx":33,"id":480,"nome":"IGE Específica - Abelha"},
  {"idx":34,"id":481,"nome":"Acetona Urinária"},
  {"idx":35,"id":482,"nome":"Anti HAV"},
  {"idx":36,"id":483,"nome":"Anti HBS"},
  {"idx":37,"id":484,"nome":"Anti HBSAG"},
  {"idx":38,"id":485,"nome":"Anti HCV"},
  {"idx":39,"id":486,"nome":"Carboxihemoglobina"},
  {"idx":40,"id":487,"nome":"Exame Toxicológico Pelo"},
  {"idx":41,"id":488,"nome":"Avaliação Vocal"},
  {"idx":42,"id":489,"nome":"Avaliação Psicossocial"},
  {"idx":43,"id":490,"nome":"Avaliação Psicológica"},
  {"idx":44,"id":491,"nome":"Aspecto da Pele"},
  {"idx":45,"id":492,"nome":"Questionário Epilepsia"},
  {"idx":46,"id":493,"nome":"Teste Palográfico"},
  {"idx":47,"id":494,"nome":"Teste de Atenção"},
  {"idx":48,"id":495,"nome":"Teste Romberg"},
  {"idx":49,"id":496,"nome":"Exame Toxicológico Urina"}
];

const PrecoExames: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchExam, setSearchExam] = useState('');
  
  // Search state for companies
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Maps exam name to its price and DB ID (if exists)
  // Format: { "Nome Exame": { price: "10.00", dbId: 123 | null } }
  const [priceMap, setPriceMap] = useState<Record<string, { price: string, dbId: number | null }>>({});
  
  const [saving, setSaving] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCompanyDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 1. Fetch Clients on Mount
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome_fantasia, razao_social')
          .order('nome_fantasia', { ascending: true });

        if (error) throw error;
        setClientes(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };
    fetchClientes();
  }, []);

  // 2. Fetch Existing Prices when Client Selected
  useEffect(() => {
    if (!selectedClienteId) {
      setPriceMap({});
      return;
    }

    const fetchPrices = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('preco_exames')
          .select('id, nome, preco')
          .eq('empresaId', selectedClienteId);

        if (error) throw error;

        // Initialize map with empty values for all exams
        const newMap: Record<string, { price: string, dbId: number | null }> = {};
        
        // Pre-fill with defaults
        EXAMS_LIST.forEach(exam => {
            newMap[exam.nome] = { price: '', dbId: null };
        });

        // Overlay existing DB data
        if (data) {
            data.forEach((item: any) => {
                // If the exam exists in our static list (or distinct DB entry), update it
                newMap[item.nome] = { 
                    price: item.preco ? item.preco.toString() : '', 
                    dbId: item.id 
                };
            });
        }

        setPriceMap(newMap);

      } catch (error) {
        console.error('Error fetching prices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [selectedClienteId]);

  // Handle Input Change
  const handlePriceChange = (examName: string, value: string) => {
    setPriceMap(prev => ({
      ...prev,
      [examName]: { ...prev[examName], price: value }
    }));
  };

  // Handle Save
  const handleSave = async () => {
    if (!selectedClienteId) return;
    setSaving(true);

    try {
      const updates = [];
      const inserts = [];

      for (const exam of EXAMS_LIST) {
        const currentData = priceMap[exam.nome];
        const numericPrice = currentData.price ? parseFloat(currentData.price.replace(',', '.')) : 0;

        if (currentData.dbId) {
          // Update existing
          updates.push({
            id: currentData.dbId,
            preco: numericPrice,
            // Assuming we don't change names of existing records linked by ID
          });
        } else if (numericPrice > 0) {
          // Insert new (only if price > 0)
          inserts.push({
            nome: exam.nome,
            empresaId: selectedClienteId,
            preco: numericPrice
          });
        }
      }

      // Execute Updates
      for (const update of updates) {
        const { error } = await supabase
          .from('preco_exames')
          .update({ preco: update.preco })
          .eq('id', update.id);
        if (error) throw error;
      }

      // Execute Inserts
      if (inserts.length > 0) {
        const { error } = await supabase
          .from('preco_exames')
          .insert(inserts);
        if (error) throw error;
      }

      // Refresh data to get new IDs
      const { data: refreshedData } = await supabase
          .from('preco_exames')
          .select('id, nome, preco')
          .eq('empresaId', selectedClienteId);
      
      if (refreshedData) {
          setPriceMap(prev => {
              const updated = { ...prev };
              refreshedData.forEach((item: any) => {
                  updated[item.nome] = { 
                      price: item.preco ? item.preco.toString() : '', 
                      dbId: item.id 
                  };
              });
              return updated;
          });
      }

      alert('Tabela de preços salva com sucesso!');

    } catch (error) {
      console.error('Error saving prices:', error);
      alert('Erro ao salvar preços.');
    } finally {
      setSaving(false);
    }
  };

  // Filter Clients for Dropdown
  const filteredClients = useMemo(() => {
    return clientes.filter(c => 
        (c.nome_fantasia || '').toLowerCase().includes(companySearch.toLowerCase()) ||
        (c.razao_social || '').toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [clientes, companySearch]);

  const handleSelectClient = (client: Cliente) => {
      setSelectedClienteId(client.id);
      setCompanySearch(client.nome_fantasia || client.razao_social);
      setShowCompanyDropdown(false);
  };

  const handleClearClient = () => {
      setSelectedClienteId('');
      setCompanySearch('');
      setPriceMap({}); // Clear prices
  };

  // Filtering Exams
  const filteredExams = useMemo(() => {
    return EXAMS_LIST.filter(exam => 
      exam.nome.toLowerCase().includes(searchExam.toLowerCase())
    );
  }, [searchExam]);

  return (
    <div className="p-6 relative min-h-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800">Tabela de Preços</h2>
          <p className="text-slate-500 mt-1">Defina os valores dos exames por empresa</p>
        </div>
        
        {selectedClienteId && (
            <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-green-600/20 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div> : <Save size={20} />}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
        )}
      </div>

      {/* Select Client */}
      <div className="glass-panel p-6 rounded-[28px] border border-white/60">
         <div className="flex flex-col md:flex-row gap-4 items-start md:items-center relative z-20">
            <div className="w-full md:w-1/2" ref={dropdownRef}>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Selecione a Empresa</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Building2 size={20} />
                    </div>
                    <input 
                        type="text"
                        placeholder="Pesquisar empresa..."
                        value={companySearch}
                        onChange={(e) => {
                            setCompanySearch(e.target.value);
                            setShowCompanyDropdown(true);
                            if (selectedClienteId) {
                                setSelectedClienteId(''); // Clear selection if typing
                                setPriceMap({});
                            }
                        }}
                        onFocus={() => setShowCompanyDropdown(true)}
                        className="glass-input w-full p-4 pl-12 pr-10 rounded-2xl bg-white/50 text-slate-700 font-semibold focus:bg-white transition-all"
                    />
                    
                    {/* Clear Button or Chevron */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
                        {companySearch ? (
                            <X size={16} onClick={handleClearClient} className="hover:text-red-500 transition-colors" />
                        ) : (
                            <ChevronDown size={16} />
                        )}
                    </div>

                    {/* DROPDOWN LIST */}
                    {showCompanyDropdown && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl max-h-60 overflow-y-auto z-50 animate-[scaleIn_0.15s_ease-out]">
                            {filteredClients.length > 0 ? (
                                filteredClients.map(client => (
                                    <button
                                        key={client.id}
                                        onClick={() => handleSelectClient(client)}
                                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 flex flex-col"
                                    >
                                        <span className="font-bold text-slate-700 text-sm">
                                            {client.nome_fantasia || 'Sem Nome Fantasia'}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {client.razao_social}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-slate-400 text-sm">
                                    Nenhuma empresa encontrada.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {selectedClienteId && (
                <div className="w-full md:w-1/2 animate-[fadeIn_0.3s_ease-out]">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Filtrar Exame</label>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Buscar exame..."
                            value={searchExam}
                            onChange={(e) => setSearchExam(e.target.value)}
                            className="glass-input w-full p-4 pl-12 rounded-2xl bg-white/50 focus:bg-white"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Search size={20} />
                        </div>
                    </div>
                </div>
            )}
         </div>
      </div>

      {/* Loading State */}
      {loading && (
          <div className="flex justify-center py-20">
             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
      )}

      {/* Exam List Grid */}
      {!loading && selectedClienteId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
              {filteredExams.map((exam, idx) => {
                  const currentPrice = priceMap[exam.nome]?.price || '';
                  const hasDbRecord = !!priceMap[exam.nome]?.dbId;

                  return (
                      <div 
                        key={idx} 
                        className={`
                            glass-panel p-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-200 border
                            ${currentPrice && parseFloat(currentPrice) > 0 ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'border-transparent hover:bg-white/60'}
                        `}
                      >
                          <div className="flex items-center gap-3 min-w-0">
                              <div className={`
                                  w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-500
                                  ${hasDbRecord ? 'bg-green-100 text-green-600' : 'bg-slate-100'}
                              `}>
                                  <Stethoscope size={16} />
                              </div>
                              <span className="text-sm font-semibold text-slate-700 truncate" title={exam.nome}>
                                  {exam.nome}
                              </span>
                          </div>

                          <div className="relative w-28 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                              <input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00"
                                  value={currentPrice}
                                  onChange={(e) => handlePriceChange(exam.nome, e.target.value)}
                                  className={`
                                      w-full border rounded-xl py-2 pl-8 pr-2 text-right font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
                                      ${currentPrice ? 'bg-white border-blue-200 text-slate-800' : 'bg-slate-50 border-transparent text-slate-400'}
                                  `}
                              />
                          </div>
                      </div>
                  );
              })}
              
              {filteredExams.length === 0 && (
                  <div className="col-span-full py-10 text-center text-slate-400">
                      Nenhum exame encontrado com este nome.
                  </div>
              )}
          </div>
      )}

      {/* Empty State */}
      {!loading && !selectedClienteId && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-60">
              <Building2 size={48} className="mb-4 text-slate-300" />
              <p>Selecione uma empresa acima para gerenciar os preços.</p>
          </div>
      )}

    </div>
  );
};

export default PrecoExames;