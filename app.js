const STORAGE_KEY = 'envelope-budget-pwa-v1';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const defaultState = {
  monthKey: monthKey(new Date()),
  envelopes: [
    { id: crypto.randomUUID(), name: 'Groceries', emoji: '🥦', budget: 500, rollover: false, carry: 0 },
    { id: crypto.randomUUID(), name: 'Gas', emoji: '⛽', budget: 300, rollover: false, carry: 0 },
    { id: crypto.randomUUID(), name: 'Household', emoji: '🧻', budget: 150, rollover: true, carry: 0 },
    { id: crypto.randomUUID(), name: 'Restaurants', emoji: '🍔', budget: 200, rollover: false, carry: 0 },
    { id: crypto.randomUUID(), name: 'Shopping', emoji: '🛒', budget: 100, rollover: false, carry: 0 },
    { id: crypto.randomUUID(), name: 'Maintenance', emoji: '🔧', budget: 100, rollover: true, carry: 0 }
  ],
  transactions: []
};

let state = loadState();
let selectedEnvelopeId = null;
let editingEnvelopeId = null;
let editingTransactionId = null;
let editingSplitGroupId = null;
let deferredInstallPrompt = null;

const els = {
  envelopeGrid: document.querySelector('#envelopeGrid'),
  summaryBudgeted: document.querySelector('#summaryBudgeted'),
  summarySpent: document.querySelector('#summarySpent'),
  summaryAdded: document.querySelector('#summaryAdded'),
  summaryRemaining: document.querySelector('#summaryRemaining'),
  historyList: document.querySelector('#historyList'),
  addEnvelopeBtn: document.querySelector('#addEnvelopeBtn'),
  spendDialog: document.querySelector('#spendDialog'),
  spendForm: document.querySelector('#spendForm'),
  spendTitle: document.querySelector('#spendTitle'),
  spendAmount: document.querySelector('#spendAmount'),
  spendNote: document.querySelector('#spendNote'),
  addMoneyBtn: document.querySelector('#addMoneyBtn'),
  editEnvelopeFromSpend: document.querySelector('#editEnvelopeFromSpend'),
  openSplitFromSpend: document.querySelector('#openSplitFromSpend'),
  splitDialog: document.querySelector('#splitDialog'),
  splitForm: document.querySelector('#splitForm'),
  splitDialogTitle: document.querySelector('#splitDialogTitle'),
  splitRows: document.querySelector('#splitRows'),
  addSplitRowBtn: document.querySelector('#addSplitRowBtn'),
  splitNote: document.querySelector('#splitNote'),
  splitTotal: document.querySelector('#splitTotal'),
  splitError: document.querySelector('#splitError'),
  deleteSplitBtn: document.querySelector('#deleteSplitBtn'),
  envelopeDialog: document.querySelector('#envelopeDialog'),
  envelopeForm: document.querySelector('#envelopeForm'),
  envelopeDialogTitle: document.querySelector('#envelopeDialogTitle'),
  envelopeEmoji: document.querySelector('#envelopeEmoji'),
  envelopeName: document.querySelector('#envelopeName'),
  envelopeBudget: document.querySelector('#envelopeBudget'),
  envelopeRollover: document.querySelector('#envelopeRollover'),
  deleteEnvelopeBtn: document.querySelector('#deleteEnvelopeBtn'),
  editTransactionDialog: document.querySelector('#editTransactionDialog'),
  editTransactionForm: document.querySelector('#editTransactionForm'),
  editTransactionEnvelope: document.querySelector('#editTransactionEnvelope'),
  editTransactionType: document.querySelector('#editTransactionType'),
  editTransactionAmount: document.querySelector('#editTransactionAmount'),
  editTransactionNote: document.querySelector('#editTransactionNote'),
  deleteTransactionBtn: document.querySelector('#deleteTransactionBtn'),
  exportBtn: document.querySelector('#exportBtn'),
  importInput: document.querySelector('#importInput'),
  newMonthBtn: document.querySelector('#newMonthBtn'),
  clearHistoryBtn: document.querySelector('#clearHistoryBtn'),
  installBtn: document.querySelector('#installBtn'),
  toast: document.querySelector('#toast')
};

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    if (!parsed.envelopes || !parsed.transactions) return structuredClone(defaultState);
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isAddTransaction(t) {
  return t?.type === 'add';
}

