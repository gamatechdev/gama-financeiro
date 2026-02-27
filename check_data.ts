import { createClient } from '@supabase/supabase-client';

const supabaseUrl = 'https://wofipjazcxwxzzxjsflh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvZmlwamF6Y3h3eHp6eGpzZmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MDA2NjcsImV4cCI6MjA3NDM3NjY2N30.gKjTEhXbrvRxKcn3cNvgMlbigXypbshDWyVaLqDjcpQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const startDate = '2026-01-01';
    const endDate = '2026-01-31';

    console.log(`Checking data for range: ${startDate} to ${endDate}`);

    const { data, error, count } = await supabase
        .from('financeiro_receitas')
        .select('*', { count: 'exact' })
        .gte('data_projetada', startDate)
        .lte('data_projetada', endDate);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total records found: ${count}`);

    let totalSum = 0;
    let receivedSum = 0;
    let pendingSum = 0;
    let gamaMedicinaSum = 0;
    let gamaSolucoesSum = 0;

    data.forEach(r => {
        const val = r.valor_total || 0;
        totalSum += val;

        const status = r.status?.toLowerCase() || '';
        if (status === 'pago' || status === 'pago em dia' || status === 'pago em atraso') {
            receivedSum += val;
        } else {
            pendingSum += val;
        }

        if (r.empresa_resp === 'Gama Medicina') {
            gamaMedicinaSum += val;
        } else if (r.empresa_resp === 'Gama Soluções') {
            gamaSolucoesSum += val;
        }
    });

    console.log(`Total Sum (valor_total): ${totalSum.toFixed(2)}`);
    console.log(`Received Sum: ${receivedSum.toFixed(2)}`);
    console.log(`Pending Sum: ${pendingSum.toFixed(2)}`);
    console.log(`Gama Medicina Total: ${gamaMedicinaSum.toFixed(2)}`);
    console.log(`Gama Soluções Total: ${gamaSolucoesSum.toFixed(2)}`);

    // Also check if any valor_total is 0 or null
    const nullOrZero = data.filter(r => !r.valor_total || r.valor_total === 0);
    console.log(`Records with valor_total 0 or null: ${nullOrZero.length}`);
    if (nullOrZero.length > 0) {
        let catSum = 0;
        nullOrZero.forEach(r => {
            const s = (r.valor_med || 0) + (r.valor_esoc || 0) + (r.valor_doc || 0) + (r.valor_trein || 0) + (r.valor_servsst || 0);
            catSum += s;
        });
        console.log(`Sum of category fields for these records: ${catSum.toFixed(2)}`);
    }
}

checkData();
