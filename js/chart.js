// chart.js - Inicialización y actualización del gráfico de onda (Chart.js)
let energyChart = null;

function initChart() {
  const ctx = document.getElementById('energyChart').getContext('2d');
  const labels = currentPlaylist.map((s, i) => `#${i + 1}`);
  const dataBpm = currentPlaylist.map(s => s.bpm);

  energyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tempo (BPM)',
        data: dataBpm,
        borderColor: '#00f2fe',
        borderWidth: 3,
        backgroundColor: 'rgba(0, 242, 254, 0.1)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#00ff87',
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              return `#${idx + 1}: ${currentPlaylist[idx].title}`;
            },
            label: (item) => {
              const s = currentPlaylist[item.dataIndex];
              return `BPM: ${s.bpm} | Camelot: ${s.camelot} (${s.key||''})`;
            }
          }
        }
      },
      scales: {
        x: { display: false },
        y: {
          min: 115,
          max: 135,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
        }
      }
    }
  });
}
