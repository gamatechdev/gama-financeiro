export interface Cliente {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  status_medicao?: string | null; // 'Aguardando' | 'Aceita' | 'Recusada' | null
  aprovado_por?: any | null; // JSON array [nome, cpf] or object
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
  // Campos específicos de tipo de receita
  valor_med?: number | null;
  valor_esoc?: number | null;
  valor_doc?: number | null;
  valor_trein?: number | null;
  valor_servsst?: number | null;
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
  categoria: string | null; // Agora é texto
  forma_pagamento: string | null;
  centro_custos: string | null;
  responsavel: string | null;
  valor: number | null;
  data_projetada: string | null;
  status: string | null;
  nome: string | null;
  qnt_parcela: number | null;
  recorrente: boolean | null;
}

export interface User {
  id: number;
  user_id: string;
  username: string;
  email: string;
  img_url: string;
}