// table.js - Renderizado de la tabla de playlist y auto-reorganización armónica
function updatePlaylistTable() {
  const tbody = document.getElementById('playlistTableBody');
  tbody.innerHTML = '';
  currentPlaylist.forEach((s, idx) => {
    const tr = document.createElement('tr');
    if (s.isNew) tr.classList.add('tr-new');
    if (s.notFoundOnSpotify) tr.style.background = 'rgba(255, 0, 85, 0.06)';
    
    const hasData = s.bpm !== null && s.bpm !== undefined && s.camelot;
    let transClass = 'trans-green';
    let transTooltip = '🟢 Transición Automix Perfecta (Beatmatch & Armonía)';

    if (idx > 0) {
      const prevTrack = currentPlaylist[idx - 1];
      const prevHasData = prevTrack.bpm !== null && prevTrack.bpm !== undefined && prevTrack.camelot;

      if (!hasData || !prevHasData) {
        transClass = 'trans-unknown';
        transTooltip = '⚪ No se puede evaluar: hay una canción sin BPM/tonalidad verificados en este par.';
      } else {
        const bpmDiff = Math.abs(s.bpm - prevTrack.bpm);
        const camelotScore = evaluateCamelotDistance(prevTrack.camelot, s.camelot);

        if (bpmDiff > 3.5 || camelotScore < 50) {
          transClass = 'trans-red';
          transTooltip = `🔴 Automix fallará (Degrada a Fade-out de volumen): ΔBPM ${bpmDiff.toFixed(1)}, Armonía ${camelotScore}%`;
        } else if (bpmDiff > 2.0 || camelotScore < 75) {
          transClass = 'trans-yellow';
          transTooltip = `🟡 Transición Aceptable (Crossfade Suave): ΔBPM ${bpmDiff.toFixed(1)}, Armonía ${camelotScore}%`;
        }
      }
    }

    tr.innerHTML = `
      <td><span class="trans-indicator ${transClass}" title="${transTooltip}"></span><b>${idx + 1}</b></td>
      <td>
        <div style="font-weight:600; color:#fff;">
          ${s.title}
          ${s.notFoundOnSpotify ? '<span class="tag tag-dup" style="background:rgba(255,0,85,0.2); color:#ff0055; border-color:rgba(255,0,85,0.4); font-size:10px; margin-left:6px;">⚠️ No encontrada en Spotify</span>' : ''}
          ${!hasData ? '<span class="tag tag-dup" style="background:rgba(255,185,0,0.15); color:#ffb900; border-color:rgba(255,185,0,0.4); font-size:10px; margin-left:6px;">⚠️ BPM/tonalidad sin verificar</span>' : ''}
        </div>
        <div style="font-size:11px; color:#94a3b8;">${s.artist} ${s.genre ? `• <span class="tag tag-genre" style="font-size:9px; padding:1px 5px;">🎵 ${s.genre}</span>` : ''}</div>
      </td>
      <td><b>${hasData ? s.bpm : '—'}</b></td>
      <td><span class="tag tag-camelot">${s.camelot || '—'}</span></td>
      <td>
        <div style="display:flex; gap:2px; align-items:center;">
          ${s.notFoundOnSpotify ? `<button class="btn-del" style="color:var(--accent-cyan);" onclick="openManualSearchForIndex(${idx})" title="Buscar alternativa en Spotify">🔍</button>` : ''}
          <button class="btn-del" onclick="deleteTrack(${idx})" title="Eliminar canción">✕</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('statTotalSongs').innerText = currentPlaylist.length;
  const bpms = currentPlaylist.map(s => s.bpm).filter(b => typeof b === 'number' && !isNaN(b));
  const unverifiedCount = currentPlaylist.filter(s => s.bpm === null || s.bpm === undefined).length;
  if (bpms.length > 0) {
    document.getElementById('statBpmRange').innerText = `${Math.min(...bpms)} - ${Math.max(...bpms)}` + (unverifiedCount > 0 ? ` (${unverifiedCount} sin verificar)` : '');
  } else {
    document.getElementById('statBpmRange').innerText = '—';
  }

  const domGenre = getDominantPlaylistGenre();
  const domElem = document.getElementById('statDominantGenre');
  if (domElem) domElem.innerText = domGenre;
  updateTopArtistsChips();

  if (energyChart) {
    energyChart.data.labels = currentPlaylist.map((s, i) => `#${i + 1}`);
    // null se deja como null (no como 0): Chart.js abre un hueco en la línea
    // en vez de dibujar una caída falsa a 0 BPM para canciones sin verificar.
    energyChart.data.datasets[0].data = currentPlaylist.map(s => (typeof s.bpm === 'number' ? s.bpm : null));
    if (bpms.length > 0) {
      energyChart.options.scales.y.min = Math.max(40, Math.min(...bpms) - 5);
      energyChart.options.scales.y.max = Math.min(200, Math.max(...bpms) + 5);
    }
    energyChart.update();
  }

  savePlaylistToLocalStorage();
}

window.deleteTrack = function(index) {
  if (confirm(`¿Eliminar '${currentPlaylist[index].title}' de la playlist?`)) {
    currentPlaylist.splice(index, 1);
    updatePlaylistTable();
    refreshCurrentRecommendationsView();
  }
};

window.reorderPlaylistHarmonically = function(silent = false) {
  if (!currentPlaylist || currentPlaylist.length <= 1) return;

  // Canciones sin BPM/Camelot verificados no pueden entrar al cálculo armónico
  // (no hay con qué comparar), así que se separan y se agregan al final,
  // marcadas, en vez de dejar que el algoritmo las trate como BPM 0/null.
  const withData = currentPlaylist.filter(s => typeof s.bpm === 'number' && s.camelot);
  const withoutData = currentPlaylist.filter(s => !(typeof s.bpm === 'number' && s.camelot));

  if (withData.length <= 1) {
    if (!silent) alert("No hay suficientes canciones con BPM/tonalidad verificados para reorganizar armónicamente.");
    return;
  }

  const remaining = [...withData];
  const sorted = [];

  // Start with the track having the lowest BPM
  remaining.sort((a, b) => a.bpm - b.bpm);
  let current = remaining.shift();
  sorted.push(current);

  while (remaining.length > 0) {
    let bestIdx = 0;
    let minCost = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const camelotScore = evaluateCamelotDistance(current.camelot, cand.camelot);
      const bpmDiff = Math.abs(current.bpm - cand.bpm);

      let totalCost;
      // 1. Perfect harmonic match: exact Camelot key AND same/similar BPM (<= 1.5 BPM)
      // Gives huge bonus (-500) so identical key+BPM tracks (like This Is What You Came For & One Kiss) ALWAYS pair together!
      if (camelotScore === 100 && bpmDiff <= 1.5) {
        totalCost = -500 + bpmDiff * 10;
      } else {
        const bpmJumpCost = (bpmDiff > 3.0) ? (bpmDiff * 35) : (bpmDiff * 5);
        const camelotCost = (100 - camelotScore) * 3.0;
        totalCost = camelotCost + bpmJumpCost;
      }

      if (totalCost < minCost) {
        minCost = totalCost;
        bestIdx = i;
      }
    }

    current = remaining.splice(bestIdx, 1)[0];
    sorted.push(current);
  }

  currentPlaylist = [...sorted, ...withoutData];
  updatePlaylistTable();
  refreshCurrentRecommendationsView();

  if (!silent) {
    const ind = document.getElementById('saveIndicator');
    if (ind) {
      const extra = withoutData.length > 0 ? ` (${withoutData.length} sin verificar quedaron al final, revísalas a mano)` : '';
      ind.innerText = "✨ ¡Playlist Reorganizada Armónicamente (Emparejamiento Perfecto)!" + extra;
      setTimeout(() => { ind.innerText = "💾 Guardado Automático Activo"; }, 4000);
    }
  }
};

window.insertTrack = function(jsonStr, slotIndex) {
  const track = JSON.parse(decodeURIComponent(jsonStr));
  track.isNew = true;
  currentPlaylist.splice(slotIndex - 1, 0, track);

  const autoSort = document.getElementById('autoSortToggle')?.checked;
  if (autoSort) {
    reorderPlaylistHarmonically(true);
  } else {
    updatePlaylistTable();
    refreshCurrentRecommendationsView();
  }
};
