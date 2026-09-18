// state.js - Gestión de estado global y persistencia en LocalStorage
let currentPlaylist = [];
let currentMode = 'ai';
let recommendationSeed = 0;

function savePlaylistToLocalStorage() {
  if (!currentPlaylist || currentPlaylist.length === 0) return;
  localStorage.setItem('edm_automix_playlist', JSON.stringify(currentPlaylist));
  const ind = document.getElementById('saveIndicator');
  if (ind) {
    ind.innerText = "💾 Cambios Guardados";
    setTimeout(() => { ind.innerText = "💾 Guardado Automático Activo"; }, 2000);
  }
}

function loadPlaylistFromLocalStorage() {
  const saved = localStorage.getItem('edm_automix_playlist');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        currentPlaylist = parsed.map(track => {
          if (typeof getClientKnownMeta === 'function') {
            const known = getClientKnownMeta(track.title, track.artist);
            if (known) {
              return {
                ...track,
                bpm: known.bpm,
                camelot: known.camelot,
                key: known.key || track.key,
                source: 'known_db'
              };
            }
          }
          // Listas guardadas antes de registrar el origen: solo se marcan como 'manual' si
          // coinciden exactamente con un valor escrito a mano; si no, quedan sin origen y la
          // tabla lo muestra como "origen no registrado" en vez de asumir uno.
          if (!track.source && isCuratedEntry(track)) {
            return { ...track, source: 'manual' };
          }
          return track;
        });
        return;
      }
    } catch(e){}
  }
  currentPlaylist = JSON.parse(JSON.stringify(INITIAL_PLAYLIST)).map(t => ({ ...t, source: 'manual' }));
}

function isCuratedEntry(track) {
  return [...INITIAL_PLAYLIST, ...EDM_CANDIDATES_POOL].some(c =>
    c.title === track.title && c.artist === track.artist &&
    c.bpm === track.bpm && c.camelot === track.camelot
  );
}

function getDominantPlaylistGenre() {
  if (!currentPlaylist || currentPlaylist.length === 0) return "General";
  const counts = {};
  currentPlaylist.forEach(s => {
    const g = s.genre || inferGenreFromTrack(s.title, s.artist);
    counts[g] = (counts[g] || 0) + 1;
  });
  let mainGenre = "EDM / General";
  let maxCount = 0;
  for (const g in counts) {
    if (counts[g] > maxCount) {
      maxCount = counts[g];
      mainGenre = g;
    }
  }
  return mainGenre;
}

function getTopPlaylistArtists() {
  const counts = {};
  currentPlaylist.forEach(s => {
    if (!s.artist) return;
    const mainArtist = s.artist.split(/,|&|feat\.|ft\./i)[0].trim();
    if (mainArtist && mainArtist.length > 2) {
      counts[mainArtist] = (counts[mainArtist] || 0) + 1;
    }
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 6);
}
