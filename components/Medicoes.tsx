import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Cliente, FinanceiroReceita } from '../types';
import { 
  Building2, Search, ChevronRight, ArrowLeft, Calendar, 
  CheckCircle, AlertCircle, Layers, TrendingUp, Filter, ChevronLeft, ChevronDown, Check, Plus, X, Share2, Copy, Clock, XCircle, Edit, Stethoscope, CloudUpload, FileText, Tag, Save, DollarSign, Upload, RefreshCw, Grid, List, Trash2, Calculator, Info, FileSpreadsheet
} from 'lucide-react';
import * as XLSXPkg from 'xlsx';

const XLSX = (XLSXPkg as any).default || XLSXPkg;

// Shared list of exams (same as PrecoExames)
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

const Medicoes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Detail View
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteReceitas, setClienteReceitas] = useState<FinanceiroReceita[]>([]);
  const [loadingReceitas, setLoadingReceitas] = useState(false);
  const [updatingValues, setUpdatingValues] = useState(false);
  
  // Grouping State
  const [groupByUnit, setGroupByUnit] = useState(false);

  // Local state for Client Settings Input (Controlled)
  const [clientEsocValue, setClientEsocValue] = useState<string>('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false); // Add Revenue Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); // Share Link Modal
  const [isValuesModalOpen, setIsValuesModalOpen] = useState(false); // NEW: Manage Prices Modal
  const [isExamSelectionOpen, setIsExamSelectionOpen] = useState(false); // NEW: Exam Selection Modal
  const [generatedLink, setGeneratedLink] = useState('');
  
  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  // Snapshot Item State for Editing
  const [snapshotItems, setSnapshotItems] = useState<{name: string, value: string}[]>([]);
  // Store prices for the selection modal
  const [clientPrices, setClientPrices] = useState<Record<string, number>>({});
  const [examSearchTerm, setExamSearchTerm] = useState('');

  // Prices Management State
  const [priceMap, setPriceMap] = useState<Record<string, { price: string, dbId: number | null }>>({});
  const [searchExam, setSearchExam] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'filled' | 'empty'>('all'); // NEW FILTER STATE
  const [savingPrices, setSavingPrices] = useState(false);
  
  // Excel Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    empresa_resp: 'Gama Medicina',
    valor_total: '',
    valor_esoc: '',
    qnt_parcela: '1',
    data_projetada: '',
    data_executada: '',
    descricao: ''
  });

  // --- Date Filtering State ---
  const [viewMode, setViewMode] = useState<'recent' | 'monthly'>('recent'); 
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

  const handleMonthChange = (step: number) => {
    if (!selectedMonth) return;
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
      // Alterado para incluir o join com unidades via coluna unidade_contratante
      let query = supabase
        .from('financeiro_receitas')
        .select('*, unidades:unidade_contratante(nome_unidade)')
        .eq('contratante', selectedCliente.id)
        .order('data_projetada', { ascending: false });

      // Date Logic
      const now = new Date();
      let startDateStr = '';
      let endDateStr = '';

      if (viewMode === 'recent') {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDateStr = prevMonth.toISOString().split('T')[0];
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDateStr = nextMonth.toISOString().split('T')[0];
      } else {
        const [y, m] = selectedMonth.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0); 
        startDateStr = start.toISOString().split('T')[0];
        endDateStr = end.toISOString().split('T')[0];
      }

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

  useEffect(() => {
    fetchReceitasDoCliente();
  }, [selectedCliente, viewMode, selectedMonth]);

  // Helper for normalization
  const normalizeStr = (str: string) => {
      return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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

  // --- PRICE MANAGEMENT LOGIC ---
  const fetchClientPrices = async () => {
      if (!selectedCliente) return;
      try {
        const { data, error } = await supabase
          .from('preco_exames')
          .select('id, nome, preco')
          .eq('empresaId', selectedCliente.id);

        if (error) throw error;

        const newMap: Record<string, { price: string, dbId: number | null }> = {};
        EXAMS_LIST.forEach(exam => {
            newMap[exam.nome] = { price: '', dbId: null };
        });

        if (data) {
            data.forEach((item: any) => {
                newMap[item.nome] = { 
                    price: item.preco ? item.preco.toString() : '', 
                    dbId: item.id 
                };
            });
        }
        setPriceMap(newMap);
      } catch (err) {
          console.error("Error fetching prices:", err);
      }
  };

  const handleOpenValues = () => {
      fetchClientPrices();
      setPriceFilter('all'); // Reset filter
      setIsValuesModalOpen(true);
  };

  const handlePriceMapChange = (examName: string, value: string) => {
    setPriceMap(prev => ({
      ...prev,
      [examName]: { ...prev[examName], price: value }
    }));
  };

  const handleUpdateAllValues = async () => {
      if (!selectedCliente) return;
      if (!confirm("Isso atualizará os valores de todas as medições PENDENTES (não pagas) com base na tabela de preços atual. Deseja continuar?")) return;

      setUpdatingValues(true);

      try {
          // 1. Get Current Prices
          const { data: prices } = await supabase
              .from('preco_exames')
              .select('nome, preco')
              .eq('empresaId', selectedCliente.id);

          const priceMap: Record<string, number> = {};
          if (prices) {
              prices.forEach(p => {
                  priceMap[normalizeStr(p.nome)] = p.preco;
              });
          }

          // 2. Get All Pending Revenues for this Client (Ignore date filter, update everything pending)
          const { data: receitas } = await supabase
              .from('financeiro_receitas')
              .select('*')
              .eq('contratante', selectedCliente.id)
              .neq('status', 'Pago');

          if (!receitas || receitas.length === 0) {
              alert("Nenhuma receita pendente encontrada para atualizar.");
              setUpdatingValues(false);
              return;
          }

          let updatedCount = 0;

          // 3. Process each revenue
          for (const r of receitas) {
              // Only process if it has a snapshot
              if (!r.exames_snapshot || !Array.isArray(r.exames_snapshot) || r.exames_snapshot.length === 0) {
                  continue;
              }

              let newTotal = 0;
              const newSnapshot = r.exames_snapshot.map((item: any) => {
                  // Normalize item processing for bulk update too
                  let name = '';
                  let currentVal = 0;

                  if (typeof item === 'string') {
                      if (item.trim().startsWith('{')) {
                          try {
                              const parsed = JSON.parse(item);
                              name = parsed.name || parsed.nome || item;
                              currentVal = parseFloat(parsed.value) || 0;
                          } catch { name = item; }
                      } else {
                          name = item;
                      }
                  } else {
                      name = item.name || item.nome || '';
                      currentVal = parseFloat(item.value) || 0;
                  }
                  
                  const normName = normalizeStr(name);
                  
                  // Use new price if exists, otherwise keep old value
                  const newPrice = priceMap[normName] !== undefined ? priceMap[normName] : currentVal;
                  
                  newTotal += newPrice;
                  
                  return { name, value: newPrice }; 
              });

              // Apply eSocial logic if pertinent
              if (selectedCliente.envia_esoc && r.descricao?.includes('Atendimento - ') && r.valor_esoc && r.valor_esoc > 0) {
                  newTotal += (r.valor_esoc * 2);
              }

              // Update in DB
              const { error } = await supabase
                  .from('financeiro_receitas')
                  .update({
                      valor_total: newTotal,
                      exames_snapshot: newSnapshot
                  })
                  .eq('id', r.id);

              if (!error) updatedCount++;
          }

          alert(`${updatedCount} registros atualizados com sucesso!`);
          fetchReceitasDoCliente(); // Refresh list

      } catch (err) {
          console.error("Erro ao atualizar valores em massa:", err);
          alert("Ocorreu um erro ao atualizar os valores.");
      } finally {
          setUpdatingValues(false);
      }
  };

  // --- EXCEL IMPORT LOGIC ---
  const handleImportExcelClick = () => {
      fileInputRef.current?.click();
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Use decode_range to get the boundaries of the sheet
          const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:G2"); // Fallback if empty
          
          // Row indexes (0-based)
          const headerRowIndex = 0; // Linha 1 do Excel
          const valueRowIndex = 1;  // Linha 2 do Excel

          // Check for hidden rows in !rows metadata
          const rowProps = worksheet['!rows'] || [];
          if ((rowProps[headerRowIndex] && rowProps[headerRowIndex].hidden) || 
              (rowProps[valueRowIndex] && rowProps[valueRowIndex].hidden)) {
              alert("A linha de cabeçalho (1) ou a linha de valores (2) está oculta. A importação foi ignorada para evitar dados incorretos.");
              // If rows are hidden, we stop or skip. User said "não deve ler... nada que esteja ocultado".
              // Assuming stopping is safer than partial import.
              return;
          }

          const colProps = worksheet['!cols'] || [];
          const newPriceMap = { ...priceMap };

          // Reset values to 0 before import ("caso não exista somente ignore e adicione 0")
          EXAMS_LIST.forEach(exam => {
              const existingDbId = priceMap[exam.nome]?.dbId || null;
              newPriceMap[exam.nome] = { price: '0', dbId: existingDbId };
          });

          // Iterate through columns starting from F (Index 5)
          const START_COL_INDEX = 5; 

          for (let C = START_COL_INDEX; C <= range.e.c; ++C) {
              // 1. Check if Column is Hidden
              if (colProps[C] && colProps[C].hidden) {
                  continue; // Skip hidden columns
              }

              // 2. Get Header Cell (Row 1)
              const headerCellAddress = XLSX.utils.encode_cell({ c: C, r: headerRowIndex });
              const headerCell = worksheet[headerCellAddress];

              if (!headerCell || !headerCell.v) continue; // Skip empty headers

              const headerText = String(headerCell.v);
              
              // 3. Match Header with Exams
              const matchedExam = EXAMS_LIST.find(exam => 
                  normalizeStr(exam.nome) === normalizeStr(headerText)
              );

              if (matchedExam) {
                  // 4. Get Value Cell (Row 2)
                  const valueCellAddress = XLSX.utils.encode_cell({ c: C, r: valueRowIndex });
                  const valueCell = worksheet[valueCellAddress];

                  if (valueCell) {
                      // 5. Check if it is a Formula
                      if (valueCell.f) {
                          // "não deve ler formulas" -> Ignore/Treat as 0
                          continue; 
                      }

                      // 6. Extract Value
                      let finalVal = 0;
                      
                      if (typeof valueCell.v === 'number') {
                          finalVal = valueCell.v;
                      } else if (typeof valueCell.v === 'string') {
                          // Clean potential formatting like "R$ 10,00"
                          const cleanStr = valueCell.v.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                          const parsed = parseFloat(cleanStr);
                          if (!isNaN(parsed)) finalVal = parsed;
                      }

                      // Update Map
                      if (finalVal > 0) {
                          newPriceMap[matchedExam.nome].price = finalVal.toString();
                      }
                  }
              }
          }

          setPriceMap(newPriceMap);
          alert("Importação realizada com sucesso! Verifique os valores e clique em Salvar.");

      } catch (err) {
          console.error("Erro ao importar Excel:", err);
          alert("Erro ao processar o arquivo Excel. Verifique se o formato está correto (Linha 1: Cabeçalho, Linha 2: Valores, a partir da coluna F).");
      } finally {
          if (fileInputRef.current) {
              fileInputRef.current.value = '';
          }
      }
  };

  const handleDownloadExcel = () => {
      if (!selectedCliente) return;

      // 1. Coletar todos os nomes de exames únicos presentes nos dados filtrados
      const allExamsSet = new Set<string>();
      
      clienteReceitas.forEach(receita => {
          if (receita.exames_snapshot && Array.isArray(receita.exames_snapshot)) {
              receita.exames_snapshot.forEach((item: any) => {
                  let name = '';
                  if (typeof item === 'string') {
                      // Handle potential JSON string
                      if (item.trim().startsWith('{')) {
                          try { const p = JSON.parse(item); name = p.name || p.nome || ''; } catch { name = item; }
                      } else { name = item; }
                  } else {
                      name = item.name || item.nome || '';
                  }
                  if (name) allExamsSet.add(name);
              });
          }
      });

      const sortedExams = Array.from(allExamsSet).sort();

      // 2. Construir as linhas
      const rows = clienteReceitas.map(receita => {
          // Identificar exames desta receita específica
          const currentRevenueExams = new Set<string>();
          if (receita.exames_snapshot && Array.isArray(receita.exames_snapshot)) {
              receita.exames_snapshot.forEach((item: any) => {
                  let name = '';
                  if (typeof item === 'string') {
                      if (item.trim().startsWith('{')) {
                          try { const p = JSON.parse(item); name = p.name || p.nome || ''; } catch { name = item; }
                      } else { name = item; }
                  } else {
                      name = item.name || item.nome || '';
                  }
                  if (name) currentRevenueExams.add(name);
              });
          }

          const rowData: any = {
              "Data": formatDate(receita.data_projetada),
              "Colaborador / Descrição": receita.descricao,
              "Unidade": receita.unidades?.nome_unidade || '—',
              "eSocial": (receita.valor_esoc && receita.valor_esoc > 0) ? 'X' : ''
          };

          // Adicionar colunas dinâmicas de exames
          sortedExams.forEach(examName => {
              rowData[examName] = currentRevenueExams.has(examName) ? 'X' : '';
          });

          rowData["Valor (R$)"] = receita.valor_total;

          return rowData;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      
      // Ajuste de largura de colunas
      const wscols = [
          { wch: 12 }, // Data
          { wch: 35 }, // Descricao
          { wch: 20 }, // Unidade
          { wch: 8 },  // eSocial
          ...sortedExams.map(() => ({ wch: 15 })), // Exames dinâmicos
          { wch: 15 }  // Valor
      ];
      worksheet['!cols'] = wscols;

      // STYLING LOGIC (Requires xlsx-js-style)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          if (!worksheet[cellRef]) continue;

          const cell = worksheet[cellRef];

          // Initialize style object
          if (!cell.s) cell.s = {};

          // Header Row (Row 0)
          if (R === 0) {
            cell.s = {
              font: { name: 'Arial', sz: 11, bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "04A7BD" } }, // System Primary Color
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                  top: { style: "thin", color: {auto: 1} },
                  bottom: { style: "thin", color: {auto: 1} },
                  left: { style: "thin", color: {auto: 1} },
                  right: { style: "thin", color: {auto: 1} }
              }
            };
          } 
          // Data Rows - Check for 'X' to center
          else if (cell.v === 'X') {
             cell.s = {
                alignment: { horizontal: "center", vertical: "center" }
             };
          }
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Medições");
      
      const safeName = (selectedCliente.nome_fantasia || 'Cliente').replace(/[^a-z0-9]/gi, '_');
      XLSX.writeFile(workbook, `Medicao_${safeName}.xlsx`);
  };

  const handleSavePrices = async () => {
    if (!selectedCliente) return;
    setSavingPrices(true);

    try {
      const updates = [];
      const inserts = [];

      for (const exam of EXAMS_LIST) {
        const currentData = priceMap[exam.nome];
        const numericPrice = currentData.price ? parseFloat(currentData.price.replace(',', '.')) : 0;

        if (currentData.dbId) {
          updates.push({
            id: currentData.dbId,
            preco: numericPrice,
          });
        } else if (numericPrice > 0) {
          inserts.push({
            nome: exam.nome,
            empresaId: selectedCliente.id,
            preco: numericPrice
          });
        }
      }

      for (const update of updates) {
        await supabase.from('preco_exames').update({ preco: update.preco }).eq('id', update.id);
      }

      if (inserts.length > 0) {
        await supabase.from('preco_exames').insert(inserts);
      }

      await fetchClientPrices(); // Refresh
      alert('Tabela de preços salva com sucesso!');
      setIsValuesModalOpen(false);

    } catch (error) {
      console.error('Error saving prices:', error);
      alert('Erro ao salvar preços.');
    } finally {
      setSavingPrices(false);
    }
  };

  const filteredExams = useMemo(() => {
    return EXAMS_LIST.filter(exam => {
        // 1. Text Search
        const matchesSearch = exam.nome.toLowerCase().includes(searchExam.toLowerCase());
        
        // 2. Filter (Filled vs Empty)
        const currentPrice = priceMap[exam.nome]?.price;
        const hasPrice = currentPrice && parseFloat(currentPrice) > 0;
        
        let matchesFilter = true;
        if (priceFilter === 'filled') matchesFilter = hasPrice;
        if (priceFilter === 'empty') matchesFilter = !hasPrice;

        return matchesSearch && matchesFilter;
    });
  }, [searchExam, priceFilter, priceMap]);


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
      setClienteReceitas(prev => prev.map(r => 
        r.id === receita.id ? { ...r, status: 'Pago', data_executada: todayStr } : r
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  // Toggle eSocial
  const handleToggleEsocial = async () => {
    if (!selectedCliente) return;

    const newValue = !selectedCliente.envia_esoc;
    let newDefaultValue = selectedCliente.valor_esoc;

    if (newValue && (!newDefaultValue || newDefaultValue === 0)) {
        newDefaultValue = 29.90;
        setClientEsocValue('29.90'); 
    }

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
        setSelectedCliente(selectedCliente);
        setClientes(prev => prev.map(c => c.id === selectedCliente.id ? selectedCliente : c));
    }
  };

  const handleUpdateClientEsocValue = async () => {
      if (!selectedCliente) return;
      const numVal = parseFloat(clientEsocValue);
      if (isNaN(numVal)) return;
      if (numVal === selectedCliente.valor_esoc) return;

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
    
    let initialEsoc = '';
    if (selectedCliente && selectedCliente.envia_esoc && selectedCliente.valor_esoc) {
        initialEsoc = selectedCliente.valor_esoc.toString();
    } else if (selectedCliente && selectedCliente.envia_esoc) {
        initialEsoc = '29.90'; 
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

    if (receita.exames_snapshot && Array.isArray(receita.exames_snapshot) && receita.exames_snapshot.length > 0) {
        // Parse raw items properly first to handle JSON strings
        const rawItems = receita.exames_snapshot.map((item: any) => {
             if (typeof item === 'string') {
                if (item.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(item);
                        return { name: parsed.name || parsed.nome || item, value: parsed.value || 0 };
                    } catch { return { name: item, value: 0 }; }
                }
                return { name: item, value: 0 };
             }
             return { name: item.name || item.nome || '', value: item.value || 0 };
        });

        const examNames = rawItems.map(i => i.name);

        let currentPrices: Record<string, number> = {};
        if (receita.contratante) {
            try {
                const { data: prices } = await supabase
                    .from('preco_exames')
                    .select('nome, preco')
                    .eq('empresaId', receita.contratante)
                    .in('nome', examNames);

                if (prices) {
                    prices.forEach((p: any) => {
                        currentPrices[p.nome] = p.preco;
                        currentPrices[normalizeStr(p.nome)] = p.preco; // Store normalized for safer lookup
                    });
                }
            } catch (err) {
                console.error("Error fetching exam prices:", err);
            }
        }

        initialSnapshotItems = rawItems.map((item) => {
            const savedValue = typeof item.value === 'string' ? parseFloat(item.value) : item.value;
            const normName = normalizeStr(item.name);
            const tablePrice = currentPrices[item.name] || currentPrices[normName] || 0;
            
            const finalValue = (savedValue && savedValue > 0) ? savedValue : tablePrice;
            
            return { name: item.name, value: finalValue > 0 ? finalValue.toString() : '' };
        });
    }

    setSnapshotItems(initialSnapshotItems);

    const snapshotTotal = initialSnapshotItems.reduce((acc, item) => acc + (parseFloat(item.value) || 0), 0);
    
    let baseTotal = 0;
    const esocVal = receita.valor_esoc || 0;

    // CORREÇÃO: Se houver itens na lista (snapshot), o valor base DEVE ser a soma deles.
    // Isso garante que o valor exibido bata com a lista visual.
    if (initialSnapshotItems.length > 0) {
        baseTotal = snapshotTotal;
    } else {
        // Fallback: Se não houver itens, tenta deduzir do total salvo no banco
        baseTotal = receita.valor_total || 0;
        if (esocVal > 0) {
            baseTotal = baseTotal - (esocVal * 2);
            if (baseTotal < 0) baseTotal = 0; 
        }
    }

    let finalEsocValue = '';
    // CHANGE: Always prioritize client's current eSocial value if present
    if (selectedCliente && selectedCliente.valor_esoc) {
        finalEsocValue = selectedCliente.valor_esoc.toString();
    } else if (esocVal > 0) {
        finalEsocValue = esocVal.toString();
    } else if (selectedCliente && selectedCliente.envia_esoc) {
        finalEsocValue = '29.90';
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

      const totalSum = newItems.reduce((acc, item) => {
          const v = parseFloat(item.value);
          return acc + (isNaN(v) ? 0 : v);
      }, 0);

      if (totalSum >= 0) {
          setFormData(prev => ({ ...prev, valor_total: totalSum.toFixed(2) }));
      }
  };

  // --- EXAM SELECTION LOGIC ---
  const handleOpenExamSelection = async () => {
      if (!selectedCliente) return;
      
      // Fetch current prices to display in the list
      try {
          const { data: prices } = await supabase
              .from('preco_exames')
              .select('nome, preco')
              .eq('empresaId', selectedCliente.id);
          
          const priceMap: Record<string, number> = {};
          if (prices) {
              prices.forEach((p: any) => {
                  priceMap[p.nome] = p.preco;
              });
          }
          setClientPrices(priceMap);
      } catch (err) {
          console.error("Error fetching prices for selection:", err);
      }
      
      setExamSearchTerm('');
      setIsExamSelectionOpen(true);
  };

  const handleToggleExam = (examName: string) => {
      // Check if already exists
      const exists = snapshotItems.find(item => item.name === examName);
      
      let newItems = [];
      if (exists) {
          // Remove
          newItems = snapshotItems.filter(item => item.name !== examName);
      } else {
          // Add with price
          const price = clientPrices[examName] || 0;
          newItems = [...snapshotItems, { name: examName, value: price.toString() }];
      }
      
      setSnapshotItems(newItems);
      
      // Update Total
      const totalSum = newItems.reduce((acc, item) => {
          const v = parseFloat(item.value);
          return acc + (isNaN(v) ? 0 : v);
      }, 0);
      
      setFormData(prev => ({ ...prev, valor_total: totalSum.toFixed(2) }));
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
      
      let finalTotalValue = baseTotalValue;
      if (selectedCliente.envia_esoc && esocialUnitValue > 0) {
          finalTotalValue = baseTotalValue + (esocialUnitValue * 2);
      }

      const snapshotFields = snapshotItems.length > 0 ? {
          valor_med: finalTotalValue,
          exames_snapshot: snapshotItems 
      } : {};

      if (editingId) {
         const payload = {
            empresa_resp: formData.empresa_resp,
            contratante: selectedCliente.id,
            valor_total: finalTotalValue,
            valor_esoc: esocialUnitValue,
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

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getStatusColor = (status: string | null, date: string | null) => {
    const s = status?.toLowerCase() || '';
    if (s === 'pago') return 'text-[#149890] bg-teal-50 border-teal-100'; // Secondary Greenish
    
    if (date) {
      const today = new Date().toISOString().split('T')[0];
      const dueDate = date.split('T')[0];
      if (dueDate < today) return 'text-red-600 bg-red-100 border-red-200';
    }
    return 'text-[#04a7bd] bg-cyan-50 border-cyan-100'; // Primary Cyan
  };

  const getMedicaoStatusInfo = (status: string | null | undefined) => {
      switch (status) {
          case 'Aceita':
              return { label: 'Medição Aceita', color: 'bg-teal-50 text-[#149890] border-teal-100', icon: <CheckCircle size={14} /> };
          case 'Recusada':
              return { label: 'Medição Recusada', color: 'bg-red-50 text-red-600 border-red-100', icon: <XCircle size={14} /> };
          case 'Aguardando':
              return { label: 'Aguardando Aprovação', color: 'bg-orange-50 text-orange-600 border-orange-100', icon: <Clock size={14} /> };
          default:
              return { label: 'Não enviada', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: <AlertCircle size={14} /> };
      }
  };

  const filteredClientes = useMemo(() => {
    return clientes.filter(c => 
      (c.nome_fantasia?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (c.razao_social?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [clientes, searchTerm]);

  const clientKpis = useMemo(() => {
    const total = clienteReceitas.reduce((acc, r) => acc + (r.valor_total || 0), 0);
    const paid = clienteReceitas
      .filter(r => r.status?.toLowerCase() === 'pago')
      .reduce((acc, r) => acc + (r.valor_total || 0), 0);
    const pending = total - paid;
    return { total, paid, pending };
  }, [clienteReceitas]);

  const groupedReceitas = useMemo(() => {
      if (!groupByUnit) return {} as Record<string, { total: number, items: FinanceiroReceita[] }>;
      
      const groups: Record<string, { total: number, items: FinanceiroReceita[] }> = {};
      
      clienteReceitas.forEach(receita => {
          const unitName = receita.unidades?.nome_unidade || 'Sem Unidade';
          if (!groups[unitName]) {
              groups[unitName] = { total: 0, items: [] };
          }
          groups[unitName].items.push(receita);
          groups[unitName].total += (receita.valor_total || 0);
      });
      
      return groups;
  }, [clienteReceitas, groupByUnit]);


  // --- VIEW 1: CLIENT LIST ---
  if (!selectedCliente) {
    return (
      <div className="p-6 relative min-h-full space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#050a30]">Medições</h2>
            <p className="text-slate-500 mt-1">Selecione uma empresa para ver o histórico</p>
          </div>
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
                    <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-[#04a7bd] flex items-center justify-center shadow-sm">
                      <Building2 size={24} />
                    </div>
                    <div className={`px-2 py-1 rounded-lg border flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-[#050a30] line-clamp-1" title={cliente.nome_fantasia}>
                    {cliente.nome_fantasia || 'Sem Nome Fantasia'}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-1 mb-4">
                    {cliente.razao_social || 'Razão Social não informada'}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#04a7bd] uppercase tracking-wide">
                      Ver Medições
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#04a7bd] group-hover:text-white transition-colors">
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
              setViewMode('recent'); 
              setGroupByUnit(false);
            }}
            className="w-10 h-10 rounded-full bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
               <h2 className="text-2xl font-bold tracking-tight text-[#050a30]">
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
                    <div 
                        onClick={handleToggleEsocial}
                        className="flex items-center gap-2 cursor-pointer group select-none bg-white/50 px-2 py-0.5 rounded-lg border border-transparent hover:border-slate-200 transition-all"
                    >
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Envia eSocial?</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${selectedCliente.envia_esoc ? 'bg-[#149890]' : 'bg-slate-300'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${selectedCliente.envia_esoc ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${selectedCliente.envia_esoc ? 'text-[#149890]' : 'text-slate-400'}`}>
                            {selectedCliente.envia_esoc ? 'Sim' : 'Não'}
                        </span>
                    </div>

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
                                    className="w-full pl-5 pr-1 py-0.5 text-xs font-bold border border-slate-200 rounded-md focus:border-[#04a7bd] outline-none text-slate-700 bg-white bg-opacity-80"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
            <button 
                onClick={handleOpenValues}
                className="bg-[#04a7bd] hover:bg-[#038fa3] text-white px-5 py-3 rounded-full font-medium shadow-lg shadow-[#04a7bd]/20 transition-all flex items-center gap-2"
            >
                <Tag size={20} />
                Valores
            </button>
            <button 
                onClick={handleOpenNew}
                className="bg-[#050a30] hover:bg-[#030720] text-white px-5 py-3 rounded-full font-medium shadow-lg shadow-[#050a30]/20 transition-all flex items-center gap-2"
            >
                <Plus size={20} />
                Nova Receita
            </button>
        </div>
      </div>

      {/* Date Filter Controls */}
      <div className="glass-panel p-2 rounded-[20px] flex flex-col md:flex-row items-center gap-2 justify-between">
        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl w-full md:w-auto">
          <button 
            onClick={() => setViewMode('recent')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewMode === 'recent' ? 'bg-white text-[#04a7bd] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Atual e Anterior
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewMode === 'monthly' ? 'bg-white text-[#04a7bd] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                className="px-4 py-1.5 min-w-[150px] text-center text-sm font-semibold text-slate-700 hover:text-[#04a7bd] transition-colors flex items-center justify-center gap-2"
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
        )}
      </div>

      {/* Mini Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Contratado</p>
            <p className="text-xs text-slate-400 mb-1 font-medium">{viewMode === 'recent' ? '(2 Meses)' : '(Mensal)'}</p>
            <p className="text-xl font-bold text-[#050a30]">{formatCurrency(clientKpis.total)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-[#04a7bd] flex items-center justify-center">
            <Layers size={20} />
          </div>
        </div>
        <div className="glass-panel p-5 rounded-[20px] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Pago</p>
            <p className="text-xs text-slate-400 mb-1 font-medium">{viewMode === 'recent' ? '(2 Meses)' : '(Mensal)'}</p>
            <p className="text-xl font-bold text-[#149890]">{formatCurrency(clientKpis.paid)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-teal-50 text-[#149890] flex items-center justify-center">
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
        <div className="p-6 border-b border-white/50 bg-white/30 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <h3 className="font-bold text-[#050a30] flex items-center gap-2">
                <TrendingUp size={18} />
                Receitas Vinculadas
              </h3>
              <div className="h-6 w-[1px] bg-slate-300 mx-1"></div>
              
              <button 
                  onClick={() => setGroupByUnit(!groupByUnit)}
                  className={`p-1.5 rounded-lg border transition-colors shadow-sm flex items-center gap-2 text-xs font-bold px-3 ${groupByUnit ? 'bg-[#04a7bd] text-white border-[#04a7bd]' : 'bg-white border-slate-200 text-slate-500 hover:text-[#04a7bd]'}`}
                  title="Agrupar por Unidade"
              >
                  {groupByUnit ? <Grid size={14} /> : <List size={14} />}
                  {groupByUnit ? 'Agrupado' : 'Lista'}
              </button>

              <button 
                  onClick={handleUpdateAllValues}
                  disabled={updatingValues}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-[#04a7bd] hover:border-cyan-200 transition-colors shadow-sm disabled:opacity-50"
                  title="Atualizar valores em massa com tabela atual"
              >
                  {updatingValues ? (
                      <div className="w-4 h-4 border-2 border-[#04a7bd] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                      <RefreshCw size={14} />
                  )}
              </button>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
             {viewMode === 'recent' ? 'Visualizando Mês Atual e Anterior' : `Visualizando ${formatMonth(selectedMonth)}`}
          </span>
        </div>

        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          {loadingReceitas ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#04a7bd]"></div>
            </div>
          ) : clienteReceitas.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Nenhuma receita encontrada neste período.
            </div>
          ) : (
            <div className="p-0">
                {groupByUnit ? (
                    // GROUPED VIEW
                    <div className="space-y-6 p-4">
                        {Object.entries(groupedReceitas).map(([unitName, rawData]) => {
                            const data = rawData as { total: number, items: FinanceiroReceita[] };
                            return (
                            <div key={unitName} className="bg-white/40 rounded-2xl border border-white/60 overflow-hidden">
                                <div className="bg-slate-50/80 px-4 py-3 flex justify-between items-center border-b border-white/50">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={16} className="text-slate-400" />
                                        <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">{unitName}</span>
                                    </div>
                                    <span className="bg-[#04a7bd]/10 text-[#04a7bd] px-3 py-1 rounded-lg text-sm font-bold border border-[#04a7bd]/20">
                                        {formatCurrency(data.total)}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100/50">
                                    {data.items.map(receita => {
                                        const statusStyle = getStatusColor(receita.status, receita.data_projetada);
                                        const statusLabel = receita.status === 'Pago' ? 'Pago' : 'Pendente';
                                        
                                        return (
                                            <div key={receita.id} className="p-4 hover:bg-white/50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-slate-800 text-sm">
                                                            {formatCurrency(receita.valor_total)}
                                                        </span>
                                                        {receita.qnt_parcela && receita.qnt_parcela > 1 && (
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                                                                {receita.qnt_parcela}x
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-1">
                                                        {receita.descricao || 'Sem descrição'}
                                                    </p>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                            <Calendar size={10} />
                                                            <span>Venc: {formatDate(receita.data_projetada)}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            Resp: {receita.empresa_resp}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {receita.status?.toLowerCase() !== 'pago' && (
                                                        <button 
                                                            onClick={() => handleMarkAsPaid(receita)}
                                                            className="w-8 h-8 rounded-full bg-teal-50 text-[#149890] flex items-center justify-center hover:bg-[#149890] hover:text-white transition-all shadow-sm"
                                                            title="Confirmar"
                                                        >
                                                            <Check size={14} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleEdit(receita)}
                                                        className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-[#04a7bd] hover:border-cyan-200 transition-all shadow-sm"
                                                        title="Editar"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusStyle}`}>
                                                        {statusLabel}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                ) : (
                    // FLAT VIEW (Original)
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
                                    {receita.unidades?.nome_unidade && (
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                            <Building2 size={10} /> {receita.unidades.nome_unidade}
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
                                        className="group h-8 bg-[#149890] hover:bg-teal-700 text-white rounded-full flex items-center transition-all duration-300 shadow-lg shadow-[#149890]/30 overflow-hidden w-8 hover:w-[140px]"
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
                                    className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-[#04a7bd] hover:border-cyan-200 transition-all shadow-sm"
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
          )}
        </div>

        {/* Footer with Generate Link Button */}
        <div className="p-4 border-t border-white/50 bg-slate-50/50 flex justify-end">
            <button 
              onClick={handleGenerateLink}
              className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-200 hover:text-[#04a7bd] text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 shadow-sm text-sm"
            >
              <Share2 size={16} />
              Gerar Link de Medição
            </button>
        </div>
      </div>

      {/* NEW MODAL for Adding Revenue - REDESIGNED */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-5xl rounded-[32px] relative z-10 p-0 overflow-hidden bg-white/90 shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                <div>
                    <div className="flex items-center gap-2 text-[#04a7bd] mb-1">
                        <Building2 size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">{selectedCliente.nome_fantasia}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#050a30]">{editingId ? 'Editar Medição' : 'Nova Medição'}</h3>
                </div>
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full">
                    
                    {/* LEFT COLUMN: GENERAL INFO */}
                    <div className="lg:col-span-7 p-8 space-y-6 border-r border-slate-100">
                        
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Responsável Técnico</label>
                            <div className="bg-slate-100/50 p-1.5 rounded-2xl flex relative">
                                <button
                                    type="button"
                                    onClick={() => setFormData({...formData, empresa_resp: 'Gama Medicina'})}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${formData.empresa_resp === 'Gama Medicina' ? 'bg-white shadow-sm text-[#050a30]' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Gama Medicina
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({...formData, empresa_resp: 'Gama Soluções'})}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${formData.empresa_resp === 'Gama Soluções' ? 'bg-white shadow-sm text-[#050a30]' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Gama Soluções
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Descrição do Serviço</label>
                            <textarea 
                                value={formData.descricao}
                                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                                className="glass-input w-full p-4 rounded-2xl h-32 resize-none bg-white/50 text-sm font-medium"
                                placeholder="Descreva os detalhes do atendimento ou serviço..."
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Vencimento</label>
                                <input 
                                    type="date"
                                    required
                                    value={formData.data_projetada}
                                    onChange={(e) => setFormData({...formData, data_projetada: e.target.value})}
                                    className="glass-input w-full p-3 rounded-2xl bg-white/50 text-slate-700 font-semibold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Data de Pagamento</label>
                                <input 
                                    type="date"
                                    value={formData.data_executada}
                                    onChange={(e) => setFormData({...formData, data_executada: e.target.value})}
                                    className="glass-input w-full p-3 rounded-2xl bg-white/50 text-slate-700 font-semibold"
                                />
                            </div>
                        </div>

                        {/* Extra Configs */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Layers size={16} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase">Configuração de Cobrança</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Parcelas</label>
                                    <input 
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.qnt_parcela}
                                        onChange={(e) => setFormData({...formData, qnt_parcela: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-[#04a7bd]"
                                    />
                                </div>
                                {selectedCliente.envia_esoc && (
                                    <div>
                                        <label className="text-[10px] font-bold text-[#04a7bd] uppercase ml-1 block mb-1">Valor Unit. eSocial</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#04a7bd]">R$</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={formData.valor_esoc}
                                                onChange={(e) => setFormData({...formData, valor_esoc: e.target.value})}
                                                className="w-full bg-cyan-50 border border-cyan-100 rounded-xl pl-8 pr-3 py-2 text-sm font-bold text-[#04a7bd] focus:outline-none focus:border-[#04a7bd]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: FINANCIAL DETAILS & EXAMS */}
                    <div className="lg:col-span-5 bg-slate-50/50 p-8 flex flex-col">
                        
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-slate-600">
                                <Stethoscope size={18} />
                                <h4 className="font-bold text-sm uppercase tracking-wide">Detalhamento de Exames</h4>
                            </div>
                            <button 
                                type="button"
                                onClick={handleOpenExamSelection}
                                className="text-xs font-bold bg-white border border-slate-200 text-[#04a7bd] px-3 py-1.5 rounded-lg hover:bg-[#04a7bd] hover:text-white transition-all shadow-sm flex items-center gap-1"
                            >
                                <Plus size={14} /> Adicionar
                            </button>
                        </div>

                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-6">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                                {snapshotItems.length > 0 ? (
                                    <div className="divide-y divide-slate-50">
                                        {snapshotItems.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors group">
                                                <span className="text-xs font-semibold text-slate-600 truncate max-w-[60%]">{item.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-20">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">R$</span>
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            value={item.value}
                                                            onChange={(e) => handleSnapshotItemChange(index, e.target.value)}
                                                            className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-[#04a7bd] text-right text-xs font-bold text-slate-700 py-1 pl-5 focus:outline-none transition-colors"
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleToggleExam(item.name)} 
                                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 p-6">
                                        <List size={32} className="mb-2 opacity-50" />
                                        <p className="text-xs font-medium text-center">Nenhum exame adicionado.</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Calculation Footer inside Card */}
                            <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-2">
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span>Soma dos Exames</span>
                                    <span className="font-semibold">{formatCurrency(parseFloat(formData.valor_total) || 0)}</span>
                                </div>
                                {selectedCliente.envia_esoc && formData.valor_esoc && parseFloat(formData.valor_esoc) > 0 && (
                                    <div className="flex justify-between items-center text-xs text-[#04a7bd]">
                                        <span className="flex items-center gap-1"><FileText size={10} /> Adicional eSocial (2 envios)</span>
                                        <span className="font-bold">+ {formatCurrency(parseFloat(formData.valor_esoc) * 2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* TOTAL BIG DISPLAY */}
                        <div className="mt-auto">
                            <div className="bg-[#050a30] text-white p-6 rounded-2xl shadow-xl shadow-[#050a30]/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total do Atendimento</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-medium text-slate-400">R$</span>
                                    <span className="text-4xl font-bold tracking-tight">
                                        {(() => {
                                            const base = parseFloat(formData.valor_total) || 0;
                                            const esoc = (selectedCliente.envia_esoc && parseFloat(formData.valor_esoc) > 0) 
                                                ? (parseFloat(formData.valor_esoc) || 0) * 2 
                                                : 0;
                                            return (base + esoc).toFixed(2).replace('.', ',');
                                        })()}
                                    </span>
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Calculator size={12} />
                                        <span>Cálculo Automático</span>
                                    </div>
                                    <div className="text-xs font-bold bg-white/10 px-2 py-1 rounded text-white">
                                        {parseInt(formData.qnt_parcela) > 1 ? `${formData.qnt_parcela}x Parcelas` : 'À Vista'}
                                    </div>
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
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-8 py-3 bg-[#04a7bd] text-white font-bold rounded-xl hover:bg-[#038fa3] transition-all shadow-lg shadow-[#04a7bd]/20 flex items-center gap-2"
                >
                    {submitting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Check size={18} />
                            {editingId ? 'Salvar Alterações' : 'Criar Medição'}
                        </>
                    )}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* EXAM SELECTION MODAL */}
      {isExamSelectionOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsExamSelectionOpen(false)}></div>
              
              <div className="glass-panel w-full max-w-md rounded-[28px] relative z-10 p-6 bg-white shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center mb-4">
                      <div>
                          <h3 className="text-lg font-bold text-[#050a30]">Selecionar Exames</h3>
                          <p className="text-xs text-slate-500">Adicione à medição atual</p>
                      </div>
                      <button 
                          onClick={() => setIsExamSelectionOpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                          <X size={18} />
                      </button>
                  </div>

                  <div className="relative mb-4">
                      <input 
                          type="text" 
                          placeholder="Buscar exame..." 
                          value={examSearchTerm}
                          onChange={(e) => setExamSearchTerm(e.target.value)}
                          className="w-full bg-slate-100 border border-transparent focus:bg-white focus:border-[#04a7bd] rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                          autoFocus
                      />
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-2">
                      {EXAMS_LIST.filter(ex => ex.nome.toLowerCase().includes(examSearchTerm.toLowerCase())).map((exam) => {
                          const isSelected = snapshotItems.some(i => i.name === exam.nome);
                          const price = clientPrices[exam.nome] || 0;

                          return (
                              <div 
                                  key={exam.id}
                                  onClick={() => handleToggleExam(exam.nome)}
                                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${isSelected ? 'bg-cyan-50 border-cyan-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#04a7bd] border-[#04a7bd]' : 'border-slate-300 bg-white'}`}>
                                          {isSelected && <Check size={12} className="text-white" />}
                                      </div>
                                      <div>
                                          <p className={`text-sm font-bold ${isSelected ? 'text-[#050a30]' : 'text-slate-600'}`}>{exam.nome}</p>
                                          {price > 0 && <p className="text-[10px] text-slate-400">Preço tabulado: {formatCurrency(price)}</p>}
                                      </div>
                                  </div>
                                  {isSelected && <span className="text-[10px] font-bold text-[#04a7bd] bg-white px-2 py-0.5 rounded-full shadow-sm">Selecionado</span>}
                              </div>
                          );
                      })}
                      {EXAMS_LIST.filter(ex => ex.nome.toLowerCase().includes(examSearchTerm.toLowerCase())).length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">
                              Nenhum exame encontrado.
                          </div>
                      )}
                  </div>
                  
                  <div className="pt-4 mt-2 border-t border-slate-100">
                      <button 
                          onClick={() => setIsExamSelectionOpen(false)}
                          className="w-full py-3 bg-[#050a30] text-white font-bold rounded-xl hover:bg-[#030720] transition-colors shadow-lg"
                      >
                          Concluir Seleção
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* VALUES / PRICES MODAL */}
      {isValuesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsValuesModalOpen(false)}></div>
          
          <div className="glass-panel w-full max-w-4xl rounded-[28px] relative z-10 p-6 bg-white shadow-2xl border border-white/60 animate-[scaleIn_0.2s_ease-out] flex flex-col max-h-[90vh]">
             {/* Header */}
             <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-xl font-bold text-[#050a30]">Tabela de Preços</h3>
                   <p className="text-slate-500 text-sm">Gerencie os valores de exames para {selectedCliente?.nome_fantasia}</p>
                </div>
                <div className="flex gap-2">
                   <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleExcelFileChange}
                      className="hidden"
                      accept=".xlsx, .xls"
                   />
                   <button 
                      onClick={handleImportExcelClick}
                      className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-2"
                   >
                      <CloudUpload size={16} /> Importar Excel
                   </button>
                   <button 
                      onClick={() => setIsValuesModalOpen(false)}
                      className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                   >
                      <X size={18} />
                   </button>
                </div>
             </div>

             {/* Search */}
             <div className="relative mb-4">
                 <input 
                    type="text" 
                    placeholder="Buscar exame..." 
                    value={searchExam}
                    onChange={(e) => setSearchExam(e.target.value)}
                    className="w-full bg-slate-100 border border-transparent focus:bg-white focus:border-[#04a7bd] rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                 />
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             </div>

             {/* Filter Buttons */}
             <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setPriceFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${priceFilter === 'all' ? 'bg-[#04a7bd] text-white border-[#04a7bd]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setPriceFilter('filled')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${priceFilter === 'filled' ? 'bg-[#04a7bd] text-white border-[#04a7bd]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                >
                    Com Valor
                </button>
                <button
                    onClick={() => setPriceFilter('empty')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${priceFilter === 'empty' ? 'bg-[#04a7bd] text-white border-[#04a7bd]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                >
                    Sem Valor
                </button>
             </div>

             {/* List */}
             <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                 {filteredExams.map((exam, idx) => {
                      const currentPrice = priceMap[exam.nome]?.price || '';
                      const hasDbRecord = !!priceMap[exam.nome]?.dbId;

                      return (
                          <div 
                            key={idx} 
                            className={`
                                p-3 rounded-xl flex items-center justify-between gap-3 border transition-all
                                ${currentPrice && parseFloat(currentPrice) > 0 ? 'bg-cyan-50/30 border-cyan-100' : 'bg-white border-slate-100'}
                            `}
                          >
                              <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${hasDbRecord ? 'bg-teal-50 text-[#149890]' : 'bg-slate-100 text-slate-400'}`}>
                                      <Stethoscope size={12} />
                                  </div>
                                  <span className="text-xs font-bold text-slate-700 truncate" title={exam.nome}>
                                      {exam.nome}
                                  </span>
                              </div>

                              <div className="relative w-24 shrink-0">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">R$</span>
                                  <input 
                                      type="number" 
                                      step="0.01"
                                      placeholder="0.00"
                                      value={currentPrice}
                                      onChange={(e) => handlePriceMapChange(exam.nome, e.target.value)}
                                      className="w-full border rounded-lg py-1.5 pl-6 pr-2 text-right font-bold text-xs focus:outline-none focus:border-[#04a7bd] transition-all bg-white"
                                  />
                              </div>
                          </div>
                      );
                 })}
             </div>
             
             {/* Footer */}
             <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3">
                 <button 
                     onClick={() => setIsValuesModalOpen(false)}
                     className="px-5 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors text-sm"
                 >
                     Cancelar
                 </button>
                 <button 
                     onClick={handleSavePrices}
                     disabled={savingPrices}
                     className="px-6 py-3 bg-[#04a7bd] text-white font-bold rounded-xl hover:bg-[#038fa3] transition-colors shadow-lg shadow-cyan-500/20 text-sm flex items-center gap-2"
                 >
                     {savingPrices ? 'Salvando...' : 'Salvar Tabela'}
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setIsShareModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-md rounded-[32px] relative z-10 p-8 shadow-2xl animate-[scaleIn_0.2s_ease-out] border border-white/60">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Share2 size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-center text-[#050a30] mb-2">Link Gerado com Sucesso!</h3>
            <p className="text-center text-slate-500 text-sm mb-6">
              Envie este link para <strong>{selectedCliente?.nome_fantasia}</strong> visualizar a medição.
            </p>

            <div className="bg-slate-100 p-4 rounded-xl flex items-center gap-3 mb-6 relative group">
               <p className="text-xs text-slate-500 font-mono truncate flex-1">{generatedLink}</p>
               <div className="absolute inset-0 bg-slate-800/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
            </div>

            <div className="flex gap-3 mb-3">
               <button 
                onClick={() => setIsShareModalOpen(false)}
                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors border border-slate-100"
               >
                 Fechar
               </button>
               <button 
                onClick={copyToClipboard}
                className="flex-1 py-3 bg-[#050a30] text-white font-bold rounded-xl hover:bg-[#030720] transition-colors shadow-lg flex items-center justify-center gap-2"
               >
                 <Copy size={18} />
                 Copiar Link
               </button>
            </div>
            
            <button 
                onClick={handleDownloadExcel}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center gap-2"
            >
                <FileSpreadsheet size={18} />
                Baixar Planilha de Medição
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Medicoes;