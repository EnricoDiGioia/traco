'use strict';
/* ===================================================================
   Traço — caderno de anotações à mão (iPhone / iPad / navegador)
   =================================================================== */
const COVER_COLORS = ['#2443D6', '#1F7A5C', '#C2412D', '#E2A31B', '#6B46C1', '#22262F', '#D9668F', '#3E8EB8'];
const PEN_COLORS = ['#171B26', '#2443D6', '#D33A2C', '#1F8A4C', '#E08A00', '#7A3FD1', '#D9468F', '#FFFFFF'];
const HL_COLORS = ['#FFE14D', '#8BEA7B', '#7FD3FF', '#FF9AD5', '#FFB65C', '#C3A6FF'];
const RANGES = { pen: [0.5, 20, 0.5], pencil: [1, 24, 0.5], hl: [6, 48, 1], eraser: [6, 90, 1] };
const MIN_S = 0.2, MAX_S = 8;

const S = {
  meta: null, pages: [], pi: 0, tool: 'pen', sel: null, hideIds: null, editing: null,
  undo: [], redo: [], clip: null, lasers: [], hover: null, eraserPos: null, dirty: false, fitS: 1,
  get page() { return this.pages[this.pi]; },
};
let settings = { pencilOnly: false, autoPencil: true, twoFingerUndo: true, holdShapes: true };
let tools = {
  pen: { color: '#2443D6', size: 3 },
  pencil: { color: '#3A3D45', size: 4 },
  hl: { color: '#FFE14D', size: 20 },
  eraser: { size: 22, mode: 'partial', hlOnly: false },
  text: { font: 'sf', size: 24, color: '#171B26', bold: false, italic: false, align: 'left' },
};
let recent = [];
let ACC = '#2443D6';
const readAccent = () => { ACC = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2443D6'; };

/* ===================== Componentes de interface ===================== */
let toastT = 0;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms);
}

let openPop = null;
function popOutside(e) { if (openPop && !openPop.contains(e.target)) closePopover(); }
function closePopover() {
  if (!openPop) return;
  openPop.remove(); openPop = null;
  document.removeEventListener('pointerdown', popOutside, true);
}
function popover(anchor, content) {
  closePopover();
  const el = h('div', { class: 'popover', role: 'menu' }, content);
  document.body.append(el);
  const r = anchor.getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight;
  let x = r.right - pw; x = clamp(x, 8, innerWidth - pw - 8);
  let y = r.bottom + 6; if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 6);
  el.style.left = x + 'px'; el.style.top = y + 'px';
  openPop = el;
  setTimeout(() => document.addEventListener('pointerdown', popOutside, true), 0);
  return el;
}
function menu(anchor, items) {
  return popover(anchor, items.filter(Boolean).map(it => it === '-' ? h('div', { class: 'menu-sep' }) :
    h('button', { type: 'button', class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', onclick: () => { closePopover(); it.action(); } },
      icon(it.icon), h('span', {}, it.label, it.sub ? h('small', {}, it.sub) : null))));
}

function sheet({ title, body, actions, wide, onClose }) {
  closePopover();
  const back = h('div', { class: 'backdrop' });
  let closed = false;
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => {
    if (closed) return; closed = true;
    back.remove(); document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  const acts = typeof actions === 'function' ? actions(close) : actions;
  const box = h('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', {}, h('h2', {}, title), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', onclick: close }, icon('close'))),
    bodyEl,
    acts && acts.length ? h('footer', {}, acts) : null);
  back.append(box);
  back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  return { close, el: box, body: bodyEl };
}
function confirmDlg(title, msg, ok = 'Confirmar', danger = false) {
  return new Promise(res => {
    let val = false;
    sheet({
      title, body: h('p', {}, msg), onClose: () => res(val),
      actions: close => [
        h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { val = true; close(); } }, ok),
      ],
    });
  });
}
function promptDlg(title, label, value = '') {
  return new Promise(res => {
    let val = null;
    const inp = h('input', { class: 'text-field', type: 'text', value, id: 'promptField' });
    const sh = sheet({
      title, body: h('label', { class: 'field' }, h('span', {}, label), inp), onClose: () => res(val),
      actions: close => [
        h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { val = inp.value.trim(); close(); } }, 'Salvar'),
      ],
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { val = inp.value.trim(); sh.close(); } });
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  });
}
function seg(options, cur, onChange, label) {
  return h('div', { class: 'seg', role: 'group', 'aria-label': label || '' }, options.map(([v, l, ic]) =>
    h('button', { type: 'button', class: v === cur ? 'on' : '', 'aria-pressed': String(v === cur), 'aria-label': ic ? l : null, title: ic ? l : null, onclick: () => onChange(v) }, ic ? icon(ic) : l)));
}
function switchRow(title, sub, val, onChange) {
  const inp = h('input', { type: 'checkbox', role: 'switch' });
  inp.checked = !!val;
  inp.addEventListener('change', () => onChange(inp.checked));
  return h('label', { class: 'opt-row' }, h('div', {}, h('strong', {}, title), sub ? h('small', {}, sub) : null), h('span', { class: 'switch' }, inp, h('span')));
}

/* ===================== Biblioteca ===================== */
async function showLibrary() {
  if (S.meta) { commitText(); await saveNow(); }
  S.meta = null; S.pages = []; S.undo = []; S.redo = []; S.sel = null; A = null;
  $('#editor').hidden = true; $('#library').hidden = false;
  await renderLibrary();
  gcAssets();
}
async function renderLibrary() {
  const grid = $('#libGrid');
  let metas = [];
  try { metas = await DB.all('meta'); } catch (e) { /* vazio */ }
  metas.sort((a, b) => b.updated - a.updated);
  const q = $('#libSearch').value.trim().toLowerCase();
  const list = q ? metas.filter(m => m.title.toLowerCase().includes(q)) : metas;
  grid.replaceChildren();
  if (!list.length) {
    grid.append(h('div', { class: 'empty' }, icon('book'),
      h('strong', {}, q ? 'Nenhum caderno com esse nome' : 'Nenhum caderno ainda'),
      h('span', {}, q ? 'Tente outra palavra.' : 'Toque em “Novo caderno” para começar.')));
    return;
  }
  for (const m of list) grid.append(nbCard(m));
}
function nbCard(m) {
  const more = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Opções de ' + m.title }, icon('more'));
  more.addEventListener('click', () => nbMenu(m, more));
  return h('div', { class: 'nb' },
    h('button', { type: 'button', class: 'nb-cover', style: { '--cover': m.cover }, 'aria-label': 'Abrir ' + m.title, onclick: () => openNotebook(m.id) },
      h('span', { class: 'nb-spine' }), h('span', { class: 'nb-band' }), h('span', { class: 'nb-label' }, m.title)),
    h('div', { class: 'nb-meta' },
      h('div', {}, h('div', { class: 'nb-title' }, m.title), h('div', { class: 'nb-sub' }, `${m.pageCount} ${m.pageCount === 1 ? 'página' : 'páginas'} · ${timeAgo(m.updated)}`)),
      more));
}
function nbMenu(m, anchor) {
  menu(anchor, [
    { icon: 'text', label: 'Renomear', action: async () => { const t = await promptDlg('Renomear caderno', 'Nome', m.title); if (t) { m.title = t; await DB.put('meta', m); renderLibrary(); } } },
    { icon: 'palette', label: 'Mudar a capa', action: () => coverSheet(m) },
    { icon: 'dup', label: 'Duplicar', action: () => duplicateNotebook(m) },
    { icon: 'share', label: 'Exportar…', sub: 'PDF ou arquivo do Traço', action: async () => { const c = await DB.get('content', m.id); if (c) exportSheet([{ meta: m, pages: c.pages }]); } },
    '-',
    { icon: 'trash', label: 'Apagar caderno', danger: true, action: async () => {
      if (await confirmDlg('Apagar caderno?', `“${m.title}” e todas as páginas serão apagados deste aparelho. Isso não pode ser desfeito.`, 'Apagar', true)) {
        await DB.del('meta', m.id); await DB.del('content', m.id); renderLibrary(); toast('Caderno apagado.');
      } } },
  ]);
}
function coverSheet(m) {
  const row = h('div', { class: 'cover-row' });
  const draw = () => row.replaceChildren(...COVER_COLORS.map(c => h('button', { type: 'button', class: 'cover-dot' + (c === m.cover ? ' on' : ''), style: { '--c': c }, 'aria-label': 'Capa ' + c, onclick: async () => { m.cover = c; draw(); await DB.put('meta', m); renderLibrary(); } })));
  draw();
  sheet({ title: 'Cor da capa', body: row });
}
async function duplicateNotebook(m) {
  const c = await DB.get('content', m.id);
  if (!c) return;
  const now = Date.now();
  const meta = Object.assign({}, m, { id: uid('n_'), title: m.title + ' (cópia)', created: now, updated: now });
  const pages = JSON.parse(JSON.stringify(c.pages)).map(p => Object.assign(p, { id: uid('p_') }));
  await DB.put('content', { id: meta.id, pages }); await DB.put('meta', meta);
  renderLibrary(); toast('Caderno duplicado.');
}

function paperPreview(tpl, color, orient) {
  const sz = PAGE_SIZES[orient], cw = orient === 'portrait' ? 64 : 90, k = cw / sz.w, d = Math.min(devicePixelRatio || 1, 3);
  const c = document.createElement('canvas');
  c.width = cw * d; c.height = sz.h * k * d;
  c.style.width = cw + 'px'; c.style.height = sz.h * k + 'px';
  const x = c.getContext('2d');
  x.setTransform(k * d, 0, 0, k * d, 0, 0);
  drawPaper(x, { w: sz.w, h: sz.h, paper: { tpl, color } });
  return c;
}
function paperPicker(state, onChange) {
  const wrap = h('div', { class: 'sheet-body', style: { padding: 0 } });
  const draw = () => {
    wrap.replaceChildren(
      h('div', { class: 'field' }, h('span', {}, 'Papel'),
        h('div', { class: 'choice-grid' }, TEMPLATES.map(t => h('button', { type: 'button', class: 'choice' + (t.id === state.tpl ? ' on' : ''), 'aria-pressed': String(t.id === state.tpl), onclick: () => { state.tpl = t.id; draw(); onChange && onChange(); } }, paperPreview(t.id, state.color, state.orient), t.name)))),
      h('div', { class: 'field' }, h('span', {}, 'Cor do papel'),
        h('div', { class: 'paper-row' }, PAPER_COLORS.map(p => h('button', { type: 'button', class: 'cover-dot' + (p.c === state.color ? ' on' : ''), style: { '--c': p.c }, 'aria-label': p.name, title: p.name, onclick: () => { state.color = p.c; draw(); onChange && onChange(); } })))),
      h('div', { class: 'field' }, h('span', {}, 'Orientação'),
        seg([['portrait', 'Retrato (A4)'], ['landscape', 'Paisagem (A4)']], state.orient, v => { state.orient = v; draw(); onChange && onChange(); }, 'Orientação')));
  };
  draw();
  return wrap;
}
function newNotebookDialog() {
  const st = { tpl: 'lined', color: '#FFFFFF', orient: 'portrait' };
  let cover = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
  const title = h('input', { class: 'text-field', type: 'text', placeholder: 'Ex.: Cálculo II, Diário, Reuniões', id: 'newNbTitle' });
  const covers = h('div', { class: 'cover-row' });
  const drawCovers = () => covers.replaceChildren(...COVER_COLORS.map(c => h('button', { type: 'button', class: 'cover-dot' + (c === cover ? ' on' : ''), style: { '--c': c }, 'aria-label': 'Capa ' + c, onclick: () => { cover = c; drawCovers(); } })));
  drawCovers();
  const create = async close => {
    const meta = await createNotebook({ title: title.value.trim() || 'Sem título', cover, paper: Object.assign({}, st) });
    close(); openNotebook(meta.id);
  };
  sheet({
    title: 'Novo caderno', wide: true,
    body: [h('label', { class: 'field' }, h('span', {}, 'Nome'), title), h('div', { class: 'field' }, h('span', {}, 'Capa'), covers), paperPicker(st)],
    actions: close => [
      h('button', { type: 'button', class: 'btn ghost', style: { marginRight: 'auto' }, onclick: async () => {
        const files = await pickFiles('application/pdf,.pdf');
        if (!files.length) return;
        close();
        const meta = await importPdfAsNotebook(files[0]);
        if (meta) { if (title.value.trim()) { meta.title = title.value.trim(); meta.cover = cover; await DB.put('meta', meta); } openNotebook(meta.id); }
      } }, icon('pdf'), 'Começar de um PDF'),
      h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancelar'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => create(close) }, 'Criar caderno'),
    ],
  });
  setTimeout(() => title.focus(), 60);
}
async function createNotebook({ title, cover, paper, pages }) {
  const now = Date.now();
  const meta = { id: uid('n_'), title, cover, created: now, updated: now, pageCount: (pages || [1]).length, paper, lastPage: 0 };
  await DB.put('content', { id: meta.id, pages: pages || [newPage(paper)] });
  await DB.put('meta', meta);
  return meta;
}

