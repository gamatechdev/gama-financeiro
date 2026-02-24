import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Cliente } from '../types';
import {
    Search, Save, Building2, Stethoscope, ChevronDown, Upload, Filter, CheckCircle, Circle, AlertCircle
} from 'lucide-react';
import * as XLSXPkg from 'xlsx-js-style';

const XLSX = (XLSXPkg as any).default || XLSXPkg;

const EXAMS_LIST = [
    { "idx": 0, "id": 447, "nome": "Avaliação Clínica" },
    { "idx": 1, "id": 448, "nome": "Audiometria" },
    { "idx": 2, "id": 449, "nome": "Acuidade Visual" },
    { "idx": 3, "id": 450, "nome": "Espirometria" },
    { "idx": 4, "id": 451, "nome": "Eletrocardiograma" },
    { "idx": 5, "id": 452, "nome": "Eletroencefalograma" },
    { "idx": 6, "id": 453, "nome": "Raio-X Tórax PA OIT" },
    { "idx": 7, "id": 454, "nome": "Raio-X Coluna L-Sacra" },
    { "idx": 8, "id": 455, "nome": "Raio-X Mãos e Braços" },
    { "idx": 9, "id": 456, "nome": "Raio-X Punho" },
    { "idx": 10, "id": 457, "nome": "Hemograma Completo" },
    { "idx": 11, "id": 458, "nome": "Glicemia em Jejum" },
    { "idx": 12, "id": 459, "nome": "EPF (parasitológico fezes)" },
    { "idx": 13, "id": 460, "nome": "EAS (urina)" },
    { "idx": 14, "id": 461, "nome": "Grupo Sanguíneo + Fator RH" },
    { "idx": 15, "id": 462, "nome": "Gama GT" },
    { "idx": 16, "id": 463, "nome": "TGO / TGP" },
    { "idx": 17, "id": 464, "nome": "Ácido Trans. Muconico" },
    { "idx": 18, "id": 465, "nome": "Ácido Úrico" },
    { "idx": 19, "id": 466, "nome": "Ácido Hipúr. (Tolueno urina)" },
    { "idx": 20, "id": 467, "nome": "Ácido Metil Hipúrico" },
    { "idx": 21, "id": 468, "nome": "Ácido Mandélico" },
    { "idx": 22, "id": 469, "nome": "ALA-U" },
    { "idx": 23, "id": 470, "nome": "Hemoglobina glicada" },
    { "idx": 24, "id": 471, "nome": "Coprocultura" },
    { "idx": 25, "id": 472, "nome": "Colesterol T e F" },
    { "idx": 26, "id": 473, "nome": "Chumbo Sérico" },
    { "idx": 27, "id": 474, "nome": "Creatinina" },
    { "idx": 28, "id": 475, "nome": "Ferro Sérico" },
    { "idx": 29, "id": 476, "nome": "Manganês Urinário" },
    { "idx": 30, "id": 477, "nome": "Manganês Sanguíneo" },
    { "idx": 31, "id": 478, "nome": "Reticulócitos" },
    { "idx": 32, "id": 479, "nome": "Triglicerídeos" },
    { "idx": 33, "id": 480, "nome": "IGE Específica - Abelha" },
    { "idx": 34, "id": 481, "nome": "Acetona Urinária" },
    { "idx": 35, "id": 482, "nome": "Anti HAV" },
    { "idx": 36, "id": 483, "nome": "Anti HBS" },
    { "idx": 37, "id": 484, "nome": "Anti HBSAG" },
    { "idx": 38, "id": 485, "nome": "Anti HCV" },
    { "idx": 39, "id": 486, "nome": "Carboxihemoglobina" },
    { "idx": 40, "id": 487, "nome": "Exame Toxicológico Pelo" },
    { "idx": 41, "id": 488, "nome": "Avaliação Vocal" },
    { "idx": 42, "id": 489, "nome": "Avaliação Psicossocial" },
    { "idx": 43, "id": 490, "nome": "Avaliação Psicológica" },
    { "idx": 44, "id": 491, "nome": "Aspecto da Pele" },
    { "idx": 45, "id": 492, "nome": "Questionário Epilepsia" },
    { "idx": 46, "id": 493, "nome": "Teste Palográfico" },
    { "idx": 47, "id": 494, "nome": "Teste de Atenção" },
    { "idx": 48, "id": 495, "nome": "Teste Romberg" },
    { "idx": 49, "id": 496, "nome": "Exame Toxicológico Urina" },
    { "idx": 50, "id": 497, "nome": "RAC" }
];

interface PrecoExamesProps {
    initialClientId?: string;
}

