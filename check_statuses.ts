import { supabase } from './supabaseClient';

async function checkStatus() {
  const { data, error } = await supabase
    .from('financeiro_receitas')
    .select('status');
  
  if (error) {
    console.error(error);
    return;
  }

  const statuses = new Set(data.map(r => r.status));
  console.log('Unique statuses:', Array.from(statuses));
}

checkStatus();
