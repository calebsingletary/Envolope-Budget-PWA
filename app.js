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
let deferredInstallPrompt = null;

const els = {
  envelopeGrid: document.querySelector('#envelopeGrid'),
  summaryBudgeted: document.querySelector('#summaryBudgeted'),
  summarySpent: document.querySelector('#summarySpent'),
  summaryRemaining: document.querySelector('#summaryRemaining'),
  historyList: document.querySelector('#historyList'),
  addEnvelopeBtn: document.querySelector('#addEnvelopeBtn'),
  spendDialog: document.querySelector('#spendDialog'),
  spendForm: document.querySelector('#spendForm'),
  spendTitle: document.querySelector('#spendTitle'),
  spendAmount: document.querySelector('#spendAmount'),
  spendNote: document.querySelector('#spendNote'),
  editEnvelopeFromSpend: document.querySelector('#editEnvelopeFromSpend'),
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

function spentForEnvelope(id) {
  return state.transactions.filter(t => t.envelopeId === id).reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function availableForEnvelope(env) {
  return Number(env.budget || 0) + Number(env.carry || 0);
}

function render() {
  const budgeted = state.envelopes.reduce((sum, e) => sum + availableForEnvelope(e), 0);
  const spent = state.transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  els.summaryBudgeted.textContent = money.format(budgeted);
  els.summarySpent.textContent = money.format(spent);
  els.summaryRemaining.textContent = money.format(budgeted - spent);

  els.envelopeGrid.innerHTML = '';
  for (const env of state.envelopes) {
    const spentAmount = spentForEnvelope(env.id);
    const available = availableForEnvelope(env);
    const remaining = available - spentAmount;
    const pct = available <= 0 ? 0 : Math.max(0, Math.min(100, (remaining / available) * 100));
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
      <div class="envelope-meta">${money.format(spentAmount)} spent of ${money.format(available)}</div>
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
  const tx = [...state.transactions].sort((a,b) => b.createdAt - a.createdAt);
  if (!tx.length) {
    els.historyList.innerHTML = '<div class="empty">No spending recorded yet.</div>';
    return;
  }
  for (const t of tx.slice(0, 30)) {
    const env = state.envelopes.find(e => e.id === t.envelopeId);
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div>
        <div class="history-title">${escapeHtml(env?.emoji || '💵')} ${escapeHtml(env?.name || 'Deleted envelope')}</div>
        <div class="history-note">${t.note ? escapeHtml(t.note) + ' · ' : ''}${new Date(t.createdAt).toLocaleString()}</div>
      </div>
      <div class="history-amount">-${money.format(Number(t.amount || 0))}</div>
    `;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary history-edit';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openEditTransaction(t.id));
    row.appendChild(edit);
    els.historyList.appendChild(row);
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
    amount,
    note: els.spendNote.value.trim(),
    createdAt: Date.now()
  });
  saveState();
  els.spendDialog.close();
  toast('Spending saved');
  render();
});

els.editEnvelopeFromSpend.addEventListener('click', () => {
  const id = selectedEnvelopeId;
  els.spendDialog.close();
  openEnvelopeDialog(id);
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
    const remaining = availableForEnvelope(env) - spentForEnvelope(env.id);
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