const PrecoExames: React.FC<PrecoExamesProps> = ({ initialClientId }) => {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [selectedClienteId, setSelectedClienteId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [searchExam, setSearchExam] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'filled' | 'empty'>('all');

    const [companySearch, setCompanySearch] = useState('');
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [priceMap, setPriceMap] = useState<Record<string, { price: string, dbId: number | null }>>({});

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialClientId) {
            setSelectedClienteId(initialClientId);
        }
    }, [initialClientId]);

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

    useEffect(() => {
        const fetchClientes = async () => {
            try {
                const { data, error } = await supabase
                    .from('clientes')
                    .select('id, nome_fantasia, razao_social')
                    .order('nome_fantasia', { ascending: true });

                if (error) throw error;
                setClientes(data as unknown as Cliente[] || []);
            } catch (error) {
                console.error('Error fetching clients:', error);
            }
        };
        fetchClientes();
    }, []);

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

                const newMap: Record<string, { price: string, dbId: number | null }> = {};

                // Initialize with default exams
                EXAMS_LIST.forEach(exam => {
                    newMap[exam.nome] = { price: '', dbId: null };
                });

                // Fill with fetched data
                if (data) {
                    data.forEach((item: any) => {
                        // Use normalize key check or direct check
                        if (newMap[item.nome]) {
                            newMap[item.nome] = {
                                price: item.preco ? item.preco.toString() : '',
                                dbId: item.id
                            };
                        }
                    });
                }
                setPriceMap(newMap);
            } catch (err) {
                console.error("Error fetching prices:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPrices();
    }, [selectedClienteId]);

    const normalizeStr = (str: string) => {
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };

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

            const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:G2");

            const headerRowIndex = 0;
            const valueRowIndex = 1;

            const rowProps = worksheet['!rows'] || [];
            if ((rowProps[headerRowIndex] && rowProps[headerRowIndex].hidden) ||
                (rowProps[valueRowIndex] && rowProps[valueRowIndex].hidden)) {
                alert("A linha de cabeçalho (1) ou a linha de valores (2) está oculta. A importação foi ignorada para evitar dados incorretos.");
                return;
            }

            const colProps = worksheet['!cols'] || [];
            const newPriceMap = { ...priceMap };

            EXAMS_LIST.forEach(exam => {
                const existingDbId = priceMap[exam.nome]?.dbId || null;
                newPriceMap[exam.nome] = { price: '0', dbId: existingDbId };
            });

            const START_COL_INDEX = 5;

            for (let C = START_COL_INDEX; C <= range.e.c; ++C) {
                if (colProps[C] && colProps[C].hidden) {
                    continue;
                }

                const headerCellAddress = XLSX.utils.encode_cell({ c: C, r: headerRowIndex });
                const headerCell = worksheet[headerCellAddress];

                if (!headerCell || !headerCell.v) continue;

                const headerText = String(headerCell.v);

                const matchedExam = EXAMS_LIST.find(exam =>
                    normalizeStr(exam.nome) === normalizeStr(headerText)
                );

                if (matchedExam) {
                    const valueCellAddress = XLSX.utils.encode_cell({ c: C, r: valueRowIndex });
                    const valueCell = worksheet[valueCellAddress];

                    if (valueCell) {
                        if (valueCell.f) {
                            continue;
                        }

                        let finalVal = 0;

                        if (typeof valueCell.v === 'number') {
                            finalVal = valueCell.v;
                        } else if (typeof valueCell.v === 'string') {
                            const cleanStr = valueCell.v.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                            const parsed = parseFloat(cleanStr);
                            if (!isNaN(parsed)) finalVal = parsed;
                        }

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

    const handleSave = async () => {
        if (!selectedClienteId) return;
        setSaving(true);
        try {
            const updates = [];
            const inserts = [];

            for (const exam of EXAMS_LIST) {
                const currentData = priceMap[exam.nome];
                // Convert string price to number (replace comma with dot if needed)
                const priceStr = currentData?.price || '0';
                const numericPrice = parseFloat(priceStr.replace(',', '.')) || 0;

                // If there's a DB ID, it's an update
                if (currentData?.dbId) {
                    updates.push({
                        id: currentData.dbId,
                        preco: numericPrice
                    });
                } else if (numericPrice > 0) {
                    // Insert only if price > 0
                    inserts.push({
                        nome: exam.nome,
                        empresaId: selectedClienteId, // Using string UUID directly is fine if column type matches
                        preco: numericPrice
                    });
                }
            }

            // Execute updates
            for (const update of updates) {
                await supabase.from('preco_exames').update({ preco: update.preco }).eq('id', update.id);
            }

            // Execute inserts
            if (inserts.length > 0) {
                await supabase.from('preco_exames').insert(inserts);
            }

            alert("Preços atualizados com sucesso!");

            // Refresh
            const { data } = await supabase.from('preco_exames').select('id, nome, preco').eq('empresaId', selectedClienteId);
            if (data) {
                const newMap = { ...priceMap };
                data.forEach((item: any) => {
                    if (newMap[item.nome]) {
                        newMap[item.nome].dbId = item.id;
                        newMap[item.nome].price = item.preco ? item.preco.toString() : '';
                    }
                });
                setPriceMap(newMap);
            }

        } catch (err) {
            console.error("Error saving:", err);
            alert("Erro ao salvar preços.");
        } finally {
            setSaving(false);
        }
    };

    const handlePriceChange = (examName: string, val: string) => {
        setPriceMap(prev => ({
            ...prev,
            [examName]: { ...prev[examName], price: val }
        }));
    };

    const counts = useMemo(() => {
        let filled = 0;
        let empty = 0;

        EXAMS_LIST.forEach(exam => {
            const valStr = priceMap[exam.nome]?.price;
            const val = valStr ? parseFloat(valStr.replace(',', '.')) : 0;
            if (val > 0) filled++;
            else empty++;
        });

        return { filled, empty, all: EXAMS_LIST.length };
    }, [priceMap]);

    const filteredExams = useMemo(() => {
        return EXAMS_LIST.filter(e => {
            const matchesSearch = e.nome.toLowerCase().includes(searchExam.toLowerCase());
            const valStr = priceMap[e.nome]?.price;
            const val = valStr ? parseFloat(valStr.replace(',', '.')) : 0;

            let matchesFilter = true;
            if (filterType === 'filled') matchesFilter = val > 0;
            if (filterType === 'empty') matchesFilter = !val || val === 0;

            return matchesSearch && matchesFilter;
        });
    }, [searchExam, filterType, priceMap]);

    const selectedClientName = clientes.find(c => c.id === selectedClienteId)?.nome_fantasia || 'Selecione...';

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-[#050a30] mb-6">Tabela de Preços por Empresa</h2>

            {/* Client Selector */}
            <div className="mb-6 relative" ref={dropdownRef}>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Empresa</label>
                <div
                    className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:border-[#04a7bd]"
                    onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                >
                    <span className={selectedClienteId ? "text-slate-800 font-bold" : "text-slate-400"}>
                        {selectedClientName}
                    </span>
                    <ChevronDown size={16} className="text-slate-400" />
                </div>

                {showCompanyDropdown && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto p-2">
                        <input
                            type="text"
                            placeholder="Buscar empresa..."
                            className="w-full p-2 mb-2 bg-slate-50 rounded-lg text-sm focus:outline-none"
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                        {clientes.filter(c => (c.nome_fantasia || c.razao_social || '').toLowerCase().includes(companySearch.toLowerCase())).map(c => (
                            <div
                                key={c.id}
                                className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm font-medium text-slate-700"
                                onClick={() => {
                                    setSelectedClienteId(c.id);
                                    setShowCompanyDropdown(false);
                                }}
                            >
                                {c.nome_fantasia || c.razao_social}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedClienteId && (
                <>
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="relative flex-1 w-full">
                                <input
                                    type="text"
                                    placeholder="Buscar exame..."
                                    value={searchExam}
                                    onChange={(e) => setSearchExam(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#04a7bd]"
                                />
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleExcelFileChange}
                                    className="hidden"
                                    accept=".xlsx, .xls"
                                />
                                <button
                                    onClick={handleImportExcelClick}
                                    className="bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 flex-1 md:flex-none justify-center"
                                >
                                    <Upload size={18} />
                                    <span className="hidden sm:inline">Importar Excel</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-[#04a7bd] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#038fa3] transition-colors shadow-lg shadow-cyan-500/20 flex items-center gap-2 flex-1 md:flex-none justify-center"
                                >
                                    <Save size={18} />
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>

                        {/* New Filter Buttons */}
                        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${filterType === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Todos <span className="bg-slate-200 text-slate-600 px-1.5 rounded-md text-[10px]">{counts.all}</span>
                            </button>
                            <button
                                onClick={() => setFilterType('filled')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${filterType === 'filled' ? 'bg-white text-[#149890] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Preenchidos <span className="bg-teal-100 text-teal-700 px-1.5 rounded-md text-[10px]">{counts.filled}</span>
                            </button>
                            <button
                                onClick={() => setFilterType('empty')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${filterType === 'empty' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Pendentes <span className="bg-orange-100 text-orange-700 px-1.5 rounded-md text-[10px]">{counts.empty}</span>
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-10 text-center text-slate-400">Carregando preços...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            {filteredExams.map((exam) => {
                                const val = priceMap[exam.nome]?.price || '';
                                const hasDb = !!priceMap[exam.nome]?.dbId;
                                return (
                                    <div key={exam.id} className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${val ? 'bg-cyan-50/30 border-cyan-100' : 'bg-white border-slate-100'}`}>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${hasDb ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Stethoscope size={14} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 leading-tight break-words">{exam.nome}</span>
                                        </div>
                                        <div className="relative w-28 shrink-0 z-10">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={val}
                                                onChange={(e) => handlePriceChange(exam.nome, e.target.value)}
                                                className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-slate-200 text-right text-sm font-bold focus:border-[#04a7bd] outline-none bg-white shadow-sm"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredExams.length === 0 && (
                                <div className="col-span-full py-8 text-center text-slate-400">
                                    <Filter size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Nenhum exame encontrado para este filtro.</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {!selectedClienteId && (
                <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                    <Building2 size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Selecione uma empresa acima para gerenciar a tabela de preços.</p>
                </div>
            )}
        </div>
    );
};

export default PrecoExames;