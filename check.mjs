import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://wofipjazcxwxzzxjsflh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvZmlwamF6Y3h3eHp6eGpzZmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MDA2NjcsImV4cCI6MjA3NDM3NjY2N30.gKjTEhXbrvRxKcn3cNvgMlbigXypbshDWyVaLqDjcpQ'
);

async function check() {
    const { data: janData, error } = await supabase
        .from('financeiro_receitas')
        .select('status, valor_total')
        .gte('data_projetada', '2026-01-01')
        .lte('data_projetada', '2026-01-31');

    if (error) {
        console.error(error);
        return;
    }

    let total = 0;
    let received = 0;
    let pending = 0;

    janData.forEach(r => {
        const val = r.valor_total || 0;
        const s = (r.status || '').toLowerCase();

        total += val;

        if (s === 'pago' || s === 'pago em dia' || s === 'pago em atraso') {
            received += val;
        } else if (s === 'em aberto' || s === 'pendente' || s === 'vencido') {
            pending += val;
        }
    });

    console.log("JAN 2026 KPI CHECK (Rules):");
    console.log("Total Esperado (VT Only):", total.toFixed(2));
    console.log("Recebido (VT Only):", received.toFixed(2));
    console.log("Pendente (VT Only):", pending.toFixed(2));
}

check();
