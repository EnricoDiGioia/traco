'use strict';
/* ===== Fontes (as do iOS/iPadOS vêm instaladas; as outras são reservas para Windows/Android) ===== */
const FONTS = [
  { id: 'sf', name: 'San Francisco', css: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif' },
  { id: 'rounded', name: 'SF Rounded', css: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", sans-serif' },
  { id: 'ny', name: 'New York', css: 'ui-serif, "New York", Georgia, serif' },
  { id: 'helvetica', name: 'Helvetica Neue', css: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'avenir', name: 'Avenir Next', css: '"Avenir Next", Avenir, "Segoe UI", sans-serif' },
  { id: 'futura', name: 'Futura', css: 'Futura, "Century Gothic", sans-serif' },
  { id: 'gill', name: 'Gill Sans', css: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif' },
  { id: 'optima', name: 'Optima', css: 'Optima, Candara, sans-serif' },
  { id: 'georgia', name: 'Georgia', css: 'Georgia, serif' },
  { id: 'baskerville', name: 'Baskerville', css: 'Baskerville, "Baskerville Old Face", Georgia, serif' },
  { id: 'didot', name: 'Didot', css: 'Didot, "Bodoni 72", "Bodoni MT", serif' },
  { id: 'palatino', name: 'Palatino', css: 'Palatino, "Palatino Linotype", "Book Antiqua", serif' },
  { id: 'times', name: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { id: 'typewriter', name: 'American Typewriter', css: '"American Typewriter", "Courier New", monospace' },
  { id: 'courier', name: 'Courier', css: '"Courier New", Courier, monospace' },
  { id: 'menlo', name: 'Menlo', css: 'Menlo, ui-monospace, Consolas, monospace' },
  { id: 'noteworthy', name: 'Noteworthy', css: 'Noteworthy, "Segoe Print", "Comic Sans MS", cursive' },
  { id: 'bradley', name: 'Bradley Hand', css: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive' },
  { id: 'marker', name: 'Marker Felt', css: '"Marker Felt", "Segoe Print", "Comic Sans MS", cursive' },
  { id: 'chalk', name: 'Chalkboard', css: '"Chalkboard SE", Chalkboard, "Comic Sans MS", cursive' },
  { id: 'snell', name: 'Snell Roundhand', css: '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive' },
  { id: 'zapfino', name: 'Zapfino', css: 'Zapfino, "Segoe Script", cursive' },
];
function fontCSS(id) {
  if (id && id.startsWith('c_')) return `"TracoF-${id}", -apple-system, sans-serif`;
  const f = FONTS.find(x => x.id === id);
  return f ? f.css : FONTS[0].css;
}
function fontName(id) {
  if (id && id.startsWith('c_')) { const f = CustomFonts.list.find(x => x.id === id); return f ? f.name : 'Fonte importada'; }
  const f = FONTS.find(x => x.id === id);
  return f ? f.name : FONTS[0].name;
}

/* ===== Papéis ===== */
const PAGE_SIZES = { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } }; // A4 a 96 ppp
const TEMPLATES = [
  { id: 'blank', name: 'Liso' },
  { id: 'lined', name: 'Pautado' },
  { id: 'grid', name: 'Quadriculado' },
  { id: 'dots', name: 'Pontilhado' },
  { id: 'cornell', name: 'Cornell' },
  { id: 'music', name: 'Partitura' },
];
const PAPER_COLORS = [
  { c: '#FFFFFF', name: 'Branco' },
  { c: '#FBF7EC', name: 'Marfim' },
  { c: '#EEF3F8', name: 'Azulado' },
  { c: '#2B2E35', name: 'Grafite' },
  { c: '#141518', name: 'Preto' },
];
const MM = 3.7795; // unidades da página por milímetro

function isDark(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) < 110;
}

function newPage(paper) {
  const sz = PAGE_SIZES[paper.orient || 'portrait'];
  return { id: uid('p_'), w: sz.w, h: sz.h, paper: { tpl: paper.tpl || 'lined', color: paper.color || '#FFFFFF' }, bg: null, objects: [] };
}

function drawPaper(ctx, pg) {
  const { w, h } = pg, P = pg.paper;
  const dark = isDark(P.color);
  ctx.fillStyle = P.color;
  ctx.fillRect(0, 0, w, h);
  const line = dark ? 'rgba(255,255,255,0.15)' : 'rgba(64,104,168,0.26)';
  const strong = dark ? 'rgba(255,255,255,0.26)' : 'rgba(64,104,168,0.42)';
  const margin = dark ? 'rgba(255,120,120,0.35)' : 'rgba(214,64,64,0.42)';
  ctx.lineWidth = 0.8;
  const hl = (y, x0 = 0, x1 = w, c = line, lw = 0.8) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); };
  const vl = (x, y0 = 0, y1 = h, c = line, lw = 0.8) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); };
  switch (P.tpl) {
    case 'lined': {
      const sp = 7.1 * MM, top = 30 * MM;
      for (let y = top; y < h - 10 * MM; y += sp) hl(y);
      vl(w > h ? 28 * MM : 24 * MM, 0, h, margin, 1);
      break;
    }
    case 'grid': {
      const sp = 5 * MM;
      for (let y = sp; y < h; y += sp) hl(y, 0, w, line, 0.6);
      for (let x = sp; x < w; x += sp) vl(x, 0, h, line, 0.6);
      break;
    }
    case 'dots': {
      const sp = 5 * MM;
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.32)' : 'rgba(64,104,168,0.5)';
      for (let y = sp; y < h; y += sp) for (let x = sp; x < w; x += sp) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'cornell': {
      const top = 32 * MM, bottom = h - 50 * MM, cue = w > h ? 75 * MM : 62 * MM, sp = 7.1 * MM;
      for (let y = top + sp; y < bottom; y += sp) hl(y, cue, w);
      hl(top, 0, w, strong, 1.4);
      hl(bottom, 0, w, strong, 1.4);
      vl(cue, top, bottom, strong, 1.4);
      break;
    }
    case 'music': {
      const gap = 2.2 * MM, staff = gap * 4, between = 13 * MM, left = 14 * MM, right = w - 14 * MM;
      for (let y = 26 * MM; y + staff < h - 14 * MM; y += staff + between) {
        for (let i = 0; i < 5; i++) hl(y + i * gap, left, right, strong, 0.8);
      }
      break;
    }
    default: break;
  }
}