function spentForEnvelope(id) {
  return state.transactions
    .filter(t => t.envelopeId === id && !isAddTransaction(t))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function addedForEnvelope(id) {
  return state.transactions
    .filter(t => t.envelopeId === id && isAddTransaction(t))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function availableForEnvelope(env) {
  return Number(env.budget || 0) + Number(env.carry || 0);
}

function fundedForEnvelope(env) {
  return availableForEnvelope(env) + addedForEnvelope(env.id);
}

function render() {
  const budgeted = state.envelopes.reduce((sum, e) => sum + availableForEnvelope(e), 0);
  const spent = state.transactions
    .filter(t => !isAddTransaction(t))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const added = state.transactions
    .filter(isAddTransaction)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  els.summaryBudgeted.textContent = money.format(budgeted);
  els.summarySpent.textContent = money.format(spent);
  els.summaryAdded.textContent = money.format(added);
  els.summaryRemaining.textContent = money.format(budgeted + added - spent);

  els.envelopeGrid.innerHTML = '';
  for (const env of state.envelopes) {
    const spentAmount = spentForEnvelope(env.id);
    const addedAmount = addedForEnvelope(env.id);
    const funded = fundedForEnvelope(env);
    const remaining = funded - spentAmount;
    const pct = funded <= 0 ? 0 : Math.max(0, Math.min(100, (remaining / funded) * 100));
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'envelope-card';
    card.innerHTML = `
      <div class="envelope-top">
        <span class="envelope-icon">${escapeHtml(env.emoji || '💵')}</span>
        <span class="envelope-meta">${env.rollover ? 'Rollover on' : 'Monthly'}</span>
      </div>
      <div class="envelope-name">${escapeHtml(env.name)}</div>
      <div class="envelope-remaining ${remaining < 0 ? 'over' : ''}">${money.format(remaining)} left</div>
      <div class="envelope-meta">${money.format(spentAmount)} spent${addedAmount > 0 ? ` · ${money.format(addedAmount)} added` : ''} · ${money.format(funded)} funded</div>
      <div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
    `;
    card.addEventListener('click', () => openSpendDialog(env.id));
    els.envelopeGrid.appendChild(card);
  }

  renderHistory();
  renderTransactionEnvelopeOptions();
}

function renderHistory() {
  els.historyList.innerHTML = '';
  const sorted = [...state.transactions].sort((a,b) => b.createdAt - a.createdAt);
  if (!sorted.length) {
    els.historyList.innerHTML = '<div class="empty">No spending recorded yet.</div>';
    return;
  }

  const seenGroups = new Set();
  let rendered = 0;
  for (const t of sorted) {
    if (rendered >= 30) break;

    if (t.groupId) {
      if (seenGroups.has(t.groupId)) continue;
      seenGroups.add(t.groupId);
      const parts = state.transactions
        .filter(x => x.groupId === t.groupId)
        .sort((a,b) => a.createdAt - b.createdAt);
      const totalAmount = parts.reduce((sum, part) => sum + Number(part.amount || 0), 0);
      const first = parts[0];
      const note = first?.note || '';
      const breakdown = parts.map(part => {
        const env = state.envelopes.find(e => e.id === part.envelopeId);
        return `${escapeHtml(env?.emoji || '💵')} ${escapeHtml(env?.name || 'Deleted envelope')} ${money.format(Number(part.amount || 0))}`;
      }).join(' · ');

      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <div>
          <div class="history-title">Split transaction <span class="split-badge">${parts.length} envelopes</span></div>
          <div class="history-note">${note ? escapeHtml(note) + ' · ' : ''}${new Date(first?.createdAt || t.createdAt).toLocaleString()}</div>
          <div class="split-breakdown">${breakdown}</div>
        </div>
        <div class="history-amount">-${money.format(totalAmount)}</div>
      `;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'secondary history-edit';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openSplitDialog({ groupId: t.groupId }));
      row.appendChild(edit);
      els.historyList.appendChild(row);
      rendered += 1;
      continue;
    }

    const env = state.envelopes.find(e => e.id === t.envelopeId);
    const row = document.createElement('div');
    row.className = 'history-item';
    const isAdd = isAddTransaction(t);
    row.innerHTML = `
      <div>
        <div class="history-title">${escapeHtml(env?.emoji || '💵')} ${escapeHtml(env?.name || 'Deleted envelope')}${isAdd ? ' <span class="add-badge">Money added</span>' : ''}</div>
        <div class="history-note">${t.note ? escapeHtml(t.note) + ' · ' : ''}${new Date(t.createdAt).toLocaleString()}</div>
      </div>
      <div class="history-amount ${isAdd ? 'history-add' : ''}">${isAdd ? '+' : '-'}${money.format(Number(t.amount || 0))}</div>
    `;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary history-edit';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openEditTransaction(t.id));
    row.appendChild(edit);
    els.historyList.appendChild(row);
    rendered += 1;
  }
}

function openSpendDialog(envId) {
  const env = state.envelopes.find(e => e.id === envId);
  if (!env) return;
  selectedEnvelopeId = envId;
  els.spendTitle.textContent = `${env.emoji || '💵'} ${env.name}`;
  els.spendAmount.value = '';
  els.spendNote.value = '';
  els.spendDialog.showModal();
  setTimeout(() => els.spendAmount.focus(), 30);
}

els.spendForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const amount = Number(els.spendAmount.value);
  if (!selectedEnvelopeId || !Number.isFinite(amount) || amount <= 0) return;
  state.transactions.push({
    id: crypto.randomUUID(),
    envelopeId: selectedEnvelopeId,
    type: 'spend',
    amount,
    note: els.spendNote.value.trim(),
    createdAt: Date.now()
  });
  saveState();
  els.spendDialog.close();
  toast('Spending saved');
  render();
});

els.addMoneyBtn.addEventListener('click', () => {
  const amount = Number(els.spendAmount.value);
  if (!selectedEnvelopeId || !Number.isFinite(amount) || amount <= 0) {
    els.spendAmount.focus();
    return;
  }
  state.transactions.push({
    id: crypto.randomUUID(),
    envelopeId: selectedEnvelopeId,
    type: 'add',
    amount,
    note: els.spendNote.value.trim(),
    createdAt: Date.now()
  });
  saveState();
  els.spendDialog.close();
  toast('Money added');
  render();
});

els.editEnvelopeFromSpend.addEventListener('click', () => {
  const id = selectedEnvelopeId;
  els.spendDialog.close();
  openEnvelopeDialog(id);
});


els.openSplitFromSpend.addEventListener('click', () => {
  const initialAmount = Number(els.spendAmount.value);
  const initialNote = els.spendNote.value.trim();
  const initialEnvelopeId = selectedEnvelopeId;
  els.spendDialog.close();
  openSplitDialog({
    initialEnvelopeId,
    initialAmount: Number.isFinite(initialAmount) && initialAmount > 0 ? initialAmount : null,
    note: initialNote
  });
});

function createSplitRow(envelopeId = '', amount = '') {
  const row = document.createElement('div');
  row.className = 'split-row';

  const envLabel = document.createElement('label');
  envLabel.textContent = 'Envelope';
  const select = document.createElement('select');
  select.className = 'split-envelope';
  for (const env of state.envelopes) {
    const option = document.createElement('option');
    option.value = env.id;
    option.textContent = `${env.emoji || '💵'} ${env.name}`;
    select.appendChild(option);
  }
  if (envelopeId && state.envelopes.some(e => e.id === envelopeId)) select.value = envelopeId;
  envLabel.appendChild(select);

  const amountLabel = document.createElement('label');
  amountLabel.textContent = 'Amount';
  const input = document.createElement('input');
  input.className = 'split-amount';
  input.type = 'number';
  input.inputMode = 'decimal';
  input.min = '0.01';
  input.step = '0.01';
  input.placeholder = '0.00';
  input.value = amount === '' ? '' : Number(amount).toFixed(2);
  amountLabel.appendChild(input);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-split';
  remove.setAttribute('aria-label', 'Remove split row');
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    row.remove();
    ensureMinimumSplitRows();
    updateSplitTotal();
  });

  input.addEventListener('input', updateSplitTotal);
  row.append(envLabel, amountLabel, remove);
  els.splitRows.appendChild(row);
  ensureMinimumSplitRows();
  return row;
}

function ensureMinimumSplitRows() {
  const rows = [...els.splitRows.querySelectorAll('.split-row')];
  for (const row of rows) {
    const remove = row.querySelector('.remove-split');
    remove.disabled = rows.length <= 2;
  }
}

function updateSplitTotal() {
  const total = [...els.splitRows.querySelectorAll('.split-amount')]
    .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
  els.splitTotal.textContent = money.format(total);
}

function openSplitDialog({ initialEnvelopeId = null, initialAmount = null, note = '', groupId = null } = {}) {
  if (state.envelopes.length < 2) {
    alert('Add at least two envelopes before creating a split transaction.');
    return;
  }
  editingSplitGroupId = groupId;
  els.splitDialogTitle.textContent = groupId ? 'Edit split transaction' : 'Split transaction';
  els.deleteSplitBtn.classList.toggle('hidden', !groupId);
  els.splitRows.innerHTML = '';
  els.splitError.textContent = '';

  if (groupId) {
    const parts = state.transactions.filter(t => t.groupId === groupId).sort((a,b) => a.createdAt - b.createdAt);
    if (!parts.length) return;
    els.splitNote.value = parts[0].note || '';
    for (const part of parts) createSplitRow(part.envelopeId, part.amount);
  } else {
    els.splitNote.value = note || '';
    const firstId = initialEnvelopeId || state.envelopes[0].id;
    const alternate = state.envelopes.find(e => e.id !== firstId)?.id || state.envelopes[0].id;
    createSplitRow(firstId, initialAmount || '');
    createSplitRow(alternate, '');
  }

  updateSplitTotal();
  els.splitDialog.showModal();
  setTimeout(() => els.splitRows.querySelector('.split-amount')?.focus(), 30);
}

els.addSplitRowBtn.addEventListener('click', () => {
  createSplitRow(state.envelopes[0]?.id || '', '');
  updateSplitTotal();
});

els.splitForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const rows = [...els.splitRows.querySelectorAll('.split-row')];
  const parts = rows.map(row => ({
    envelopeId: row.querySelector('.split-envelope').value,
    amount: Number(row.querySelector('.split-amount').value)
  }));
  const validParts = parts.filter(part => Number.isFinite(part.amount) && part.amount > 0);

  if (validParts.length < 2 || validParts.length !== parts.length) {
    els.splitError.textContent = 'Enter an amount greater than $0 for at least two envelopes.';
    return;
  }

  const note = els.splitNote.value.trim();
  const groupId = editingSplitGroupId || crypto.randomUUID();
  let createdAt = Date.now();

  if (editingSplitGroupId) {
    const existing = state.transactions.filter(t => t.groupId === editingSplitGroupId);
    if (existing.length) createdAt = Math.min(...existing.map(t => t.createdAt));
    state.transactions = state.transactions.filter(t => t.groupId !== editingSplitGroupId);
  }

  validParts.forEach((part, index) => {
    state.transactions.push({
      id: crypto.randomUUID(),
      groupId,
      envelopeId: part.envelopeId,
      type: 'spend',
      amount: part.amount,
      note,
      createdAt: createdAt + index
    });
  });

  saveState();
  els.splitDialog.close();
  toast(editingSplitGroupId ? 'Split transaction updated' : 'Split transaction saved');
  editingSplitGroupId = null;
  render();
});

els.deleteSplitBtn.addEventListener('click', () => {
  if (!editingSplitGroupId || !confirm('Delete this entire split transaction?')) return;
  state.transactions = state.transactions.filter(t => t.groupId !== editingSplitGroupId);
  saveState();
  els.splitDialog.close();
  editingSplitGroupId = null;
  toast('Split transaction deleted');
  render();
});

els.addEnvelopeBtn.addEventListener('click', () => openEnvelopeDialog());

function openEnvelopeDialog(id = null) {
  editingEnvelopeId = id;
  const env = state.envelopes.find(e => e.id === id);
  els.envelopeDialogTitle.textContent = env ? 'Edit envelope' : 'Add envelope';
  els.envelopeEmoji.value = env?.emoji || '💵';
  els.envelopeName.value = env?.name || '';
  els.envelopeBudget.value = env ? env.budget : '';
  els.envelopeRollover.checked = Boolean(env?.rollover);
  els.deleteEnvelopeBtn.classList.toggle('hidden', !env);
  els.envelopeDialog.showModal();
  setTimeout(() => els.envelopeName.focus(), 30);
}

els.envelopeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = els.envelopeName.value.trim();
  const budget = Number(els.envelopeBudget.value);
  if (!name || !Number.isFinite(budget) || budget < 0) return;
  if (editingEnvelopeId) {
    const env = state.envelopes.find(e => e.id === editingEnvelopeId);
    if (!env) return;
    env.name = name;
    env.emoji = els.envelopeEmoji.value.trim() || '💵';
    env.budget = budget;
    env.rollover = els.envelopeRollover.checked;
  } else {
    state.envelopes.push({ id: crypto.randomUUID(), name, emoji: els.envelopeEmoji.value.trim() || '💵', budget, rollover: els.envelopeRollover.checked, carry: 0 });
  }
  saveState();
  els.envelopeDialog.close();
  toast(editingEnvelopeId ? 'Envelope updated' : 'Envelope added');
  render();
});

els.deleteEnvelopeBtn.addEventListener('click', () => {
  if (!editingEnvelopeId) return;
  const env = state.envelopes.find(e => e.id === editingEnvelopeId);
  if (!env) return;
  if (!confirm(`Delete ${env.name}? Its transaction history will also be deleted.`)) return;
  state.envelopes = state.envelopes.filter(e => e.id !== editingEnvelopeId);
  state.transactions = state.transactions.filter(t => t.envelopeId !== editingEnvelopeId);
  saveState();
  els.envelopeDialog.close();
  toast('Envelope deleted');
  render();
});

function renderTransactionEnvelopeOptions() {
  els.editTransactionEnvelope.innerHTML = '';
  for (const env of state.envelopes) {
    const option = document.createElement('option');
    option.value = env.id;
    option.textContent = `${env.emoji || '💵'} ${env.name}`;
    els.editTransactionEnvelope.appendChild(option);
  }
}

function openEditTransaction(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  editingTransactionId = id;
  renderTransactionEnvelopeOptions();
  els.editTransactionEnvelope.value = t.envelopeId;
  els.editTransactionType.value = isAddTransaction(t) ? 'add' : 'spend';
  els.editTransactionAmount.value = t.amount;
  els.editTransactionNote.value = t.note || '';
  els.editTransactionDialog.showModal();
}

els.editTransactionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const t = state.transactions.find(x => x.id === editingTransactionId);
  if (!t) return;
  const amount = Number(els.editTransactionAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  t.envelopeId = els.editTransactionEnvelope.value;
  t.type = els.editTransactionType.value === 'add' ? 'add' : 'spend';
  t.amount = amount;
  t.note = els.editTransactionNote.value.trim();
  saveState();
  els.editTransactionDialog.close();
  toast('Transaction updated');
  render();
});

els.deleteTransactionBtn.addEventListener('click', () => {
  if (!editingTransactionId || !confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(t => t.id !== editingTransactionId);
  saveState();
  els.editTransactionDialog.close();
  toast('Transaction deleted');
  render();
});

els.newMonthBtn.addEventListener('click', () => {
  if (!confirm('Start a new month? Rollover envelopes will carry unused money forward; transaction history for the current month will be cleared from the active budget. Export a backup first if you want to keep a file copy.')) return;
  for (const env of state.envelopes) {
    const remaining = fundedForEnvelope(env) - spentForEnvelope(env.id);
    env.carry = env.rollover ? Math.max(0, remaining) : 0;
  }
  state.transactions = [];
  state.monthKey = monthKey(new Date());
  saveState();
  toast('New month started');
  render();
});

els.clearHistoryBtn.addEventListener('click', () => {
  if (!state.transactions.length || !confirm('Clear all current transaction history? Envelope spending totals will reset too.')) return;
  state.transactions = [];
  saveState();
  toast('History cleared');
  render();
});

els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EnvelopeBudget-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup downloaded');
});

els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.envelopes) || !Array.isArray(parsed.transactions)) throw new Error('Invalid backup');
    state = parsed;
    saveState();
    render();
    toast('Backup restored');
  } catch {
    alert('That file does not look like a valid Envelope Budget backup.');
  } finally {
    els.importInput.value = '';
  }
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.close)?.close());
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installBtn.classList.remove('hidden');
});

els.installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  els.installBtn.classList.add('hidden');
  toast('App installed');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

render();