/* ===================== Abrir, salvar ===================== */
async function openNotebook(id) {
  const meta = await DB.get('meta', id), content = await DB.get('content', id);
  if (!meta || !content) { toast('Não foi possível abrir esse caderno.'); return; }
  S.meta = meta;
  S.pages = content.pages.length ? content.pages : [newPage(meta.paper || {})];
  S.pi = clamp(meta.lastPage || 0, 0, S.pages.length - 1);
  S.undo = []; S.redo = []; S.sel = null; S.hideIds = null; S.editing = null; S.lasers = []; A = null;
  $('#library').hidden = true; $('#editor').hidden = false;
  $('#nbTitle').value = meta.title;
  setSaveState('');
  resize(true);
  updatePageUI(); setTool(S.tool); updateUndoUI();
  Assets.ensure(pageAssetIds(S.page)).then(() => requestRender());
}
let saveTimer = 0;
function setSaveState(t) { $('#saveState').textContent = t; }
function markDirty() {
  S.dirty = true; setSaveState('Salvando…');
  clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700);
  updateUndoUI();
}
async function saveNow() {
  clearTimeout(saveTimer);
  if (!S.dirty || !S.meta) return;
  S.dirty = false;
  const meta = S.meta;
  meta.updated = Date.now(); meta.pageCount = S.pages.length; meta.lastPage = S.pi;
  try {
    await DB.put('content', { id: meta.id, pages: S.pages });
    await DB.put('meta', meta);
    setSaveState(DB.volatile ? 'Sem salvamento aqui' : 'Salvo');
  } catch (e) {
    S.dirty = true; setSaveState('Erro ao salvar');
    toast('Não consegui salvar. O armazenamento pode estar cheio: exporte o caderno.');
  }
}

/* ===================== Mesa e desenho na tela ===================== */
const stage = $('#stage'), cvB = $('#cvBase'), cvL = $('#cvLive'), ta = $('#textEditor');
const cB = cvB.getContext('2d'), cL = cvL.getContext('2d');
let dpr = 1, SW = 0, SH = 0, stageRect = { left: 0, top: 0 }, lastW = 0;
const V = { s: 1, x: 0, y: 0 };
let A = null; // ação em andamento
const toPage = (sx, sy) => ({ x: (sx - V.x) / V.s, y: (sy - V.y) / V.s });
function evPos(e) { return { sx: e.clientX - stageRect.left, sy: e.clientY - stageRect.top }; }

function resize(forceFit) {
  if ($('#editor').hidden) return;
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const r = stage.getBoundingClientRect();
  stageRect = r; SW = r.width; SH = r.height;
  for (const c of [cvB, cvL]) { c.width = Math.max(1, Math.round(SW * dpr)); c.height = Math.max(1, Math.round(SH * dpr)); c.style.width = SW + 'px'; c.style.height = SH + 'px'; }
  if (forceFit || Math.abs(SW - lastW) > 40) fitWidth();
  lastW = SW;
  requestRender();
}
function fitWidth() {
  const pg = S.page; if (!pg) return;
  const pad = SW < 600 ? 8 : 28;
  V.s = clamp(Math.min((SW - pad * 2) / pg.w, 2.2), MIN_S, MAX_S);
  S.fitS = V.s;
  V.x = (SW - pg.w * V.s) / 2; V.y = pad;
  requestRender();
}
function fitWhole() {
  const pg = S.page; const pad = 20;
  V.s = clamp(Math.min((SW - pad * 2) / pg.w, (SH - pad * 2) / pg.h), MIN_S, MAX_S);
  V.x = (SW - pg.w * V.s) / 2; V.y = (SH - pg.h * V.s) / 2;
  requestRender();
}
function clampView() {
  const pg = S.page, w = pg.w * V.s, hh = pg.h * V.s;
  V.x = clamp(V.x, Math.min(SW * 0.15 - w, (SW - w) / 2), Math.max(SW * 0.85, (SW - w) / 2));
  V.y = clamp(V.y, Math.min(SH * 0.2 - hh, (SH - hh) / 2), Math.max(SH * 0.8, (SH - hh) / 2));
}

