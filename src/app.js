'use strict';

const $ = (sel) => document.querySelector(sel);

/* ---------------------------------------------------------------
 * 8. User interface
 * ------------------------------------------------------------- */

const els = {
  input: $('#input'),
  output: $('#output'),
  reply: $('#reply'),
  restored: $('#restored'),
  customTerms: $('#custom-terms'),
  detectorList: $('#detector-list'),
  mappingBody: $('#mapping-body'),
  tableCount: $('#table-count'),
  exportState: $('#export-state'),
  detectSummary: $('#detect-summary'),
  restoreSummary: $('#restore-summary'),
  importFile: $('#import-file'),
  replyFile: $('#reply-file'),
  toast: $('#toast'),
};

let toastTimer = null;

function toast(message, kind = 'ok') {
  els.toast.textContent = message;
  els.toast.className = 'toast ' + kind;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 4200);
}

function renderDetectorList() {
  els.detectorList.innerHTML = '';
  for (const opt of TYPE_OPTIONS) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = opt.key;
    box.checked = state.enabled.has(opt.key);
    box.addEventListener('change', () => {
      if (box.checked) state.enabled.add(opt.key);
      else state.enabled.delete(opt.key);
    });
    label.append(box, document.createTextNode(' ' + opt.label));
    els.detectorList.append(label);
  }
}

function renderTable() {
  const entries = [...state.mapping.entries()];
  els.tableCount.textContent = String(entries.length);
  els.mappingBody.innerHTML = '';

  if (!entries.length) {
    const row = els.mappingBody.insertRow();
    row.className = 'empty';
    const cell = row.insertCell();
    cell.colSpan = 4;
    cell.textContent = 'Table vide.';
  } else {
    for (const [pseudo, entry] of entries) {
      const row = els.mappingBody.insertRow();
      const pseudoCell = row.insertCell();
      pseudoCell.className = 'pseudo';
      pseudoCell.textContent = pseudo;

      const typeCell = row.insertCell();
      typeCell.className = 'type';
      typeCell.textContent = LABELS[entry.type] || entry.type;

      const valueCell = row.insertCell();
      valueCell.className = 'value';
      valueCell.textContent = entry.value;

      const actCell = row.insertCell();
      actCell.className = 'act';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost btn-mini';
      del.textContent = 'Supprimer';
      del.title = 'Retirer cette entrée : elle ne sera plus anonymisée ni restaurée';
      del.addEventListener('click', () => {
        state.mapping.delete(pseudo);
        state.index.delete(entry.key);
        state.exported = false;
        refresh();
      });
      actCell.append(del);
    }
  }
  updateExportState();
}

function updateExportState() {
  const saved = state.mapping.size > 0 && state.exported;
  els.exportState.textContent = saved ? '✓ Table exportée' : '';
  els.exportState.classList.toggle('ok', saved);
}

function updateCounters() {
  $('#input-count').textContent = els.input.value.length + ' car.';
  $('#output-count').textContent = els.output.value.length + ' car.';
  $('#reply-count').textContent = els.reply.value.length + ' car.';
  $('#restored-count').textContent = els.restored.value.length + ' car.';
}

function refresh() {
  renderTable();
  updateCounters();
}

/* ---------------------------------------------------------------
 * 9. Actions
 * ------------------------------------------------------------- */

function summarizeCounts(counts) {
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => n + ' ' + (LABELS[type] || type).toLowerCase());
  return parts.length ? parts.join(' · ') : 'aucune donnée détectée';
}

function doAnonymize() {
  const text = els.input.value;
  if (!text.trim()) {
    toast('Texte original vide.', 'warn');
    return;
  }
  const result = anonymize(text, els.customTerms.value);
  els.output.value = result.text;
  els.detectSummary.textContent = result.spans.length
    ? result.spans.length + ' remplacement(s) : ' + summarizeCounts(result.counts)
    : 'Aucune donnée sensible détectée.';
  refresh();
  if (!result.spans.length) toast('Aucune donnée détectée. Options de détection et termes manuels ajustables.', 'warn');
}

function doAnonymizeSelection() {
  const { selectionStart: start, selectionEnd: end } = els.input;
  const selected = els.input.value.slice(start, end).trim();
  if (!selected) {
    toast('Aucun passage sélectionné dans le texte original.', 'warn');
    return;
  }
  const current = els.customTerms.value.split('\n').map((t) => t.trim()).filter(Boolean);
  if (current.includes(selected)) {
    toast('« ' + selected + ' » figure déjà dans les termes.', 'warn');
  } else {
    current.push(selected);
    els.customTerms.value = current.join('\n');
    toast('« ' + selected + ' » ajouté aux termes toujours anonymisés.', 'ok');
  }
  doAnonymize();
}

function doDeanonymize() {
  const text = els.reply.value;
  if (!text.trim()) {
    toast('Réponse de l\'IA vide.', 'warn');
    return;
  }
  if (!state.mapping.size) {
    toast('Table vide : importer le fichier .json avant de restaurer.', 'err');
    return;
  }
  const result = deanonymize(text);
  els.restored.value = result.text;
  els.restoreSummary.textContent =
    result.replaced + ' valeur(s) restaurée(s)' +
    (result.tabular ? ' · colonnes CSV préservées' : '') +
    (result.missing ? ' · ' + result.missing + ' pseudonyme(s) de la table absent(s) du texte' : '');
  updateCounters();
  if (!result.replaced) toast('Aucun pseudonyme reconnu dans ce texte.', 'warn');
}

