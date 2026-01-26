
export interface Cliente {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  status: string | null;
  fatura_para: string | null;
  fatura_em: number | null; // Dia do faturamento
  servicos: string[] | null; // Array de textos
  valor_total: number | null;
  faturou_em: string | null; // Timestamp
  created_at?: string;
  responsavel: string | null;
  clientefrequente: boolean | null;
  cargos?: any[] | null; // Array de bigints, mantido genérico
  tipo: number; // bigint, default 1
  cliente_propostas?: any[] | null;
  status_medicao: string | null; // 'Aguardando' | 'Aceita' | 'Recusada' | null
  aprovado_por: any[] | null; // JSON array ou text array
  modalidade: string | null;
  envia_esoc: boolean | null; 
  valor_esoc: number | null; 
}

export interface Unidade {
  id: number;
  nome_unidade: string;
  empresaid: string | null;
}

export interface FinanceiroReceita {
  id: number;
  data_projetada: string | null; // Date string
  valor_total: number | null;
  empresa_resp: string | null;
  qnt_parcela: number | null;
  data_executada: string | null; // Date string
  contratante: string | null; // UUID from Clientes
  descricao: string | null;
  clientes?: Cliente; // Direct join
  status: string | null;
  exames_snapshot?: any[] | null; // Array de objetos ou strings
  // Campos específicos de tipo de receita
  valor_med?: number | null;
  valor_esoc?: number | null;
  valor_doc?: number | null;
  valor_trein?: number | null;
  valor_servsst?: number | null;
  // Unidade Join
  unidade_contratante?: number | null;
  unidades?: { nome_unidade: string } | null;
}

export interface Categoria {
  id: number;
  nome: string;
}

export interface FinanceiroDespesa {
  id: number;
  created_at: string;
  desc: string | null;
  fornecedor: string | null;
  categoria: string | null; // Agora é texto (Setor)
  forma_pagamento: string | null;
  centro_custos: string | null;
  responsavel: string | null;
  valor: number | null;
  data_projetada: string | null;
  status: string | null;
  nome: string | null;
  qnt_parcela: number | null;
  recorrente: boolean | null;
  tipo: string; // Campo novo para Classificação (CF, CV, etc.)
}

export interface User {
  id: number;
  user_id: string;
  username: string;
  email: string;
  img_url: string;
}