let needBase = false, needLive = false, rafId = 0;
function schedule() { if (!rafId) rafId = requestAnimationFrame(frame); }
function requestRender(base = true) { if (base) needBase = true; needLive = true; schedule(); }
function frame() {
  rafId = 0;
  if (!S.page || $('#editor').hidden) return;
  if (needBase) { needBase = false; renderBase(); }
  if (needLive || S.lasers.length) { needLive = false; renderLive(); }
  if (S.lasers.length) schedule();
}
function viewRect() { return { x0: -V.x / V.s, y0: -V.y / V.s, x1: (SW - V.x) / V.s, y1: (SH - V.y) / V.s }; }
function renderBase() {
  cB.setTransform(1, 0, 0, 1, 0, 0);
  cB.clearRect(0, 0, cvB.width, cvB.height);
  cB.setTransform(dpr * V.s, 0, 0, dpr * V.s, dpr * V.x, dpr * V.y);
  drawPage(cB, S.page, { shadow: true, shadowBlur: 18 * dpr, exclude: S.hideIds, view: viewRect() });
}
function drawIncremental(o) {
  const pg = S.page;
  cB.save();
  cB.setTransform(dpr * V.s, 0, 0, dpr * V.s, dpr * V.x, dpr * V.y);
  cB.beginPath(); cB.rect(0, 0, pg.w, pg.h); cB.clip();
  drawObject(cB, o, { dark: isDark(pg.paper.color) });
  cB.restore();
}
function renderLive() {
  const ctx = cL, pg = S.page;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cvL.width, cvL.height);
  ctx.setTransform(dpr * V.s, 0, 0, dpr * V.s, dpr * V.x, dpr * V.y);
  const env = { dark: isDark(pg.paper.color), live: true };
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, pg.w, pg.h); ctx.clip();
  if (A && A.type === 'draw') drawStroke(ctx, A.stroke, env, true);
  if (A && A.type === 'sel' && A.preview) for (const o of A.preview) drawObject(ctx, o, env);
  ctx.restore();
  if (A && A.type === 'lasso' && A.poly.length > 3) {
    const p = A.poly;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(61,91,240,0.07)'; ctx.fill();
    ctx.setLineDash([6 / V.s, 5 / V.s]); ctx.lineWidth = 1.6 / V.s; ctx.strokeStyle = ACC; ctx.stroke(); ctx.setLineDash([]);
  }
  drawLasers(ctx);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (A && A.type === 'sel' && A.preview) drawSelBox(ctx, unionBox(A.preview), false);
  else if (S.sel) drawSelBox(ctx, S.sel.box, true);
  if (S.eraserPos) {
    const r = tools.eraser.size / 2;
    ctx.beginPath(); ctx.arc(S.eraserPos.sx, S.eraserPos.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,130,150,0.12)'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(80,90,110,0.7)'; ctx.stroke();
  }
  if (S.hover && !A) {
    const t = S.tool;
    if (t === 'pen' || t === 'pencil' || t === 'hl') {
      const r = Math.max(2, (tools[t].size * V.s) / 2);
      ctx.beginPath(); ctx.arc(S.hover.sx, S.hover.sy, r, 0, Math.PI * 2);
      ctx.globalAlpha = 0.5; ctx.fillStyle = tools[t].color; ctx.fill(); ctx.globalAlpha = 1;
    } else if (t === 'eraser') {
      ctx.beginPath(); ctx.arc(S.hover.sx, S.hover.sy, tools.eraser.size / 2, 0, Math.PI * 2);
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(80,90,110,0.6)'; ctx.stroke();
    }
  }
  positionEditor();
  positionSelMenu();
}
function selScreenBox(b) { return { x: b.x * V.s + V.x - 6, y: b.y * V.s + V.y - 6, w: b.w * V.s + 12, h: b.h * V.s + 12 }; }
function drawSelBox(ctx, b, handles) {
  const r = selScreenBox(b);
  ctx.strokeStyle = ACC; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
  ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
  if (!handles) return;
  const hx = r.x + r.w / 2, hy = r.y - 28;
  ctx.beginPath(); ctx.moveTo(hx, r.y); ctx.lineTo(hx, hy); ctx.stroke();
  for (const [x, y] of [[hx, hy], [r.x + r.w, r.y + r.h]]) {
    ctx.beginPath(); ctx.arc(x, y, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = ACC; ctx.stroke();
  }
}
function selHandleAt(sx, sy) {
  if (!S.sel) return null;
  const r = selScreenBox(S.sel.box);
  if (Math.hypot(sx - (r.x + r.w), sy - (r.y + r.h)) < 24) return 'scale';
  if (Math.hypot(sx - (r.x + r.w / 2), sy - (r.y - 28)) < 24) return 'rot';
  if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return 'move';
  return null;
}
function drawLasers(ctx) {
  const now = performance.now();
  S.lasers = S.lasers.filter(t => (A && A.trail === t) || now - t.pts[t.pts.length - 1][2] < 1000);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const t of S.lasers) {
    const p = t.pts;
    while (p.length > 2 && now - p[0][2] > 1000) p.shift();
    for (let i = 1; i < p.length; i++) {
      const a = clamp(1 - (now - p[i][2]) / 900, 0, 1);
      if (a <= 0) continue;
      ctx.strokeStyle = `rgba(255,45,70,${a})`;
      ctx.lineWidth = 5 / V.s;
      ctx.shadowColor = 'rgba(255,45,70,0.9)'; ctx.shadowBlur = 10 * dpr * a;
      ctx.beginPath(); ctx.moveTo(p[i - 1][0], p[i - 1][1]); ctx.lineTo(p[i][0], p[i][1]); ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

/* ===================== Ferramentas ===================== */
let toolSaveT = 0;
function saveToolsSoon() { clearTimeout(toolSaveT); toolSaveT = setTimeout(() => kvSet('tools', { tools, tool: S.tool }), 500); }
function setTool(t) {
  if (S.editing) commitText();
  if (t !== 'lasso') clearSel();
  S.tool = t;
  $$('.tool').forEach(b => { const on = b.dataset.tool === t; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  renderToolTips(); renderToolOpts();
  S.hover = null; S.eraserPos = null;
  requestRender(false); saveToolsSoon();
}
function renderToolTips() {
  for (const t of ['pen', 'pencil', 'hl']) { const b = $(`.tool[data-tool="${t}"] .tip`); if (b) b.style.setProperty('--c', tools[t].color); }
}
function swatchRow(colors, cur, onPick) {
  const row = h('div', { class: 'swatches' });
  const all = [...colors, ...recent.filter(c => !colors.includes(c))].slice(0, 12);
  for (const c of all) row.append(h('button', { type: 'button', class: 'swatch' + (cur && c.toLowerCase() === cur.toLowerCase() ? ' on' : ''), style: { '--c': c }, 'aria-label': 'Cor ' + c, onclick: () => onPick(c) }));
  const inp = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur || '') ? cur : '#000000', 'aria-label': 'Escolher outra cor' });
  inp.addEventListener('change', () => { const c = inp.value.toUpperCase(); recent = [c, ...recent.filter(x => x !== c)].slice(0, 4); kvSet('recentColors', recent); onPick(c); });
  row.append(h('label', { class: 'swatch custom', title: 'Outra cor' }, inp));
  return row;
}
function sizeCtl(t) {
  const [mn, mx, st] = RANGES[t], o = tools[t];
  const dot = h('i'), num = h('span', { class: 'size-num' });
  const upd = () => {
    const d = clamp(t === 'eraser' ? o.size * 0.32 : t === 'hl' ? o.size * 0.55 : o.size * 1.3, 2, 28);
    dot.style.width = dot.style.height = d + 'px';
    num.textContent = String(Math.round(o.size * 10) / 10).replace('.', ',');
  };
  const r = h('input', { type: 'range', min: mn, max: mx, step: st, value: o.size, 'aria-label': 'Espessura', id: 'size-' + t });
  r.addEventListener('input', () => { o.size = +r.value; upd(); saveToolsSoon(); });
  const wrap = h('div', { class: 'size-ctl' }, h('span', { class: 'size-dot', style: { '--c': t === 'eraser' ? 'var(--muted)' : o.color } }, dot), r, num);
  upd();
  return wrap;
}
function renderToolOpts() {
  const box = $('#toolOpts'), t = S.tool;
  box.replaceChildren();
  if (t === 'pen' || t === 'pencil' || t === 'hl') {
    box.append(swatchRow(t === 'hl' ? HL_COLORS : PEN_COLORS, tools[t].color, c => { tools[t].color = c; renderToolOpts(); renderToolTips(); saveToolsSoon(); }), sizeCtl(t));
  } else if (t === 'eraser') {
    const cb = h('input', { type: 'checkbox', id: 'hlOnly' }); cb.checked = tools.eraser.hlOnly;
    cb.addEventListener('change', () => { tools.eraser.hlOnly = cb.checked; saveToolsSoon(); });
    box.append(seg([['partial', 'Parcial'], ['stroke', 'Traço inteiro']], tools.eraser.mode, v => { tools.eraser.mode = v; renderToolOpts(); saveToolsSoon(); }, 'Modo da borracha'),
      sizeCtl('eraser'), h('label', { class: 'check' }, cb, 'Só marca-texto'));
  } else if (t === 'lasso') {
    if (S.sel) box.append(h('span', { class: 'hint' }, 'Cor da seleção'), swatchRow(PEN_COLORS, null, c => recolorSel(c)));
    else box.append(h('span', { class: 'hint' }, 'Contorne o que quer mover, girar, redimensionar ou virar figurinha.'));
  } else if (t === 'text') {
    const o = tools.text;
    const fb = h('button', { type: 'button', class: 'font-btn', style: { fontFamily: fontCSS(o.font) }, 'aria-label': 'Fonte: ' + fontName(o.font) }, fontName(o.font));
    fb.addEventListener('click', () => fontPicker(fb));
    box.append(fb,
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Tamanho do texto' },
        h('button', { type: 'button', 'aria-label': 'Diminuir texto', onclick: () => setTextProp('size', clamp(Math.round(o.size) - 2, 8, 200)) }, '−'),
        h('button', { type: 'button', class: 'on', style: { minWidth: '44px' }, 'aria-label': 'Tamanho atual' }, String(Math.round(o.size))),
        h('button', { type: 'button', 'aria-label': 'Aumentar texto', onclick: () => setTextProp('size', clamp(Math.round(o.size) + 2, 8, 200)) }, '+')),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Estilo' },
        h('button', { type: 'button', class: o.bold ? 'on' : '', 'aria-pressed': String(o.bold), 'aria-label': 'Negrito', style: { fontWeight: '800' }, onclick: () => setTextProp('bold', !o.bold) }, 'N'),
        h('button', { type: 'button', class: o.italic ? 'on' : '', 'aria-pressed': String(o.italic), 'aria-label': 'Itálico', style: { fontStyle: 'italic', fontFamily: 'Georgia, serif' }, onclick: () => setTextProp('italic', !o.italic) }, 'I')),
      seg([['left', 'Alinhar à esquerda', 'al-left'], ['center', 'Centralizar', 'al-center'], ['right', 'Alinhar à direita', 'al-right']], o.align, v => setTextProp('align', v), 'Alinhamento'),
      swatchRow(PEN_COLORS, o.color, c => setTextProp('color', c)));
  } else if (t === 'laser') {
    box.append(h('span', { class: 'hint' }, 'Aponte durante uma apresentação: o traço some sozinho.'));
  }
}
function fontPicker(anchor) {
  const cur = tools.text.font;
  const items = [
    ...FONTS.map(f => h('button', { type: 'button', class: 'menu-item font-item' + (f.id === cur ? ' on' : ''), style: { fontFamily: f.css }, onclick: () => { closePopover(); setTextProp('font', f.id); } }, f.name)),
  ];
  if (CustomFonts.list.length) {
    items.push(h('div', { class: 'menu-sep' }));
    for (const f of CustomFonts.list) items.push(h('button', { type: 'button', class: 'menu-item font-item' + (f.id === cur ? ' on' : ''), style: { fontFamily: fontCSS(f.id) }, onclick: () => { closePopover(); setTextProp('font', f.id); } }, f.name));
  }
  items.push(h('div', { class: 'menu-sep' }),
    h('button', { type: 'button', class: 'menu-item', onclick: () => { closePopover(); importFont(); } }, icon('import'), h('span', {}, 'Importar fonte…', h('small', {}, 'Arquivos .ttf, .otf ou .woff'))));
  popover(anchor, items);
}
async function importFont() {
  const files = await pickFiles('.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/x-font-ttf,application/font-sfnt');
  if (!files.length) return;
  try {
    const f = await CustomFonts.add(files[0]);
    resetTextCaches();
    setTextProp('font', f.id);
    toast(`Fonte “${f.name}” adicionada.`);
  } catch (e) { toast('Não consegui ler essa fonte.'); }
}
function setTextProp(k, v) {
  tools.text[k] = v; saveToolsSoon();
  if (S.editing) {
    S.editing.obj = Object.assign({}, S.editing.obj, { [k]: v });
    styleEditor(); ta.focus();
  } else if (S.sel) {
    const texts = selObjs().filter(o => o.t === 'txt');
    if (texts.length) { pushHistory(); replaceObjs(texts.map(o => Object.assign({}, o, { [k]: v }))); computeSelBox(); markDirty(); requestRender(); }
  }
  renderToolOpts();
}

/* ===================== Histórico ===================== */
function pushHistory() {
  S.undo.push({ pid: S.page.id, objects: S.page.objects });
  if (S.undo.length > 150) S.undo.shift();
  S.redo = [];
  updateUndoUI();
}
function stepHistory(from, to) {
  if (S.editing) commitText();
  const e = from.pop();
  if (!e) return;
  const i = S.pages.findIndex(p => p.id === e.pid);
  if (i < 0) { updateUndoUI(); return; }
  to.push({ pid: e.pid, objects: S.pages[i].objects });
  S.pages[i].objects = e.objects;
  if (i !== S.pi) goPage(i);
  clearSel(); markDirty(); requestRender();
}
const undo = () => stepHistory(S.undo, S.redo);
const redo = () => stepHistory(S.redo, S.undo);
function updateUndoUI() { $('#btnUndo').disabled = !S.undo.length; $('#btnRedo').disabled = !S.redo.length; }
function replaceObjs(list) {
  const m = new Map(list.map(o => [o.id, o]));
  S.page.objects = S.page.objects.map(o => m.get(o.id) || o);
}

/* ===================== Entrada: caneta, dedo, mouse ===================== */
const touches = new Map();
let gesture = null;

cvL.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
cvL.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
cvL.addEventListener('pointerdown', onDown);
cvL.addEventListener('pointermove', onMove);
cvL.addEventListener('pointerup', onUp);
cvL.addEventListener('pointercancel', onCancel);
cvL.addEventListener('pointerleave', e => { if (!A && (e.pointerType === 'pen' || e.pointerType === 'mouse')) { S.hover = null; requestRender(false); } });
cvL.addEventListener('contextmenu', e => e.preventDefault());
stage.addEventListener('wheel', e => {
  if (!S.page) return;
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    const { sx, sy } = evPos(e), p = toPage(sx, sy);
    V.s = clamp(V.s * Math.exp(-e.deltaY * 0.01), MIN_S, MAX_S);
    V.x = sx - p.x * V.s; V.y = sy - p.y * V.s;
    showZoom();
  } else { V.x -= e.deltaX; V.y -= e.deltaY; }
  clampView(); requestRender();
}, { passive: false });

function onDown(e) {
  e.preventDefault();
  closePopover();
  const { sx, sy } = evPos(e);
  if (S.editing) { commitText(); if (e.pointerType !== 'touch' || !settings.pencilOnly) return; }
  if (e.pointerType === 'pen' && settings.autoPencil && !settings.pencilOnly) {
    settings.pencilOnly = true; kvSet('settings', settings);
    toast('Apple Pencil detectada: o dedo agora move a página e só a caneta escreve. Dá para mudar nos Ajustes.', 4500);
  }
  if (e.pointerType === 'touch') {
    if (e.width > 55 && e.height > 55) return; // provável palma da mão
    if (A && A.pointerType === 'pen') return;  // escrevendo com a Pencil: ignora a mão
    touches.set(e.pointerId, { sx, sy });
    try { cvL.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    if (touches.size === 1 && !gesture) {
      const onSel = S.tool === 'lasso' && selHandleAt(sx, sy);
      if (!settings.pencilOnly || onSel) { startAction(e, sx, sy); return; }
    }
    if (A && A.pointerType === 'touch') cancelAction();
    rebaseGesture();
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (gesture) { touches.clear(); gesture = null; }
  try { cvL.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
  startAction(e, sx, sy);
}
function onMove(e) {
  const { sx, sy } = evPos(e);
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { sx, sy });
    if (gesture) { moveGesture(); return; }
  }
  if (!A || A.pointerId !== e.pointerId) {
    if (!A && (e.pointerType === 'pen' || e.pointerType === 'mouse') && e.buttons === 0) { S.hover = { sx, sy }; requestRender(false); }
    return;
  }
  let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  if (!evs || !evs.length) evs = [e];
  switch (A.type) {
    case 'draw':
      if (A.snapped) updateSnap(toPage(sx, sy));
      else { for (const ce of evs) { const q = evPos(ce); addPoint(ce, toPage(q.sx, q.sy)); } checkHold(sx, sy); }
      requestRender(false);
      break;
    case 'erase':
      for (const ce of evs) { const q = evPos(ce); eraseAt(toPage(q.sx, q.sy)); }
      S.eraserPos = { sx, sy }; requestRender(false);
      break;
    case 'lasso': {
      const p = toPage(sx, sy), n = A.poly.length;
      if (Math.hypot(p.x - A.poly[n - 2], p.y - A.poly[n - 1]) > 2 / V.s) A.poly.push(p.x, p.y);
      requestRender(false);
      break;
    }
    case 'sel': updateSelDrag(toPage(sx, sy)); break;
    case 'laser': { const p = toPage(sx, sy); A.trail.pts.push([p.x, p.y, performance.now()]); schedule(); break; }
    case 'textTap': if (Math.hypot(sx - A.sx, sy - A.sy) > 10) A.moved = true; break;
  }
}
function onUp(e) {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.delete(e.pointerId);
    if (gesture) { if (touches.size === 0) endGesture(); else rebaseGesture(); return; }
  }
  if (!A || A.pointerId !== e.pointerId) return;
  finishAction(e);
}
function onCancel(e) {
  if (touches.has(e.pointerId)) { touches.delete(e.pointerId); if (gesture && touches.size === 0) { gesture = null; } }
  if (A && A.pointerId === e.pointerId) { if (A.type === 'draw') finishAction(null); else cancelAction(); }
}