async function copyField(field) {
  if (!field.value) {
    toast('Rien à copier.', 'warn');
    return;
  }
  try {
    await navigator.clipboard.writeText(field.value);
  } catch {
    field.select();
    document.execCommand('copy');
  }
  toast('Copié.', 'ok');
}

function download(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

// A CSV/TSV reply is saved as such, with a BOM so Excel reads accents as UTF-8.
function doDownloadRestored() {
  const text = els.restored.value;
  if (!text) {
    toast('Rien à télécharger.', 'warn');
    return;
  }
  if (isTabular(text)) {
    const ext = tabularCells(text)[0].delim === '\t' ? 'tsv' : 'csv';
    download('\uFEFF' + text, 'texte-restaure-' + timestamp() + '.' + ext, 'text/' + (ext === 'csv' ? 'csv' : 'tab-separated-values') + ';charset=utf-8');
  } else {
    download(text, 'texte-restaure-' + timestamp() + '.txt', 'text/plain;charset=utf-8');
  }
}

function doOpenReply(file) {
  const reader = new FileReader();
  reader.onload = () => {
    els.reply.value = String(reader.result).replace(/^\uFEFF/, '');
    updateCounters();
    if (state.mapping.size) doDeanonymize();
    else toast('Fichier chargé. Table vide : importer le fichier .json pour restaurer.', 'warn');
  };
  reader.onerror = () => toast('Lecture du fichier impossible.', 'err');
  reader.readAsText(file);
}

function doExport() {
  if (!state.mapping.size) {
    toast('Table vide, rien à exporter.', 'warn');
    return;
  }
  download(JSON.stringify(buildExport(), null, 2), 'table-anonymisation-' + timestamp() + '.json', 'application/json');

  state.exported = true;
  updateExportState();
  toast('Table exportée (' + state.mapping.size + ' entrées). Fichier contenant les vraies données : à conserver en lieu sûr.', 'ok');
}

function doImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let payload;
    try {
      payload = JSON.parse(String(reader.result));
    } catch {
      toast('Fichier illisible : JSON invalide.', 'err');
      return;
    }
    let added;
    try {
      added = loadImport(payload);
    } catch (error) {
      toast(error.message, 'err');
      return;
    }
    const radio = document.querySelector('input[name="mode"][value="' + state.mode + '"]');
    if (radio) radio.checked = true;
    refresh();
    toast(added + ' entrée(s) importée(s).', 'ok');
  };
  reader.onerror = () => toast('Lecture du fichier impossible.', 'err');
  reader.readAsText(file);
}

function doReset() {
  if (!state.mapping.size) {
    toast('Table déjà vide.', 'warn');
    return;
  }
  const warning = state.exported
    ? 'Effacer les ' + state.mapping.size + ' entrées de la table ?'
    : 'Table non exportée. Effacer quand même les ' + state.mapping.size + ' entrées ? La désanonymisation deviendra impossible.';
  if (!confirm(warning)) return;

  clearMapping();
  els.output.value = '';
  els.restored.value = '';
  els.detectSummary.textContent = '';
  els.restoreSummary.textContent = '';
  refresh();
  toast('Table effacée.', 'ok');
}

function onModeChange(value) {
  if (state.mapping.size && value !== state.mode) {
    if (!confirm('Changer de style de pseudonyme vide la table. Effacer les ' + state.mapping.size + ' entrées actuelles ?')) {
      const radio = document.querySelector('input[name="mode"][value="' + state.mode + '"]');
      if (radio) radio.checked = true;
      return;
    }
    clearMapping();
    els.output.value = '';
  }
  state.mode = value;
  refresh();
}

/* ---------------------------------------------------------------
 * 10. Wiring
 * ------------------------------------------------------------- */

const ACTIONS = {
  anonymize: doAnonymize,
  'anonymize-selection': doAnonymizeSelection,
  deanonymize: doDeanonymize,
  'copy-output': () => copyField(els.output),
  'copy-restored': () => copyField(els.restored),
  'download-restored': doDownloadRestored,
  'open-reply': () => els.replyFile.click(),
  export: doExport,
  import: () => els.importFile.click(),
  reset: doReset,
  'clear-input': () => { els.input.value = ''; els.output.value = ''; els.detectSummary.textContent = ''; updateCounters(); },
  'clear-reply': () => { els.reply.value = ''; els.restored.value = ''; els.restoreSummary.textContent = ''; updateCounters(); },
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = ACTIONS[button.dataset.action];
  if (action) action();
});

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener('change', () => radio.checked && onModeChange(radio.value));
}

els.importFile.addEventListener('change', () => {
  const file = els.importFile.files[0];
  if (file) doImport(file);
  els.importFile.value = '';
});

els.replyFile.addEventListener('change', () => {
  const file = els.replyFile.files[0];
  if (file) doOpenReply(file);
  els.replyFile.value = '';
});

for (const field of [els.input, els.reply]) {
  field.addEventListener('input', updateCounters);
}

// Ctrl/Cmd + Enter runs the action of the field being edited.
for (const [field, action] of [[els.input, doAnonymize], [els.reply, doDeanonymize]]) {
  field.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  });
}

// Last line of defence: the table only lives in memory.
window.addEventListener('beforeunload', (event) => {
  if (state.mapping.size && !state.exported) {
    event.preventDefault();
    event.returnValue = '';
    return '';
  }
});

renderDetectorList();
refresh();