/* ===== Figurinhas prontas (desenhos próprios) ===== */
const tag = (txt, bg, fg, w = 230) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="64" viewBox="0 0 ${w} 64"><path d="M14 4h${w - 28}l12 28-12 28H14a10 10 0 0 1-10-10V14A10 10 0 0 1 14 4z" fill="${bg}"/><circle cx="20" cy="32" r="5" fill="${fg}" opacity=".85"/><text x="${(w + 18) / 2}" y="42" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="27" letter-spacing="1.5" fill="${fg}">${txt}</text></svg>`;
const BUILTIN_STICKERS = {
  estrela: { name: 'Estrela', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100"><path d="M50 6l12.6 27.6 30.2 3.4-22.5 20.4 6.3 29.7L50 72 23.4 87.1l6.3-29.7L7.2 37l30.2-3.4z" fill="#FFC93C" stroke="#E09B00" stroke-width="3" stroke-linejoin="round"/><circle cx="41" cy="46" r="3.6" fill="#5a3b00"/><circle cx="59" cy="46" r="3.6" fill="#5a3b00"/><path d="M43 56q7 6 14 0" stroke="#5a3b00" stroke-width="3" fill="none" stroke-linecap="round"/></svg>' },
  coracao: { name: 'Coração', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="190" viewBox="0 0 100 95"><path d="M50 88S8 62 8 34a21 21 0 0 1 42-6 21 21 0 0 1 42 6c0 28-42 54-42 54z" fill="#FF5A6E" stroke="#D63A4E" stroke-width="3"/><path d="M26 28q6-9 15-5" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".75"/></svg>' },
  feito: { name: 'Feito', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#2FB36B"/><circle cx="50" cy="50" r="44" fill="none" stroke="#1E8A50" stroke-width="3"/><path d="M29 52l14 14 29-31" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  seta: { name: 'Seta', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 120 80"><path d="M10 64C26 28 58 18 98 30" stroke="#2443D6" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M80 14l19 16-17 19" stroke="#2443D6" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  postit: { name: 'Post-it', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 100 100"><path d="M6 8h88v64L72 94H6z" fill="#FFE77A"/><path d="M94 72H72v22z" fill="#E6C64A"/><path d="M6 8h88v9H6z" fill="#000" opacity=".06"/></svg>' },
  postitRosa: { name: 'Post-it rosa', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 100 100"><path d="M6 8h88v64L72 94H6z" fill="#FFB3CF"/><path d="M94 72H72v22z" fill="#E68AAE"/><path d="M6 8h88v9H6z" fill="#000" opacity=".06"/></svg>' },
  washi: { name: 'Fita washi', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="70" viewBox="0 0 160 35"><defs><pattern id="p" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="12" height="12" fill="#8FD3C8"/><rect width="6" height="12" fill="#B9E6DE"/></pattern></defs><path d="M4 3l4 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-4 3h152l-4-3 3-3-3-3 3-3-3-3 3-3-3-3 3-3-3-3 3-3 4-3z" fill="url(#p)" opacity=".88"/></svg>' },
  washiRosa: { name: 'Fita bolinhas', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="70" viewBox="0 0 160 35"><defs><pattern id="d" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#F7B6C9"/><circle cx="5" cy="5" r="2" fill="#fff"/></pattern></defs><path d="M4 3l4 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-4 3h152l-4-3 3-3-3-3 3-3-3-3 3-3-3-3 3-3-3-3 3-3 4-3z" fill="url(#d)" opacity=".9"/></svg>' },
  importante: { name: 'Importante', svg: tag('IMPORTANTE', '#E5484D', '#fff', 250) },
  prova: { name: 'Prova', svg: tag('PROVA', '#FFC93C', '#3B2A00', 170) },
  revisar: { name: 'Revisar', svg: tag('REVISAR', '#2FB36B', '#fff', 190) },
  todo: { name: 'A fazer', svg: tag('A FAZER', '#2443D6', '#fff', 190) },
  ideia: { name: 'Ideia', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="220" viewBox="0 0 90 110"><path d="M45 8a30 30 0 0 0-18 54c4 3 6 7 6 12v4h24v-4c0-5 2-9 6-12A30 30 0 0 0 45 8z" fill="#FFE066" stroke="#E0A800" stroke-width="3"/><rect x="33" y="80" width="24" height="7" rx="2" fill="#8A8F99"/><rect x="35" y="89" width="20" height="7" rx="2" fill="#6B707A"/><path d="M37 46q8-9 16 0" stroke="#E0A800" stroke-width="3" fill="none"/><path d="M45 2v-4M12 14l-4-4M78 14l4-4" stroke="#E0A800" stroke-width="3" stroke-linecap="round"/></svg>' },
  alfinete: { name: 'Alfinete', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="200" viewBox="0 0 70 100"><path d="M35 60v34" stroke="#8A8F99" stroke-width="4" stroke-linecap="round"/><ellipse cx="35" cy="56" rx="24" ry="8" fill="#C62F3A"/><path d="M22 54l4-34h18l4 34z" fill="#E5484D"/><ellipse cx="35" cy="18" rx="17" ry="9" fill="#FF6B74"/><ellipse cx="29" cy="16" rx="5" ry="2.5" fill="#fff" opacity=".7"/></svg>' },
  balao: { name: 'Balão de fala', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="200" viewBox="0 0 130 100"><path d="M18 6h94a12 12 0 0 1 12 12v46a12 12 0 0 1-12 12H48L26 94l4-18H18A12 12 0 0 1 6 64V18A12 12 0 0 1 18 6z" fill="#fff" stroke="#1B1F2A" stroke-width="4" stroke-linejoin="round"/></svg>' },
  atencao: { name: 'Atenção', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 100 90"><path d="M50 6L95 84H5z" fill="#FFB020" stroke="#C77D00" stroke-width="4" stroke-linejoin="round"/><path d="M50 32v24" stroke="#2A1D00" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="70" r="5" fill="#2A1D00"/></svg>' },
  brilho: { name: 'Brilhos', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100"><path d="M40 10q4 26 30 30-26 4-30 30-4-26-30-30 26-4 30-30z" fill="#9B7BFF"/><path d="M76 52q2 13 15 15-13 2-15 15-2-13-15-15 13-2 15-15z" fill="#FF8AC8"/><path d="M78 8q1.6 10 12 12-10.4 2-12 12-1.6-10-12-12 10.4-2 12-12z" fill="#FFC93C"/></svg>' },
  calendario: { name: 'Calendário', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100"><rect x="10" y="16" width="80" height="76" rx="10" fill="#fff" stroke="#1B1F2A" stroke-width="4"/><path d="M10 26a10 10 0 0 1 10-10h60a10 10 0 0 1 10 10v12H10z" fill="#E5484D"/><path d="M30 8v16M70 8v16" stroke="#1B1F2A" stroke-width="5" stroke-linecap="round"/><g fill="#C9CDD6"><rect x="22" y="48" width="12" height="10" rx="2"/><rect x="44" y="48" width="12" height="10" rx="2"/><rect x="66" y="48" width="12" height="10" rx="2"/><rect x="22" y="66" width="12" height="10" rx="2"/><rect x="66" y="66" width="12" height="10" rx="2"/></g><rect x="44" y="66" width="12" height="10" rx="2" fill="#2443D6"/></svg>' },
};
const EMOJIS = ['😀', '😂', '🥰', '😎', '🤓', '🤔', '😴', '🥳', '😭', '😡', '🤯', '🫠', '👍', '👏', '🙏', '💪', '✌️', '👀', '❤️', '💙', '🔥', '⭐', '✨', '💡', '📌', '📎', '📚', '✏️', '📝', '📅', '⏰', '✅', '❌', '⚠️', '❓', '❗', '🎯', '🏆', '🎉', '🎁', '☕', '🍕', '🌱', '🌸', '🌈', '☀️', '🌙', '⚡', '💯', '🚀', '🎵', '🧠', '💬', '🐱', '🐶', '🦋'];
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/* ===== Geometria dos traços ===== */
const pathCache = new WeakMap();
let boxCache = new WeakMap();
let layoutCache = new WeakMap();
function resetTextCaches() { boxCache = new WeakMap(); layoutCache = new WeakMap(); }

function centerPath(pts) {
  const p = new Path2D(), n = pts.length / 3;
  if (!n) return p;
  p.moveTo(pts[0], pts[1]);
  if (n === 1) { p.lineTo(pts[0] + 0.01, pts[1]); return p; }
  for (let i = 1; i < n - 1; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], nx = pts[i * 3 + 3], ny = pts[i * 3 + 4];
    p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  p.lineTo(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1]);
  return p;
}

function outlinePath(pts, size, thin) {
  const n = pts.length / 3, P = new Path2D();
  if (!n) return P;
  const R = new Array(n);
  let prev = null;
  for (let i = 0; i < n; i++) {
    const pr = clamp(pts[i * 3 + 2], 0, 1);
    let r = (size / 2) * (1 - thin + thin * clamp(pr * 1.6, 0, 1));
    if (prev != null) r = prev * 0.55 + r * 0.45;
    R[i] = Math.max(r, 0.3);
    prev = R[i];
  }
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2]);
  if (n === 1 || len < 0.5) { P.arc(pts[0], pts[1], R[0], 0, Math.PI * 2); return P; }
  const Lx = [], Ly = [], Rx = [], Ry = [], A = [];
  for (let i = 0; i < n; i++) {
    let a = i - 1, b = i + 1;
    if (a < 0) a = 0; if (b > n - 1) b = n - 1;
    let tx = pts[b * 3] - pts[a * 3], ty = pts[b * 3 + 1] - pts[a * 3 + 1];
    let d = Math.hypot(tx, ty);
    if (d < 1e-6) { if (i > 0) { A.push(A[i - 1]); const nx0 = Math.cos(A[i]), ny0 = Math.sin(A[i]); Lx.push(pts[i * 3] + nx0 * R[i]); Ly.push(pts[i * 3 + 1] + ny0 * R[i]); Rx.push(pts[i * 3] - nx0 * R[i]); Ry.push(pts[i * 3 + 1] - ny0 * R[i]); continue; } tx = 1; ty = 0; d = 1; }
    tx /= d; ty /= d;
    const nx = -ty, ny = tx, x = pts[i * 3], y = pts[i * 3 + 1];
    Lx.push(x + nx * R[i]); Ly.push(y + ny * R[i]);
    Rx.push(x - nx * R[i]); Ry.push(y - ny * R[i]);
    A.push(Math.atan2(ny, nx));
  }
  P.moveTo(Lx[0], Ly[0]);
  for (let i = 1; i < n; i++) P.quadraticCurveTo(Lx[i - 1], Ly[i - 1], (Lx[i - 1] + Lx[i]) / 2, (Ly[i - 1] + Ly[i]) / 2);
  P.lineTo(Lx[n - 1], Ly[n - 1]);
  P.arc(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1], R[n - 1], A[n - 1], A[n - 1] - Math.PI, true);
  for (let i = n - 2; i >= 0; i--) P.quadraticCurveTo(Rx[i + 1], Ry[i + 1], (Rx[i + 1] + Rx[i]) / 2, (Ry[i + 1] + Ry[i]) / 2);
  P.lineTo(Rx[0], Ry[0]);
  P.arc(pts[0], pts[1], R[0], A[0] + Math.PI, A[0], true);
  P.closePath();
  return P;
}

const THIN = { pen: 0.55, pencil: 0.35, hl: 0 };
function strokePath(o, nocache) {
  if (!nocache) { const c = pathCache.get(o); if (c) return c; }
  const p = o.tool === 'hl' ? centerPath(o.pts) : outlinePath(o.pts, o.size, THIN[o.tool] ?? 0.5);
  if (!nocache) pathCache.set(o, p);
  return p;
}

/* textura do lápis */
let noiseCanvas = null;
const patCache = new Map();
function pencilPattern(ctx, color) {
  let p = patCache.get(color);
  if (p) return p;
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = noiseCanvas.height = 96;
    const nx = noiseCanvas.getContext('2d');
    const id = nx.createImageData(96, 96);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random();
      id.data[i + 3] = v < 0.2 ? 0 : Math.round(120 + 135 * Math.random());
    }
    nx.putImageData(id, 0, 0);
  }
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 96, 96);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(noiseCanvas, 0, 0);
  p = ctx.createPattern(c, 'repeat');
  try { p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0])); } catch (e) { /* ok */ }
  patCache.set(color, p);
  return p;
}

function drawStroke(ctx, o, env, nocache) {
  const path = strokePath(o, nocache);
  if (o.tool === 'hl') {
    ctx.save();
    ctx.globalAlpha = env && env.dark ? 0.45 : 0.38;
    if (!(env && env.dark) && !(env && env.live)) ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = o.color; ctx.lineWidth = o.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.restore();
  } else if (o.tool === 'pencil') {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pencilPattern(ctx, o.color);
    ctx.fill(path);
    ctx.restore();
  } else {
    ctx.fillStyle = o.color;
    ctx.fill(path);
  }
}

/* ===== Texto ===== */
const measureCtx = document.createElement('canvas').getContext('2d');
function textFont(o, scale = 1) { return `${o.italic ? 'italic ' : ''}${o.bold ? '700' : '400'} ${o.size * scale}px ${fontCSS(o.font)}`; }
function layoutText(o) {
  let L = layoutCache.get(o);
  if (L) return L;
  measureCtx.font = textFont(o);
  const lines = [], maxW = Math.max(10, o.w);
  for (const para of String(o.text || '').split('\n')) {
    if (para === '') { lines.push(''); continue; }
    const words = para.split(/(\s+)/);
    let line = '';
    for (const wd of words) {
      const test = line + wd;
      if (measureCtx.measureText(test).width > maxW && line.trim() !== '') {
        lines.push(line.replace(/\s+$/, ''));
        line = wd.replace(/^\s+/, '');
      } else line = test;
      while (measureCtx.measureText(line).width > maxW && line.length > 1) {
        let k = line.length;
        while (k > 1 && measureCtx.measureText(line.slice(0, k)).width > maxW) k--;
        lines.push(line.slice(0, k));
        line = line.slice(k);
      }
    }
    lines.push(line);
  }
  const lh = o.size * 1.3;
  L = { lines, lh, h: Math.max(1, lines.length) * lh };
  layoutCache.set(o, L);
  return L;
}
function drawText(ctx, o) {
  const L = layoutText(o);
  ctx.save();
  ctx.font = textFont(o);
  ctx.fillStyle = o.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = o.align || 'left';
  const x = o.align === 'center' ? o.x + o.w / 2 : o.align === 'right' ? o.x + o.w : o.x;
  L.lines.forEach((ln, i) => ctx.fillText(ln, x, o.y + i * L.lh + L.lh / 2));
  ctx.restore();
}

/* ===== Objetos ===== */
function objBox(o) {
  let b = boxCache.get(o);
  if (b) return b;
  if (o.t === 's') {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < o.pts.length; i += 3) {
      const x = o.pts[i], y = o.pts[i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const r = o.size / 2 + 1;
    b = { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 * r };
  } else if (o.t === 'txt') {
    b = { x: o.x, y: o.y, w: o.w, h: layoutText(o).h };
  } else {
    const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), hw = o.w / 2, hh = o.h / 2;
    const ex = Math.abs(hw * c) + Math.abs(hh * s), ey = Math.abs(hw * s) + Math.abs(hh * c);
    const cx = o.x + hw, cy = o.y + hh;
    b = { x: cx - ex, y: cy - ey, w: 2 * ex, h: 2 * ey };
  }
  boxCache.set(o, b);
  return b;
}
function unionBox(objs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of objs) { const b = objBox(o); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function hitObj(o, x, y, tol) {
  const b = objBox(o);
  if (x < b.x - tol || x > b.x + b.w + tol || y < b.y - tol || y > b.y + b.h + tol) return false;
  if (o.t === 's') {
    const n = o.pts.length / 3, r = o.size / 2 + tol;
    if (n === 1) return Math.hypot(x - o.pts[0], y - o.pts[1]) <= r;
    for (let i = 1; i < n; i++) if (distSeg(x, y, o.pts[i * 3 - 3], o.pts[i * 3 - 2], o.pts[i * 3], o.pts[i * 3 + 1]) <= r) return true;
    return false;
  }
  if (o.t === 'txt') return true;
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, a = -(o.rot || 0);
  const lx = (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), ly = (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a);
  return Math.abs(lx) <= o.w / 2 + tol && Math.abs(ly) <= o.h / 2 + tol;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inLasso(o, poly) {
  if (o.t === 's') {
    const n = o.pts.length / 3;
    let c = 0;
    for (let i = 0; i < n; i++) if (pointInPoly(o.pts[i * 3], o.pts[i * 3 + 1], poly)) c++;
    return c / n >= 0.5;
  }
  const b = objBox(o);
  return pointInPoly(b.x + b.w / 2, b.y + b.h / 2, poly);
}

/* Aplica uma transformação afim M=[a,b,c,d,e,f], escala k e rotação ang */
function transformObj(o, M, k, ang) {
  const ap = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  if (o.t === 's') {
    const pts = o.pts.slice();
    for (let i = 0; i < pts.length; i += 3) { const [x, y] = ap(pts[i], pts[i + 1]); pts[i] = x; pts[i + 1] = y; }
    return Object.assign({}, o, { pts, size: o.size * k });
  }
  if (o.t === 'txt') {
    const L = layoutText(o);
    const [cx, cy] = ap(o.x + o.w / 2, o.y + L.h / 2);
    const w = o.w * k;
    return Object.assign({}, o, { x: cx - w / 2, y: cy - (L.h * k) / 2, w, size: o.size * k });
  }
  const [cx, cy] = ap(o.x + o.w / 2, o.y + o.h / 2);
  const w = o.w * k, hh = o.h * k;
  return Object.assign({}, o, { x: cx - w / 2, y: cy - hh / 2, w, h: hh, rot: (o.rot || 0) + ang });
}

function drawObject(ctx, o, env) {
  if (o.t === 's') { drawStroke(ctx, o, env); return; }
  if (o.t === 'txt') { drawText(ctx, o); return; }
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  if (o.rot) ctx.rotate(o.rot);
  if (o.t === 'stk' && o.emoji) {
    ctx.font = `${o.h * 0.82}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.emoji, 0, o.h * 0.05);
  } else {
    const el = Assets.get(o.asset);
    if (el) ctx.drawImage(el, -o.w / 2, -o.h / 2, o.w, o.h);
    else { ctx.fillStyle = 'rgba(120,130,150,0.15)'; ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); }
  }
  ctx.restore();
}

