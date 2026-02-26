import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://wofipjazcxwxzzxjsflh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvZmlwamF6Y3h3eHp6eGpzZmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MDA2NjcsImV4cCI6MjA3NDM3NjY2N30.gKjTEhXbrvRxKcn3cNvgMlbigXypbshDWyVaLqDjcpQ'
);

async function check() {
    const { data, error } = await supabase
        .from('financeiro_receitas')
        .select('id, data_projetada')
        .gte('data_projetada', '2026-01-01')
        .lte('data_projetada', '2026-01-31');

    if (error) {
        console.error(error);
        return;
    }

    console.log("Found Jan 2026:", data.length);
    const distinct = new Set(data.map(d => d.data_projetada));
    console.log("Distinct values:", Array.from(distinct));
}

check();