/* gestos com os dedos */
function centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p.sx; y += p.sy; } return { x: x / pts.length, y: y / pts.length }; }
function spread(pts) { if (pts.length < 2) return 0; const c = centroid(pts); let d = 0; for (const p of pts) d += Math.hypot(p.sx - c.x, p.sy - c.y); return d / pts.length; }
function rebaseGesture() {
  const pts = [...touches.values()];
  if (!pts.length) return;
  if (!gesture) gesture = { start: performance.now(), maxCount: 0, moved: 0, first: centroid(pts) };
  gesture.maxCount = Math.max(gesture.maxCount, pts.length);
  gesture.v0 = { s: V.s, x: V.x, y: V.y };
  gesture.c0 = centroid(pts); gesture.d0 = spread(pts); gesture.n = pts.length;
}
function moveGesture() {
  const pts = [...touches.values()];
  if (pts.length !== gesture.n) { rebaseGesture(); return; }
  const c = centroid(pts);
  let s = gesture.v0.s;
  if (pts.length >= 2 && gesture.d0 > 8) s = clamp(gesture.v0.s * spread(pts) / gesture.d0, MIN_S, MAX_S);
  const px = (gesture.c0.x - gesture.v0.x) / gesture.v0.s, py = (gesture.c0.y - gesture.v0.y) / gesture.v0.s;
  V.s = s; V.x = c.x - px * s; V.y = c.y - py * s;
  gesture.moved = Math.max(gesture.moved, Math.hypot(c.x - gesture.c0.x, c.y - gesture.c0.y), pts.length >= 2 ? Math.abs(spread(pts) - gesture.d0) : 0);
  clampView();
  if (pts.length >= 2) showZoom();
  requestRender();
}
function endGesture() {
  const g = gesture; gesture = null;
  const dur = performance.now() - g.start;
  if (dur < 320 && g.moved < 14) {
    if (g.maxCount === 2 && settings.twoFingerUndo) { undo(); toast('Desfeito', 900); }
    else if (g.maxCount === 3 && settings.twoFingerUndo) { redo(); toast('Refeito', 900); }
    else if (g.maxCount === 1) fingerTap(g.first);
  }
}
function fingerTap(c) {
  const p = toPage(c.x, c.y);
  if (S.tool === 'text') textTapAt(p);
  else if (S.tool === 'lasso') { const o = hitTop(p, 8 / V.s); if (o) setSel([o.id]); else clearSel(); }
}
let zoomT = 0;
function showZoom() {
  const b = $('#zoomBadge');
  b.textContent = Math.round((V.s / S.fitS) * 100) + '%';
  b.hidden = false; clearTimeout(zoomT); zoomT = setTimeout(() => (b.hidden = true), 700);
}

/* início / fim das ações */
function startAction(e, sx, sy) {
  const p = toPage(sx, sy), base = { pointerId: e.pointerId, pointerType: e.pointerType, sx, sy };
  S.hover = null;
  switch (S.tool) {
    case 'pen': case 'pencil': case 'hl': clearSel(); beginStroke(e, p, sx, sy); break;
    case 'eraser': A = Object.assign(base, { type: 'erase', pushed: false, last: null }); S.eraserPos = { sx, sy }; eraseAt(p); break;
    case 'lasso': {
      const hnd = selHandleAt(sx, sy);
      if (hnd) beginSelDrag(hnd, base, p);
      else { clearSel(); A = Object.assign(base, { type: 'lasso', poly: [p.x, p.y], t0: performance.now() }); }
      break;
    }
    case 'text': A = Object.assign(base, { type: 'textTap', p, moved: false }); break;
    case 'laser': { const trail = { pts: [[p.x, p.y, performance.now()]] }; S.lasers.push(trail); A = Object.assign(base, { type: 'laser', trail }); break; }
  }
  requestRender(false);
}
function finishAction(e) {
  const a = A;
  switch (a.type) {
    case 'draw': {
      clearTimeout(a.holdTimer);
      if (!a.snapped && e && e.clientX != null) { const q = evPos(e), p = toPage(q.sx, q.sy); const pts = a.stroke.pts; if (pts.length && Math.hypot(p.x - pts[pts.length - 3], p.y - pts[pts.length - 2]) > 0.3) pts.push(p.x, p.y, pts[pts.length - 1]); }
      A = null; cvL.style.mixBlendMode = '';
      commitStroke(a.stroke);
      break;
    }
    case 'erase': A = null; S.eraserPos = null; if (a.pushed) markDirty(); break;
    case 'lasso': A = null; finishLasso(a); break;
    case 'sel': A = null; commitSelDrag(a); break;
    case 'textTap': A = null; if (!a.moved) textTapAt(a.p); break;
    default: A = null;
  }
  requestRender(false);
}
function cancelAction() {
  if (!A) return;
  const a = A; A = null;
  clearTimeout(a.holdTimer);
  cvL.style.mixBlendMode = '';
  if (a.type === 'sel') { S.hideIds = null; buildSelMenu(); requestRender(true); }
  if (a.type === 'erase' && a.pushed) markDirty();
  S.eraserPos = null;
  requestRender(false);
}

/* ===================== Traços ===================== */
function beginStroke(e, p, sx, sy) {
  const o = tools[S.tool];
  A = { type: 'draw', pointerId: e.pointerId, pointerType: e.pointerType, stroke: { t: 's', id: uid('s'), tool: S.tool, color: o.color, size: o.size, pts: [] }, lastT: e.timeStamp, pr: null, snapped: null, holdX: sx, holdY: sy, holdTimer: 0 };
  addPoint(e, p);
  armHold(sx, sy);
  if (S.tool === 'hl' && !isDark(S.page.paper.color)) cvL.style.mixBlendMode = 'multiply';
}
function addPoint(e, p) {
  const pts = A.stroke.pts;
  let pr;
  const n = pts.length;
  if (e.pointerType === 'pen') pr = e.pressure > 0 ? e.pressure : 0.5;
  else {
    const dt = Math.max(1, e.timeStamp - A.lastT);
    const v = n ? (Math.hypot(p.x - pts[n - 3], p.y - pts[n - 2]) * V.s) / dt : 0;
    pr = clamp(0.62 - v * 0.12, 0.28, 0.62);
  }
  if (A.pr != null) pr = A.pr * 0.6 + pr * 0.4;
  A.pr = pr; A.lastT = e.timeStamp;
  if (n) {
    const lx = pts[n - 3], ly = pts[n - 2];
    if (Math.hypot(p.x - lx, p.y - ly) < 0.6 / V.s) return;
    const k = e.pointerType === 'pen' ? 0.82 : 0.6;
    p = { x: lx + (p.x - lx) * k, y: ly + (p.y - ly) * k };
  }
  pts.push(p.x, p.y, pr);
}
function armHold(sx, sy) {
  clearTimeout(A.holdTimer);
  A.holdX = sx; A.holdY = sy;
  if (!settings.holdShapes) return;
  const a = A;
  A.holdTimer = setTimeout(() => { if (A === a && !a.snapped) trySnap(); }, 600);
}
function checkHold(sx, sy) { if (Math.hypot(sx - A.holdX, sy - A.holdY) > 6) armHold(sx, sy); }
function trySnap() {
  const st = A.stroke, shape = recognizeShape(st.pts);
  if (!shape) return;
  let sum = 0; const n = st.pts.length / 3;
  for (let i = 0; i < n; i++) sum += st.pts[i * 3 + 2];
  A.snapPr = sum / n;
  A.snapped = shape;
  st.pts = shapePoints(shape, A.snapPr);
  requestRender(false);
}
function updateSnap(p) {
  if (A.snapped.kind !== 'line') return;
  A.snapped = Object.assign({}, A.snapped, { bx: p.x, by: p.y });
  A.stroke.pts = shapePoints(A.snapped, A.snapPr);
}
function commitStroke(st) {
  if (!st.pts.length) return;
  const pts = st.pts.map((v, i) => (i % 3 === 2 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10));
  // garante pontos próximos (borracha parcial precisa)
  const out = [];
  for (let i = 0; i < pts.length; i += 3) {
    if (i) {
      const px = out[out.length - 3], py = out[out.length - 2], d = Math.hypot(pts[i] - px, pts[i + 1] - py);
      if (d > 4) { const k = Math.ceil(d / 3); for (let j = 1; j < k; j++) out.push(Math.round((px + ((pts[i] - px) * j) / k) * 10) / 10, Math.round((py + ((pts[i + 1] - py) * j) / k) * 10) / 10, pts[i + 2]); }
    }
    out.push(pts[i], pts[i + 1], pts[i + 2]);
  }
  const o = Object.assign({}, st, { pts: out });
  pushHistory();
  S.page.objects = [...S.page.objects, o];
  drawIncremental(o);
  markDirty();
}

/* ===================== Borracha ===================== */
function eraseAt(p) {
  const r = tools.eraser.size / 2 / V.s, mode = tools.eraser.mode, hlOnly = tools.eraser.hlOnly;
  const samples = [];
  if (A.last) {
    const d = Math.hypot(p.x - A.last.x, p.y - A.last.y), k = Math.max(1, Math.ceil(d / (r * 0.5)));
    for (let j = 1; j <= k; j++) samples.push(A.last.x + ((p.x - A.last.x) * j) / k, A.last.y + ((p.y - A.last.y) * j) / k);
  } else samples.push(p.x, p.y);
  A.last = p;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < samples.length; i += 2) { x0 = Math.min(x0, samples[i]); x1 = Math.max(x1, samples[i]); y0 = Math.min(y0, samples[i + 1]); y1 = Math.max(y1, samples[i + 1]); }
  let changed = false;
  const out = [];
  for (const o of S.page.objects) {
    if (o.t !== 's' || (hlOnly && o.tool !== 'hl')) { out.push(o); continue; }
    const b = objBox(o);
    if (b.x > x1 + r || b.x + b.w < x0 - r || b.y > y1 + r || b.y + b.h < y0 - r) { out.push(o); continue; }
    const rr = r + o.size * 0.35, n = o.pts.length / 3, keep = new Array(n);
    let hit = false;
    for (let i = 0; i < n; i++) {
      const x = o.pts[i * 3], y = o.pts[i * 3 + 1];
      let k = true;
      for (let s = 0; s < samples.length; s += 2) if (Math.abs(x - samples[s]) < rr && Math.abs(y - samples[s + 1]) < rr && Math.hypot(x - samples[s], y - samples[s + 1]) < rr) { k = false; break; }
      keep[i] = k; if (!k) hit = true;
    }
    if (!hit) { out.push(o); continue; }
    changed = true;
    if (mode === 'stroke') continue;
    let run = [];
    for (let i = 0; i <= n; i++) {
      if (i < n && keep[i]) run.push(o.pts[i * 3], o.pts[i * 3 + 1], o.pts[i * 3 + 2]);
      else { if (run.length >= 6) out.push(Object.assign({}, o, { id: uid('s'), pts: run })); run = []; }
    }
  }
  if (changed) {
    if (!A.pushed) { pushHistory(); A.pushed = true; }
    S.page.objects = out;
    needBase = true; schedule();
  }
}

