// utils.js - Funciones auxiliares y de cálculo armónico
function normalizeSongTitle(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/feat\..*|ft\..*/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

function checkIsDuplicate(trackTitle) {
  if (!trackTitle) return { isDuplicate: false };
  const normTarget = normalizeSongTitle(trackTitle);
  if (!normTarget || normTarget.length < 2) return { isDuplicate: false };

  for (let i = 0; i < currentPlaylist.length; i++) {
    const normExist = normalizeSongTitle(currentPlaylist[i].title);
    if (!normExist) continue;

    // Exact normalized title match
    if (normTarget === normExist) {
      return { isDuplicate: true, pos: i + 1, existingTitle: currentPlaylist[i].title };
    }

    // Substring match ONLY if both normalized titles are long (>= 14 chars) and start identically
    if (normTarget.length >= 14 && normExist.length >= 14) {
      if (normTarget.startsWith(normExist) || normExist.startsWith(normTarget)) {
        return { isDuplicate: true, pos: i + 1, existingTitle: currentPlaylist[i].title };
      }
    }
  }
  return { isDuplicate: false };
}

function evaluateCamelotDistance(c1, c2) {
  if (!c1 || !c2) return 50;
  const m1 = c1.match(/(\d+)([AB])/);
  const m2 = c2.match(/(\d+)([AB])/);
  if (!m1 || !m2) return 50;
  const n1 = parseInt(m1[1]), l1 = m1[2];
  const n2 = parseInt(m2[1]), l2 = m2[2];
  const diff = Math.min(Math.abs(n1 - n2), 12 - Math.abs(n1 - n2));
  if (diff === 0 && l1 === l2) return 100;
  if (diff === 0 && l1 !== l2) return 90;
  if (diff === 1 && l1 === l2) return 85;
  if (diff === 1 && l1 !== l2) return 70;
  return Math.max(10, 40 - diff * 5);
}

function inferGenreFromTrack(title, artist) {
  const text = `${title || ''} ${artist || ''}`.toLowerCase();
  const reggaetonArtists = [
    'bad bunny', 'daddy yankee', 'don omar', 'karol g', 'rauw alejandro', 'feid', 'ferxxo',
    'j balvin', 'ozuna', 'wisin', 'yandel', 'anuel', 'maluma', 'myke towers', 'ryan castro',
    'chencho', 'el alfa', 'arcangel', 'zion', 'lennox', 'sech', 'mora', 'quevedo', 'trueno',
    'reggaeton', 'reggaetón', 'perreo', 'urbano', 'dembow', 'latin'
  ];
  for (const kw of reggaetonArtists) {
    if (text.includes(kw)) return "Reggaeton / Urbano";
  }

  if (text.includes('techno')) return "Techno";
  if (text.includes('trance')) return "Trance";
  if (text.includes('house')) return "House / Tech House";

  return "EDM / General";
}

function findOptimalSlot(track) {
  let bestSlot = 1;
  let maxScore = -1;
  let prevTitle = "[INICIO]", nextTitle = "[FINAL]";

  for (let i = 0; i <= currentPlaylist.length; i++) {
    const prev = i > 0 ? currentPlaylist[i - 1] : null;
    const next = i < currentPlaylist.length ? currentPlaylist[i] : null;

    const sPrev = prev ? (evaluateCamelotDistance(prev.camelot, track.camelot)*0.55 + (Math.abs(prev.bpm - track.bpm) <= 2 ? 100 : 60)*0.45) : 85;
    const sNext = next ? (evaluateCamelotDistance(track.camelot, next.camelot)*0.55 + (Math.abs(next.bpm - track.bpm) <= 2 ? 100 : 60)*0.45) : 85;
    
    let avg = (sPrev + sNext) / 2;
    if (track.isExtended) avg = Math.min(100, avg + 5);

    if (avg > maxScore) {
      maxScore = avg;
      bestSlot = i + 1;
      prevTitle = prev ? prev.title : "[INICIO]";
      nextTitle = next ? next.title : "[FINAL]";
    }
  }
  return { slot: bestSlot, score: Math.round(maxScore), prevTitle, nextTitle };
}

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function convertSpotifyKeyToCamelot(key, mode) {
  if (key === undefined || key === null || key < 0) return "8A";
  const majorCamelot = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"];
  const minorCamelot = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"];
  return mode === 1 ? (majorCamelot[key] || "8B") : (minorCamelot[key] || "8A");
}

function convertSpotifyKeyToName(key, mode) {
  if (key === undefined || key === null || key < 0) return "Desconocido";
  const keyNames = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"];
  const modeName = mode === 1 ? "mayor" : "menor";
  return `${keyNames[key] || ''} ${modeName}`;
}

function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
