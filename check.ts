import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('financeiro_receitas')
        .select('data_projetada')
        .like('data_projetada', '2026%');

    if (error) {
        console.error(error);
        return;
    }

    console.log("Found:", data.length);
    const distinct = new Set(data.map(d => d.data_projetada));
    console.log("Distinct values:", Array.from(distinct).slice(0, 20));
}

check();