/* ===================== Seleção (laço) ===================== */
function selObjs() { return S.sel ? S.page.objects.filter(o => S.sel.ids.has(o.id)) : []; }
function hitTop(p, tol) {
  const objs = S.page.objects;
  for (let i = objs.length - 1; i >= 0; i--) if (hitObj(objs[i], p.x, p.y, tol)) return objs[i];
  return null;
}
function setSel(ids) {
  S.sel = { ids: new Set(ids) };
  computeSelBox();
  if (!S.sel) return;
  buildSelMenu(); renderToolOpts(); requestRender(false);
}
function computeSelBox() {
  const objs = selObjs();
  if (!objs.length) { S.sel = null; return; }
  S.sel.box = unionBox(objs);
}
function clearSel() {
  if (!S.sel) return;
  S.sel = null; $('#selMenu').hidden = true;
  if (S.tool === 'lasso') renderToolOpts();
  requestRender(false);
}
function finishLasso(a) {
  const poly = a.poly;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < poly.length; i += 2) { x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i + 1]); y1 = Math.max(y1, poly[i + 1]); }
  if ((x1 - x0) * V.s < 12 && (y1 - y0) * V.s < 12) {
    const o = hitTop({ x: poly[0], y: poly[1] }, 8 / V.s);
    if (o) setSel([o.id]);
    return;
  }
  const ids = S.page.objects.filter(o => inLasso(o, poly)).map(o => o.id);
  if (ids.length) setSel(ids); else requestRender(false);
}
function beginSelDrag(kind, base, p) {
  const orig = selObjs();
  A = Object.assign(base, { type: 'sel', kind, p0: p, orig, box: Object.assign({}, S.sel.box), preview: orig, M: [1, 0, 0, 1, 0, 0], k: 1, ang: 0, moved: false });
  S.hideIds = new Set(S.sel.ids);
  $('#selMenu').hidden = true;
  requestRender(true);
}
function updateSelDrag(p) {
  const b = A.box;
  if (A.kind === 'move') {
    A.M = [1, 0, 0, 1, p.x - A.p0.x, p.y - A.p0.y]; A.k = 1; A.ang = 0;
  } else if (A.kind === 'scale') {
    const ax = b.x, ay = b.y;
    const k = clamp(Math.hypot(p.x - ax, p.y - ay) / Math.max(1, Math.hypot(A.p0.x - ax, A.p0.y - ay)), 0.05, 30);
    A.M = [k, 0, 0, k, ax - ax * k, ay - ay * k]; A.k = k; A.ang = 0;
  } else {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let a = Math.atan2(p.y - cy, p.x - cx) - Math.atan2(A.p0.y - cy, A.p0.x - cx);
    const step = Math.PI / 12, near = Math.round(a / step) * step;
    if (Math.abs(a - near) < 0.05) a = near;
    const c = Math.cos(a), s = Math.sin(a);
    A.M = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; A.k = 1; A.ang = a;
  }
  A.moved = true;
  A.preview = A.orig.map(o => transformObj(o, A.M, A.k, A.ang));
  requestRender(false);
}
function commitSelDrag(a) {
  S.hideIds = null;
  if (a.moved) {
    pushHistory();
    replaceObjs(a.preview);
    markDirty();
  }
  computeSelBox(); buildSelMenu();
  requestRender(true);
}
function buildSelMenu() {
  const m = $('#selMenu');
  if (!S.sel) { m.hidden = true; return; }
  const objs = selObjs();
  const items = [];
  if (objs.length === 1 && objs[0].t === 'txt') items.push(['text', 'Editar', () => { const o = objs[0]; setTool('text'); editText(o, false); }]);
  items.push(['copy', 'Copiar', copySel], ['dup', 'Duplicar', dupSel], ['sticker', 'Figurinha', selToSticker], ['front', 'Frente', () => orderSel(1)], ['backward', 'Trás', () => orderSel(-1)], ['trash', 'Apagar', deleteSel, true]);
  m.replaceChildren(...items.map(([ic, l, fn, d]) => h('button', { type: 'button', class: d ? 'danger' : '', onclick: fn }, icon(ic), l)));
  m.hidden = false;
  positionSelMenu();
}
function positionSelMenu() {
  const m = $('#selMenu');
  if (!S.sel || m.hidden) return;
  const r = selScreenBox(S.sel.box), mw = m.offsetWidth, mh = m.offsetHeight;
  const x = clamp(r.x + r.w / 2 - mw / 2, 8, Math.max(8, SW - mw - 8));
  let y = r.y - mh - 44;
  if (y < 8) y = r.y + r.h + 14;
  if (y + mh > SH - 8) y = clamp(r.y + 10, 8, Math.max(8, SH - mh - 8));
  m.style.left = x + 'px'; m.style.top = y + 'px';
}
function cloneObjs(objs, dx, dy) {
  return objs.map(o => transformObj(Object.assign({}, o, { id: uid(o.t === 's' ? 's' : 'o') }), [1, 0, 0, 1, dx, dy], 1, 0));
}
function insertObjects(objs) {
  pushHistory();
  S.page.objects = [...S.page.objects, ...objs];
  markDirty();
  if (S.tool !== 'lasso') setTool('lasso');
  setSel(objs.map(o => o.id));
  requestRender();
}
function copySel() { S.clip = JSON.parse(JSON.stringify(selObjs())); toast('Copiado. Para colar, use o botão + no topo.'); }
function paste() {
  if (!S.clip || !S.clip.length) return;
  const b = unionBox(S.clip), c = viewCenter();
  insertObjects(cloneObjs(S.clip, c.x - (b.x + b.w / 2), c.y - (b.y + b.h / 2)));
}
function dupSel() { insertObjects(cloneObjs(selObjs(), 24, 24)); }
function deleteSel() {
  if (!S.sel) return;
  pushHistory();
  S.page.objects = S.page.objects.filter(o => !S.sel.ids.has(o.id));
  clearSel(); markDirty(); requestRender();
}
function orderSel(dir) {
  const sel = selObjs(), rest = S.page.objects.filter(o => !S.sel.ids.has(o.id));
  pushHistory();
  S.page.objects = dir > 0 ? [...rest, ...sel] : [...sel, ...rest];
  markDirty(); requestRender();
}
function recolorSel(c) {
  const objs = selObjs().filter(o => o.t === 's' || o.t === 'txt');
  if (!objs.length) { toast('A cor muda só traços e textos.'); return; }
  pushHistory();
  replaceObjs(objs.map(o => Object.assign({}, o, { color: c })));
  markDirty(); requestRender();
}
async function selToSticker() {
  const objs = selObjs();
  if (!objs.length) return;
  await Assets.ensure(objs.filter(o => o.asset).map(o => o.asset));
  const b = unionBox(objs), k = Math.min(2, 900 / Math.max(b.w, b.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(b.w * k)); c.height = Math.max(1, Math.ceil(b.h * k));
  const ctx = c.getContext('2d');
  ctx.setTransform(k, 0, 0, k, -b.x * k, -b.y * k);
  for (const o of objs) drawObject(ctx, o, { dark: false, live: true });
  try {
    const id = await Assets.add(c.toDataURL('image/png'), 'sticker');
    const list = await kvGet('userStickers', []);
    list.unshift(id); await kvSet('userStickers', list);
    toast('Figurinha salva em “Minhas figurinhas”.');
  } catch (e) { toast('Não consegui criar a figurinha.'); }
}

/* ===================== Texto ===================== */
function textTapAt(p) {
  const objs = S.page.objects;
  for (let i = objs.length - 1; i >= 0; i--) if (objs[i].t === 'txt' && hitObj(objs[i], p.x, p.y, 4)) { editText(objs[i], false); return; }
  const t = tools.text, pg = S.page;
  let x = p.x, w = Math.min(380, pg.w - x - 24);
  if (w < 160) { w = 220; x = Math.max(12, pg.w - w - 24); }
  editText({ t: 'txt', id: uid('t'), x, y: p.y - t.size * 0.65, w, text: '', font: t.font, size: t.size, color: t.color, bold: t.bold, italic: t.italic, align: t.align }, true);
}
function editText(o, isNew) {
  if (S.editing) commitText();
  clearSel();
  Object.assign(tools.text, { font: o.font, size: o.size, color: o.color, bold: !!o.bold, italic: !!o.italic, align: o.align || 'left' });
  if (S.tool === 'text') renderToolOpts();
  S.editing = { obj: o, isNew };
  S.hideIds = new Set([o.id]);
  ta.value = o.text || '';
  ta.hidden = false;
  styleEditor();
  requestRender(true);
  ta.focus();
  try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* ok */ }
}
function styleEditor() {
  if (!S.editing) return;
  const o = S.editing.obj;
  ta.style.font = textFont(o, V.s);
  ta.style.lineHeight = '1.3';
  ta.style.color = o.color;
  ta.style.textAlign = o.align || 'left';
  positionEditor();
}
let edScale = 0;
function positionEditor() {
  if (!S.editing) return;
  const o = S.editing.obj;
  if (edScale !== V.s) { edScale = V.s; ta.style.font = textFont(o, V.s); ta.style.lineHeight = '1.3'; }
  ta.style.left = o.x * V.s + V.x + 'px';
  ta.style.top = o.y * V.s + V.y + 'px';
  ta.style.width = o.w * V.s + 'px';
  ta.style.height = 'auto';
  ta.style.height = Math.max(o.size * 1.3 * V.s, ta.scrollHeight) + 'px';
}
ta.addEventListener('input', () => positionEditor());
ta.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); commitText(); } });
function commitText() {
  if (!S.editing) return;
  const ed = S.editing;
  S.editing = null; S.hideIds = null; edScale = 0;
  const val = ta.value.replace(/\s+$/, '');
  ta.hidden = true; ta.blur();
  const exists = S.page.objects.some(o => o.id === ed.obj.id);
  if (!val) {
    if (exists) { pushHistory(); S.page.objects = S.page.objects.filter(o => o.id !== ed.obj.id); markDirty(); }
  } else {
    const o = Object.assign({}, ed.obj, { text: val });
    if (!exists) { pushHistory(); S.page.objects = [...S.page.objects, o]; markDirty(); }
    else {
      const old = S.page.objects.find(x => x.id === o.id);
      if (JSON.stringify(old) !== JSON.stringify(o)) { pushHistory(); replaceObjs([o]); markDirty(); }
    }
  }
  requestRender(true);
}