function drawPage(ctx, pg, opts = {}) {
  ctx.save();
  if (opts.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(20,24,40,0.16)';
    ctx.shadowBlur = opts.shadowBlur || 16;
    ctx.shadowOffsetY = (opts.shadowBlur || 16) / 4;
    ctx.fillStyle = pg.paper.color;
    ctx.fillRect(0, 0, pg.w, pg.h);
    ctx.restore();
  }
  ctx.beginPath(); ctx.rect(0, 0, pg.w, pg.h); ctx.clip();
  drawPaper(ctx, pg);
  if (pg.bg) {
    const el = Assets.get(pg.bg);
    if (el) {
      const iw = el.naturalWidth || el.width, ih = el.naturalHeight || el.height;
      const k = Math.min(pg.w / iw, pg.h / ih);
      ctx.drawImage(el, (pg.w - iw * k) / 2, (pg.h - ih * k) / 2, iw * k, ih * k);
    }
  }
  const env = { dark: isDark(pg.paper.color) };
  const V = opts.view;
  for (const o of pg.objects) {
    if (opts.exclude && opts.exclude.has(o.id)) continue;
    if (V) { const b = objBox(o); if (b.x > V.x1 || b.y > V.y1 || b.x + b.w < V.x0 || b.y + b.h < V.y0) continue; }
    drawObject(ctx, o, env);
  }
  ctx.restore();
}

function pageAssetIds(pg) {
  const ids = [];
  if (pg.bg) ids.push(pg.bg);
  for (const o of pg.objects) if ((o.t === 'img' || o.t === 'stk') && o.asset) ids.push(o.asset);
  return ids;
}

/* ===== Reconhecimento de formas (segurar no fim do traço) ===== */
function recognizeShape(pts) {
  const n = pts.length / 3;
  if (n < 4) return null;
  let len = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (i) len += Math.hypot(x - pts[i * 3 - 3], y - pts[i * 3 - 2]);
  }
  if (len < 24) return null;
  const ax = pts[0], ay = pts[1], bx = pts[(n - 1) * 3], by = pts[(n - 1) * 3 + 1];
  const chord = Math.hypot(bx - ax, by - ay);
  if (chord > 0.86 * len) return { kind: 'line', ax, ay, bx, by };
  const w = x1 - x0, hh = y1 - y0, diag = Math.hypot(w, hh);
  if (chord < 0.28 * diag && w > 12 && hh > 12) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = w / 2, ry = hh / 2;
    let eErr = 0, rErr = 0;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3], y = pts[i * 3 + 1];
      eErr += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1);
      rErr += Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1)) / (Math.min(w, hh) / 2);
    }
    eErr /= n; rErr /= n;
    if (eErr < rErr && eErr < 0.2) return { kind: 'ellipse', cx, cy, rx, ry };
    if (rErr <= eErr && rErr < 0.2) return { kind: 'rect', x0, y0, x1, y1 };
  }
  return null;
}
function densify(list, pr, step = 3) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const [x, y] = list[i];
    if (i) {
      const [px, py] = list[i - 1];
      const d = Math.hypot(x - px, y - py), k = Math.ceil(d / step);
      for (let j = 1; j < k; j++) out.push(px + ((x - px) * j) / k, py + ((y - py) * j) / k, pr);
    }
    out.push(x, y, pr);
  }
  return out;
}
function shapePoints(s, pr) {
  if (s.kind === 'line') return densify([[s.ax, s.ay], [s.bx, s.by]], pr);
  if (s.kind === 'rect') return densify([[s.x0, s.y0], [s.x1, s.y0], [s.x1, s.y1], [s.x0, s.y1], [s.x0, s.y0]], pr);
  const list = [];
  const N = 96;
  for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + (i / N) * Math.PI * 2; list.push([s.cx + Math.cos(a) * s.rx, s.cy + Math.sin(a) * s.ry]); }
  return densify(list, pr);
}

/* ===== PDF simples (cada página vira uma imagem JPEG) ===== */
function buildPDF(pages) {
  const enc = new TextEncoder();
  const chunks = [], offsets = [];
  let off = 0;
  const push = d => { const u = typeof d === 'string' ? enc.encode(d) : d; chunks.push(u); off += u.length; };
  const obj = (num, body) => { offsets[num] = off; push(`${num} 0 obj\n`); body(); push('\nendobj\n'); };
  const N = pages.length;
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R /Producer (Traco) >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${N} >>`));
  pages.forEach((p, i) => {
    const pn = 3 + 3 * i, cn = 4 + 3 * i, im = 5 + 3 * i;
    const W = p.wpt.toFixed(2), H = p.hpt.toFixed(2);
    obj(pn, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${cn} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(cn, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(im, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      push('\nendstream');
    });
  });
  const xref = off, total = 3 + 3 * N;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