/* ===================== Páginas ===================== */
function updatePageUI() {
  $('#pageLabel').textContent = `${S.pi + 1} / ${S.pages.length}`;
  $('#btnPrev').disabled = S.pi === 0;
  $('#btnNext').disabled = S.pi >= S.pages.length - 1;
}
function goPage(i) {
  if (i < 0 || i >= S.pages.length) return;
  commitText(); clearSel();
  const keepS = V.s, prevW = S.page ? S.page.w : 0;
  S.pi = i;
  if (S.page.w !== prevW) fitWidth();
  else { V.s = keepS; V.x = clamp(V.x, -1e6, 1e6); V.y = SW < 600 ? 8 : 28; }
  S.meta.lastPage = i; S.dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1500);
  updatePageUI();
  Assets.ensure(pageAssetIds(S.page)).then(() => requestRender());
  requestRender();
}
function addPage(after = S.pi, page) {
  const cur = S.page;
  const pg = page || newPage({ tpl: cur.paper.tpl, color: cur.paper.color, orient: cur.w > cur.h ? 'landscape' : 'portrait' });
  S.pages.splice(after + 1, 0, pg);
  markDirty();
  goPage(after + 1);
}
function dupPage(i) {
  const src = S.pages[i];
  const pg = JSON.parse(JSON.stringify(src));
  pg.id = uid('p_');
  pg.objects = pg.objects.map(o => Object.assign(o, { id: uid('o') }));
  S.pages.splice(i + 1, 0, pg);
  if (S.pi > i) S.pi++;
  markDirty(); updatePageUI();
}
function movePage(i, d) {
  const j = i + d;
  if (j < 0 || j >= S.pages.length) return;
  const cur = S.page;
  [S.pages[i], S.pages[j]] = [S.pages[j], S.pages[i]];
  S.pi = S.pages.indexOf(cur);
  markDirty(); updatePageUI();
}
function delPage(i) {
  S.pages.splice(i, 1);
  S.pi = clamp(S.pi > i ? S.pi - 1 : S.pi, 0, S.pages.length - 1);
  markDirty(); updatePageUI(); clearSel(); requestRender();
}
function pagesSheet() {
  commitText();
  const grid = h('div', { class: 'thumbs' });
  let sh = null;
  const render = () => {
    grid.replaceChildren();
    S.pages.forEach((pg, i) => {
      const W = 130, k = W / pg.w, d = Math.min(devicePixelRatio || 1, 2);
      const c = document.createElement('canvas');
      c.width = W * d; c.height = Math.round(pg.h * k * d);
      c.style.width = W + 'px'; c.style.height = Math.round(pg.h * k) + 'px';
      const draw = () => { const x = c.getContext('2d'); x.setTransform(d * k, 0, 0, d * k, 0, 0); drawPage(x, pg, {}); };
      draw(); Assets.ensure(pageAssetIds(pg)).then(draw);
      const more = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Opções da página ${i + 1}` }, icon('more'));
      more.addEventListener('click', () => menu(more, [
        { icon: 'dup', label: 'Duplicar página', action: () => { dupPage(i); render(); } },
        i > 0 && { icon: 'chev-l', label: 'Mover para antes', action: () => { movePage(i, -1); render(); } },
        i < S.pages.length - 1 && { icon: 'chev-r', label: 'Mover para depois', action: () => { movePage(i, 1); render(); } },
        '-',
        { icon: 'trash', label: 'Apagar página', danger: true, action: async () => {
          if (S.pages.length === 1) { toast('O caderno precisa de pelo menos uma página.'); return; }
          if (await confirmDlg('Apagar página?', `A página ${i + 1} e tudo o que está nela serão apagados.`, 'Apagar', true)) { delPage(i); render(); }
        } },
      ]));
      grid.append(h('div', { class: 'thumb' + (i === S.pi ? ' on' : '') },
        h('button', { type: 'button', class: 'pg', 'aria-label': 'Ir para a página ' + (i + 1), onclick: () => { goPage(i); sh.close(); } }, c),
        h('div', { class: 'thumb-bar' }, h('span', {}, String(i + 1)), more)));
    });
  };
  render();
  sh = sheet({
    title: 'Páginas', wide: true, body: grid,
    actions: close => [
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { close(); paperSheet(); } }, icon('paper'), 'Papel desta página'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { close(); addPage(); } }, icon('plus'), 'Nova página'),
    ],
  });
}
function paperSheet() {
  const pg = S.page;
  const st = { tpl: pg.paper.tpl, color: pg.paper.color, orient: pg.w > pg.h ? 'landscape' : 'portrait' };
  const apply = list => {
    for (const p of list) {
      p.paper = { tpl: st.tpl, color: st.color };
      const sz = PAGE_SIZES[st.orient];
      p.w = sz.w; p.h = sz.h;
    }
    S.meta.paper = Object.assign({}, st);
    markDirty(); fitWidth(); requestRender();
  };
  sheet({
    title: 'Papel', wide: true, body: paperPicker(st),
    actions: close => [
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { apply(S.pages); close(); toast('Papel aplicado a todas as páginas.'); } }, 'Aplicar a todas'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { apply([S.page]); close(); } }, 'Aplicar a esta página'),
    ],
  });
}

/* ===================== Inserir ===================== */
function viewCenter() {
  const pg = S.page, p = toPage(SW / 2, SH / 2);
  return { x: clamp(p.x, 80, pg.w - 80), y: clamp(p.y, 80, pg.h - 80) };
}
function insertMenu(anchor) {
  commitText();
  menu(anchor, [
    { icon: 'image', label: 'Imagem ou foto', sub: 'Da galeria, da câmera ou dos Arquivos', action: insertImages },
    { icon: 'sticker', label: 'Figurinha', action: stickerSheet },
    { icon: 'text', label: 'Caixa de texto', sub: 'Depois toque onde quer escrever', action: () => { setTool('text'); toast('Toque na página onde quer escrever.'); } },
    S.clip && S.clip.length && { icon: 'paste', label: 'Colar', action: paste },
    '-',
    { icon: 'plus', label: 'Nova página', action: () => addPage() },
    { icon: 'pdf', label: 'PDF para anotar', sub: 'As páginas entram depois desta', action: insertPdfPages },
    { icon: 'paper', label: 'Página com imagem de fundo', sub: 'Para anotar sobre uma foto, lista ou slide', action: insertBgPage },
  ]);
}
async function insertImages() {
  const files = await pickFiles('image/*', true);
  if (!files.length) return;
  const pg = S.page, c = viewCenter(), objs = [];
  let n = 0;
  for (const f of files) {
    try {
      const im = await readImageFile(f);
      const id = await Assets.add(im.data, 'image');
      await Assets.load(id);
      let w = Math.min(pg.w * 0.6, im.w), hh = (w * im.h) / im.w;
      if (hh > pg.h * 0.55) { hh = pg.h * 0.55; w = (hh * im.w) / im.h; }
      objs.push({ t: 'img', id: uid('o'), asset: id, x: c.x - w / 2 + n * 24, y: c.y - hh / 2 + n * 24, w, h: hh, rot: 0 });
      n++;
    } catch (e) { toast('Não consegui abrir uma das imagens.'); }
  }
  if (objs.length) insertObjects(objs);
}
async function insertBgPage() {
  const files = await pickFiles('image/*');
  if (!files.length) return;
  try {
    const im = await readImageFile(files[0], 2600);
    const id = await Assets.add(im.data, 'image');
    await Assets.load(id);
    const pg = newPage({ tpl: 'blank', color: '#FFFFFF', orient: im.w > im.h ? 'landscape' : 'portrait' });
    pg.bg = id;
    addPage(S.pi, pg);
  } catch (e) { toast('Não consegui abrir essa imagem.'); }
}
async function addSticker(spec) {
  const c = viewCenter();
  let o;
  if (spec.emoji) o = { t: 'stk', id: uid('o'), emoji: spec.emoji, x: c.x - 45, y: c.y - 45, w: 90, h: 90, rot: 0 };
  else {
    const el = await Assets.load(spec.asset);
    if (!el) { toast('Figurinha indisponível.'); return; }
    const iw = el.naturalWidth || el.width, ih = el.naturalHeight || el.height, max = spec.asset.startsWith('b:') ? 150 : 200;
    const k = max / Math.max(iw, ih);
    o = { t: 'stk', id: uid('o'), asset: spec.asset, x: c.x - (iw * k) / 2, y: c.y - (ih * k) / 2, w: iw * k, h: ih * k, rot: 0 };
  }
  insertObjects([o]);
}
async function stickerSheet() {
  let tab = 'planner', editMode = false;
  const tabs = h('div', { class: 'tabs' }), grid = h('div', { class: 'stk-grid' });
  let sh;
  const render = async () => {
    tabs.replaceChildren(seg([['planner', 'Planner'], ['emoji', 'Emojis'], ['mine', 'Minhas']], tab, v => { tab = v; editMode = false; render(); }, 'Tipo de figurinha'));
    grid.replaceChildren();
    if (tab === 'planner') {
      for (const [k, s] of Object.entries(BUILTIN_STICKERS)) {
        grid.append(h('button', { type: 'button', class: 'stk', 'aria-label': s.name, title: s.name, onclick: () => { sh.close(); addSticker({ asset: 'b:' + k }); } },
          h('img', { alt: '', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg) })));
      }
    } else if (tab === 'emoji') {
      for (const e of EMOJIS) grid.append(h('button', { type: 'button', class: 'stk emoji', 'aria-label': e, onclick: () => { sh.close(); addSticker({ emoji: e }); } }, e));
    } else {
      const list = await kvGet('userStickers', []);
      grid.append(h('button', { type: 'button', class: 'stk stk-add', onclick: async () => {
        const files = await pickFiles('image/*', true);
        for (const f of files) {
          try { const im = await readImageFile(f, 900); const id = await Assets.add(im.data, 'sticker'); list.unshift(id); } catch (e) { toast('Não consegui abrir uma das imagens.'); }
        }
        await kvSet('userStickers', list); render();
      } }, icon('plus'), 'Adicionar imagem'));
      for (const id of list) {
        const a = await DB.get('assets', id);
        if (!a) continue;
        const btn = h('button', { type: 'button', class: 'stk', 'aria-label': 'Figurinha', onclick: () => { if (editMode) return; sh.close(); addSticker({ asset: id }); } }, h('img', { alt: '', src: a.data }));
        if (editMode) btn.append(h('span', { class: 'del', role: 'button', 'aria-label': 'Remover figurinha', onclick: async ev => { ev.stopPropagation(); const l = (await kvGet('userStickers', [])).filter(x => x !== id); await kvSet('userStickers', l); render(); } }, icon('close')));
        grid.append(btn);
      }
      if (list.length) grid.append(h('button', { type: 'button', class: 'stk stk-add', onclick: () => { editMode = !editMode; render(); } }, editMode ? 'Concluir' : 'Remover figurinhas'));
      if (!list.length) grid.append(h('p', { style: { gridColumn: '1 / -1' } }, 'Adicione imagens (PNG com fundo transparente fica ótimo) ou selecione algo com o laço e toque em “Figurinha”.'));
    }
  };
  sh = sheet({ title: 'Figurinhas', wide: true, body: [tabs, grid] });
  render();
}

/* ===================== PDF para anotar ===================== */
let pdfjsP = null;
function loadPdfJs() {
  if (!pdfjsP) pdfjsP = new Promise((res, rej) => {
    if (window.pdfjsLib) { res(window.pdfjsLib); return; }
    const s = h('script', { src: 'vendor/pdf.min.js' });
    s.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) { pdfjsP = null; rej(new Error('pdfjs')); return; }
      lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      res(lib);
    };
    s.onerror = () => { pdfjsP = null; rej(new Error('pdfjs')); };
    document.head.append(s);
  });
  return pdfjsP;
}
function progressSheet(title) {
  const bar = h('i'), label = h('p', {}, 'Abrindo o arquivo…');
  const sh = sheet({ title, body: [label, h('div', { class: 'progress' }, bar)] });
  return {
    set(i, n) { bar.style.width = (i / n) * 100 + '%'; label.textContent = `Preparando página ${i} de ${n}…`; },
    close: sh.close,
  };
}
/* Cada página do PDF vira uma folha do caderno, com a página como fundo */
async function pdfToPages(file, onProg) {
  const lib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data, isEvalSupported: false, standardFontDataUrl: 'vendor/standard_fonts/' }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const vp1 = p.getViewport({ scale: 1 }); // em pontos (1/72")
      const w = vp1.width / 0.75, hh = vp1.height / 0.75; // em unidades da página (96 ppp)
      let k = 2.5 / 0.75;
      k = Math.min(k, 3000 / Math.max(vp1.width, vp1.height));
      if (vp1.width * vp1.height * k * k > 6e6) k = Math.sqrt(6e6 / (vp1.width * vp1.height));
      const vp = p.getViewport({ scale: k });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
      const url = c.toDataURL('image/jpeg', 0.86);
      c.width = c.height = 1;
      p.cleanup();
      const id = await Assets.add(url, 'pdfpage');
      pages.push({ id: uid('p_'), w: Math.round(w), h: Math.round(hh), paper: { tpl: 'blank', color: '#FFFFFF' }, bg: id, objects: [] });
      onProg(i, doc.numPages);
      await new Promise(r => setTimeout(r, 0));
    }
  } finally {
    try { doc.destroy(); } catch (e) { /* ok */ }
  }
  return pages;
}
function pdfError(e) {
  if (e && e.name === 'PasswordException') return 'Esse PDF tem senha. Tire a senha e tente de novo.';
  if (e && e.message === 'pdfjs') return 'Não consegui carregar o leitor de PDF. Verifique a conexão e tente de novo.';
  return 'Não consegui ler esse PDF. Ele pode estar corrompido.';
}
async function importPdfAsNotebook(file) {
  const pr = progressSheet('Importando PDF');
  try {
    const pages = await pdfToPages(file, (i, n) => pr.set(i, n));
    if (!pages.length) throw new Error('vazio');
    const meta = await createNotebook({
      title: file.name.replace(/\.pdf$/i, '').trim() || 'PDF importado',
      cover: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
      paper: { tpl: 'blank', color: '#FFFFFF', orient: pages[0].w > pages[0].h ? 'landscape' : 'portrait' },
      pages,
    });
    pr.close();
    return meta;
  } catch (e) { pr.close(); toast(pdfError(e), 4000); return null; }
}
async function insertPdfPages() {
  const files = await pickFiles('application/pdf,.pdf');
  if (!files.length) return;
  commitText();
  const pr = progressSheet('Importando PDF');
  try {
    const pages = await pdfToPages(files[0], (i, n) => pr.set(i, n));
    pr.close();
    if (!pages.length) return;
    S.pages.splice(S.pi + 1, 0, ...pages);
    markDirty();
    goPage(S.pi + 1);
    toast(pages.length === 1 ? '1 página do PDF adicionada.' : `${pages.length} páginas do PDF adicionadas depois desta.`);
  } catch (e) { pr.close(); toast(pdfError(e), 4000); }
}

/* ===================== Exportar / importar ===================== */
let dlPromise = null;
function getDownloads() {
  if (!dlPromise) {
    try {
      dlPromise = window.claude && typeof window.claude.use === 'function'
        ? Promise.resolve(window.claude.use('downloads')).catch(() => null)
        : Promise.resolve(null);
    } catch (e) { dlPromise = Promise.resolve(null); }
  }
  return dlPromise;
}
async function saveFile(blob, name) {
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); toast('Arquivo salvo.'); return true; }
    catch (e) {
      const code = e && e.code;
      if (code === 'declined') return false;
      if (!['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code)) { toast('Não foi possível salvar: ' + ((e && e.message) || code)); return false; }
    }
  }
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  if (window.claude) { toast('Este visualizador não permite baixar arquivos. Abra o Traço instalado na Tela de Início.'); return false; }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
async function renderPageCanvas(pg, scale) {
  await Assets.ensure(pageAssetIds(pg));
  try { await document.fonts.ready; } catch (e) { /* ok */ }
  const c = document.createElement('canvas');
  c.width = Math.round(pg.w * scale); c.height = Math.round(pg.h * scale);
  const ctx = c.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawPage(ctx, pg, {});
  return c;
}
async function pagesToPDF(pages, onProg) {
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i], c = await renderPageCanvas(pg, 2);
    const b = await canvasToBlob(c, 'image/jpeg', 0.9);
    out.push({ jpeg: new Uint8Array(await b.arrayBuffer()), pw: c.width, ph: c.height, wpt: pg.w * 0.75, hpt: pg.h * 0.75 });
    c.width = c.height = 1;
    onProg(i + 1, pages.length);
    await new Promise(r => setTimeout(r, 0));
  }
  return buildPDF(out);
}
async function notebookBundle(entries) {
  const assetIds = new Set(), fontIds = new Set();
  for (const e of entries) for (const pg of e.pages) {
    for (const id of pageAssetIds(pg)) if (!id.startsWith('b:')) assetIds.add(id);
    for (const o of pg.objects) if (o.t === 'txt' && o.font && o.font.startsWith('c_')) fontIds.add(o.font);
  }
  const fonts = CustomFonts.list.filter(f => fontIds.has(f.id));
  for (const f of fonts) assetIds.add(f.asset);
  const assets = {};
  for (const id of assetIds) { const a = await DB.get('assets', id); if (a) assets[id] = { data: a.data, kind: a.kind }; }
  const json = {
    format: 'traco', version: 1, exported: new Date().toISOString(),
    notebooks: entries.map(e => ({ meta: { title: e.meta.title, cover: e.meta.cover, paper: e.meta.paper, created: e.meta.created }, pages: e.pages })),
    fonts, assets,
  };
  return new Blob([JSON.stringify(json)], { type: 'application/json' });
}
function fmtSize(n) { return n > 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB'; }
function exportSheet(entries) {
  const single = entries.length === 1 ? entries[0] : null;
  const inEditor = single && S.meta && single.meta.id === S.meta.id;
  const base = single ? safeName(single.meta.title) : 'Traço - backup';
  const items = [];
  if (single) {
    items.push({ badge: 'PDF', color: '#D33A2C', title: 'PDF do caderno', sub: `${single.pages.length} ${single.pages.length === 1 ? 'página' : 'páginas'}, para imprimir ou mandar`, kind: 'pdf-all' });
    if (inEditor) items.push({ badge: 'PDF', color: '#E0703A', title: 'PDF só desta página', sub: `Página ${S.pi + 1}`, kind: 'pdf-page' });
    if (inEditor) items.push({ badge: 'PNG', color: '#1F8A4C', title: 'Imagem desta página', sub: 'PNG em alta resolução', kind: 'png' });
  }
  items.push({ badge: 'JSON', color: '#2443D6', title: single ? 'Arquivo do Traço' : 'Backup de todos os cadernos', sub: 'Abre de novo no Traço, aqui ou em outro aparelho, com tudo editável', kind: 'json' });
  const list = h('div', { class: 'export-list' });
  const sh = sheet({ title: single ? `Exportar “${single.meta.title}”` : 'Backup', body: list });
  for (const it of items) {
    list.append(h('button', { type: 'button', class: 'export-item', onclick: () => run(it) },
      h('span', { class: 'badge', style: { background: it.color } }, it.badge), h('span', {}, h('strong', {}, it.title), h('small', {}, it.sub))));
  }
  async function run(it) {
    const bar = h('i'), label = h('p', {}, 'Preparando…');
    sh.body.replaceChildren(label, h('div', { class: 'progress' }, bar));
    let blob, name;
    try {
      if (it.kind === 'pdf-all' || it.kind === 'pdf-page') {
        const pages = it.kind === 'pdf-all' ? single.pages : [S.page];
        blob = await pagesToPDF(pages, (i, n) => { bar.style.width = (i / n) * 100 + '%'; label.textContent = `Gerando página ${i} de ${n}…`; });
        name = base + (it.kind === 'pdf-page' ? ` - pág ${S.pi + 1}` : '') + '.pdf';
      } else if (it.kind === 'png') {
        const c = await renderPageCanvas(S.page, 2.5);
        blob = await canvasToBlob(c, 'image/png');
        name = `${base} - pág ${S.pi + 1}.png`;
      } else {
        bar.style.width = '50%';
        blob = await notebookBundle(entries);
        name = base + '.traco.json';
      }
    } catch (e) {
      label.textContent = 'Não consegui gerar o arquivo. Tente de novo com menos páginas.';
      return;
    }
    bar.style.width = '100%';
    label.textContent = `Pronto: ${name} (${fmtSize(blob.size)}).`;
    sh.body.append(h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      h('button', { type: 'button', class: 'btn primary', onclick: async () => { if (await saveFile(blob, name)) sh.close(); } }, icon('share'), 'Salvar ou compartilhar'),
      h('button', { type: 'button', class: 'btn ghost', onclick: sh.close }, 'Fechar')));
  }
}
async function backupAll() {
  const metas = await DB.all('meta');
  if (!metas.length) { toast('Ainda não há cadernos para salvar.'); return; }
  const entries = [];
  for (const m of metas) { const c = await DB.get('content', m.id); if (c) entries.push({ meta: m, pages: c.pages }); }
  exportSheet(entries);
}
async function importNotebooks() {
  const files = await pickFiles('application/json,.json,application/pdf,.pdf', true);
  let count = 0, lastPdf = null, pdfs = 0;
  for (const f of files) {
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      const meta = await importPdfAsNotebook(f);
      if (meta) { count++; pdfs++; lastPdf = meta; }
      continue;
    }
    try { count += await importBundle(JSON.parse(await f.text())); }
    catch (e) { toast(`“${f.name}” não é um PDF nem um arquivo do Traço.`); }
  }
  if (!count) return;
  if (count === 1 && lastPdf) { openNotebook(lastPdf.id); return; }
  toast(count === 1 ? '1 caderno importado.' : `${count} cadernos importados.`);
  renderLibrary();
}
async function importBundle(d) {
  if (!d || d.format !== 'traco' || !Array.isArray(d.notebooks)) throw new Error('formato');
  for (const [id, a] of Object.entries(d.assets || {})) { if (!(await DB.get('assets', id))) await DB.put('assets', { id, data: a.data, kind: a.kind }); }
  let fontsChanged = false;
  for (const f of d.fonts || []) if (!CustomFonts.list.find(x => x.id === f.id)) { CustomFonts.list.push(f); await CustomFonts.register(f); fontsChanged = true; }
  if (fontsChanged) { await kvSet('fonts', CustomFonts.list); resetTextCaches(); }
  let n = 0;
  for (const nb of d.notebooks) {
    const pages = (nb.pages || []).filter(p => p && Array.isArray(p.objects));
    if (!pages.length) continue;
    const m = nb.meta || {};
    await createNotebook({ title: m.title || 'Caderno importado', cover: m.cover || COVER_COLORS[0], paper: m.paper || { tpl: 'lined', color: '#FFFFFF', orient: 'portrait' }, pages });
    n++;
  }
  return n;
}
async function gcAssets() {
  try {
    if (DB.volatile) return;
    const used = new Set();
    for (const c of await DB.all('content')) for (const pg of c.pages) for (const id of pageAssetIds(pg)) used.add(id);
    for (const id of await kvGet('userStickers', [])) used.add(id);
    for (const f of CustomFonts.list) used.add(f.asset);
    if (S.clip) for (const o of S.clip) if (o.asset) used.add(o.asset);
    for (const id of await DB.keys('assets')) if (!used.has(id)) await DB.del('assets', id);
  } catch (e) { /* ok */ }
}

/* ===================== Ajustes e ajuda ===================== */
function moreMenu(anchor) {
  commitText();
  menu(anchor, [
    { icon: 'pages', label: 'Páginas', action: pagesSheet },
    { icon: 'paper', label: 'Papel da página', action: paperSheet },
    { icon: 'share', label: 'Exportar…', sub: 'PDF, imagem ou arquivo do Traço', action: () => exportSheet([{ meta: S.meta, pages: S.pages }]) },
    { icon: 'fit', label: 'Ver a página inteira', action: fitWhole },
    '-',
    { icon: 'sliders', label: 'Ajustes', action: settingsSheet },
    { icon: 'help', label: 'Gestos e atalhos', action: helpSheet },
  ]);
}
function settingsSheet() {
  const fontsBox = h('div', { class: 'field' });
  const drawFonts = () => {
    fontsBox.replaceChildren(h('span', {}, 'Fontes importadas'));
    if (!CustomFonts.list.length) fontsBox.append(h('p', {}, 'Nenhuma ainda. O iPhone e o iPad já trazem mais de 20 fontes prontas para usar.'));
    for (const f of CustomFonts.list) fontsBox.append(h('div', { class: 'opt-row', style: { alignItems: 'center' } },
      h('div', { style: { fontFamily: fontCSS(f.id), fontSize: '18px' } }, f.name),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remover ' + f.name, onclick: async () => { await CustomFonts.remove(f.id); drawFonts(); } }, icon('trash'))));
    fontsBox.append(h('div', {}, h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { await importFont(); drawFonts(); } }, icon('import'), 'Importar fonte')));
  };
  drawFonts();
  const set = (k, v) => { settings[k] = v; kvSet('settings', settings); };
  const storage = h('p', {}, DB.volatile ? 'Este navegador não deixou guardar dados. Exporte seus cadernos antes de sair.' : 'Calculando o espaço usado…');
  if (!DB.volatile && navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { storage.textContent = `Usando ${fmtSize(e.usage || 0)} neste aparelho. Os cadernos ficam só aqui: use “Backup de todos” na tela inicial para guardar uma cópia.`; }).catch(() => {});
  sheet({
    title: 'Ajustes', wide: true,
    body: [
      switchRow('Escrever só com a Apple Pencil', 'O dedo passa a mover a página e dar zoom. A mão apoiada na tela é ignorada.', settings.pencilOnly, v => set('pencilOnly', v)),
      switchRow('Ligar sozinho ao detectar a Pencil', null, settings.autoPencil, v => set('autoPencil', v)),
      switchRow('Toque com dois dedos desfaz', 'Três dedos refazem.', settings.twoFingerUndo, v => set('twoFingerUndo', v)),
      switchRow('Segurar no fim do traço vira forma', 'Linha reta, círculo ou retângulo perfeitos.', settings.holdShapes, v => set('holdShapes', v)),
      fontsBox,
      h('div', { class: 'field' }, h('span', {}, 'Armazenamento'), storage),
    ],
  });
}
function helpSheet() {
  sheet({
    title: 'Gestos e atalhos', wide: true,
    body: h('ul', { class: 'help-list' },
      h('li', {}, h('b', {}, 'Apple Pencil escreve, dedo navega. '), 'Arraste com um dedo para mover a página e faça pinça com dois para dar zoom.'),
      h('li', {}, h('b', {}, 'Dois dedos tocando '), 'desfazem o último passo; três dedos refazem.'),
      h('li', {}, h('b', {}, 'Segure a caneta parada no fim de um traço '), 'para ele virar linha reta, círculo ou retângulo. Na linha, continue arrastando para ajustar a ponta.'),
      h('li', {}, h('b', {}, 'Laço: '), 'contorne algo para mover, girar (bolinha de cima), redimensionar (bolinha do canto), mudar a cor ou salvar como figurinha.'),
      h('li', {}, h('b', {}, 'Borracha parcial '), 'apaga só o pedaço por onde passa; “Traço inteiro” apaga o traço de uma vez. “Só marca-texto” preserva a escrita.'),
      h('li', {}, h('b', {}, 'PDF: '), 'em Importar (tela inicial) cada PDF vira um caderno; no botão + as páginas do PDF entram no caderno aberto. Escreva por cima e exporte em PDF de novo.'),
      h('li', {}, h('b', {}, 'Texto: '), 'escolha a ferramenta T e toque na página. Toque num texto existente para editar.'),
      h('li', {}, h('b', {}, 'Teclado (iPad com teclado ou computador): '), '⌘Z desfaz, ⇧⌘Z refaz, Delete apaga a seleção, P caneta, L lápis, M marca-texto, E borracha, S laço, T texto, ← → trocam de página.'),
      h('li', {}, h('b', {}, 'Instalar: '), 'no Safari, toque em Compartilhar → “Adicionar à Tela de Início”. O app abre em tela cheia e funciona offline.')),
  });
}

/* ===================== Caderno de boas-vindas ===================== */
function synthStroke(tool, color, size, pts) {
  const out = densify(pts, 0.5);
  for (let i = 2; i < out.length; i += 3) out[i] = Math.round((0.42 + 0.18 * Math.sin(i * 0.12)) * 100) / 100;
  return { t: 's', id: uid('s'), tool, color, size, pts: out };
}
function wave(x0, x1, y, amp, step = 4) { const p = []; for (let x = x0; x <= x1; x += step) p.push([x, y + Math.sin((x - x0) / 18) * amp]); return p; }
function ellipsePts(cx, cy, rx, ry) { const p = []; for (let i = 0; i <= 80; i++) { const a = -2.2 + (i / 80) * Math.PI * 2.08; p.push([cx + Math.cos(a) * rx * (1 + 0.03 * Math.sin(i)), cy + Math.sin(a) * ry]); } return p; }
async function seedWelcome() {
  const p1 = newPage({ tpl: 'lined', color: '#FFFFFF', orient: 'portrait' });
  const lh = 7.1 * MM, top = 30 * MM;
  const body = (txt, line, extra = {}) => Object.assign({ t: 'txt', id: uid('t'), x: 112, y: top + line * lh - lh * 1.05, w: 600, text: txt, font: 'noteworthy', size: 20, color: '#2443D6', bold: false, italic: false, align: 'left' }, extra);
  p1.objects = [
    { t: 'txt', id: uid('t'), x: 108, y: 40, w: 560, text: 'Bem-vindo ao Traço', font: 'ny', size: 42, color: '#171B26', bold: true, italic: false, align: 'left' },
    synthStroke('pen', '#2443D6', 3, wave(112, 470, 104, 2.5)),
    body('Escreva com a Apple Pencil como num caderno de verdade.', 2),
    body('Com o dedo você arrasta a página; com dois dedos, dá zoom.', 3),
    body('Toque com dois dedos para desfazer e com três para refazer.', 4),
    body('Segure a caneta parada no fim do traço: vira linha, círculo ou retângulo.', 5),
    synthStroke('hl', '#FFE14D', 20, [[110, top + 5 * lh - 12], [690, top + 5 * lh - 12]]),
    body('Ferramentas: caneta, lápis, marca-texto, borracha, laço, texto e laser.\nNo botão + você coloca imagens, figurinhas e novas páginas.\nExporte em PDF para imprimir ou mandar.', 7, { color: '#171B26', font: 'sf', size: 20.6, w: 640 }),
    synthStroke('pencil', '#D33A2C', 3.5, ellipsePts(240, top + 9 * lh - 14, 30, 16)),
    { t: 'stk', id: uid('o'), asset: 'b:importante', x: 470, y: 548, w: 200, h: 51, rot: -0.08 },
    { t: 'stk', id: uid('o'), asset: 'b:estrela', x: 640, y: 30, w: 92, h: 92, rot: 0.15 },
    { t: 'stk', id: uid('o'), emoji: '✏️', x: 120, y: 560, w: 60, h: 60, rot: 0 },
    body('Experimente aqui embaixo ↓', 14, { font: 'bradley', size: 24, color: '#1F8A4C' }),
    synthStroke('pen', '#171B26', 2.5, wave(160, 520, 815, 14, 3)),
  ];
  const p2 = newPage({ tpl: 'grid', color: '#FFFFFF', orient: 'portrait' });
  p2.objects = [
    { t: 'txt', id: uid('t'), x: 76, y: 60, w: 600, text: 'Rascunho livre', font: 'avenir', size: 34, color: '#171B26', bold: true, italic: false, align: 'left' },
    { t: 'stk', id: uid('o'), asset: 'b:postit', x: 470, y: 150, w: 230, h: 230, rot: 0.04 },
    { t: 'txt', id: uid('t'), x: 492, y: 190, w: 180, text: 'Lembrete: faça backup exportando o caderno de vez em quando.', font: 'marker', size: 20, color: '#3B2A00', bold: false, italic: false, align: 'left' },
    synthStroke('pen', '#171B26', 2.5, [[90, 400], [90, 160]]),
    synthStroke('pen', '#171B26', 2.5, [[90, 400], [400, 400]]),
    synthStroke('pencil', '#2443D6', 4, wave(95, 395, 290, 60, 3)),
    { t: 'txt', id: uid('t'), x: 92, y: 420, w: 320, text: 'f(x) = sen(x)', font: 'typewriter', size: 20, color: '#2443D6', bold: false, italic: false, align: 'left' },
  ];
  await createNotebook({ title: 'Comece por aqui', cover: '#2443D6', paper: { tpl: 'lined', color: '#FFFFFF', orient: 'portrait' }, pages: [p1, p2] });
}

/* ===================== Ligações ===================== */
function bind() {
  $('#btnNewNb').addEventListener('click', newNotebookDialog);
  $('#btnLibImport').addEventListener('click', importNotebooks);
  $('#btnBackupAll').addEventListener('click', backupAll);
  $('#libSearch').addEventListener('input', renderLibrary);
  $('#btnBack').addEventListener('click', showLibrary);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnPages').addEventListener('click', pagesSheet);
  $('#pageLabel').addEventListener('click', pagesSheet);
  $('#btnInsert').addEventListener('click', e => insertMenu(e.currentTarget));
  $('#btnExport').addEventListener('click', () => { commitText(); exportSheet([{ meta: S.meta, pages: S.pages }]); });
  $('#btnMore').addEventListener('click', e => moreMenu(e.currentTarget));
  $('#btnPrev').addEventListener('click', () => goPage(S.pi - 1));
  $('#btnNext').addEventListener('click', () => goPage(S.pi + 1));
  $('#btnAddPage').addEventListener('click', () => addPage());
  $$('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  const title = $('#nbTitle');
  title.addEventListener('change', () => { if (!S.meta) return; S.meta.title = title.value.trim() || 'Sem título'; title.value = S.meta.title; S.dirty = true; saveNow(); });
  title.addEventListener('keydown', e => { if (e.key === 'Enter') title.blur(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => resize(false)).observe(stage);
  window.addEventListener('resize', () => resize(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { commitText(); saveNow(); } });
  window.addEventListener('pagehide', () => { commitText(); saveNow(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readAccent(); requestRender(false); });
  document.addEventListener('keydown', e => {
    if ($('#editor').hidden || document.querySelector('.backdrop')) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'c' && !typing && S.sel) { e.preventDefault(); copySel(); return; }
    if (mod && e.key.toLowerCase() === 'v' && !typing && S.clip) { e.preventDefault(); paste(); return; }
    if (mod && e.key.toLowerCase() === 'd' && !typing && S.sel) { e.preventDefault(); dupSel(); return; }
    if (typing || mod) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); deleteSel(); }
    else if (e.key === 'Escape') clearSel();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') goPage(S.pi + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPage(S.pi - 1);
    else { const map = { p: 'pen', l: 'pencil', m: 'hl', e: 'eraser', s: 'lasso', t: 'text' }; const t = map[e.key.toLowerCase()]; if (t) setTool(t); }
  });
}

async function init() {
  readAccent();
  bind();
  Assets.onReady = () => { if (S.page) requestRender(); };
  getDownloads();
  const ok = await DB.init();
  if (!ok) { const w = $('#storageWarn'); w.hidden = false; w.textContent = 'Este navegador não permite guardar dados aqui. Você pode usar o Traço, mas exporte seus cadernos antes de fechar.'; }
  const saved = await kvGet('tools', null);
  if (saved) { for (const k of Object.keys(tools)) if (saved.tools && saved.tools[k]) Object.assign(tools[k], saved.tools[k]); if (saved.tool && saved.tool !== 'laser') S.tool = saved.tool; }
  settings = Object.assign(settings, await kvGet('settings', {}));
  recent = await kvGet('recentColors', []);
  await CustomFonts.init();
  if (CustomFonts.list.length) resetTextCaches();
  try {
    const metas = await DB.all('meta');
    if (!metas.length && !(await kvGet('seeded', false))) { await seedWelcome(); await kvSet('seeded', true); }
  } catch (e) { /* ok */ }
  await renderLibrary();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { resetTextCaches(); if (S.page) requestRender(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.claude) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ok */ }
  }
}
init();
