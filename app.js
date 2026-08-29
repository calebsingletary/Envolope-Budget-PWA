const STORAGE_KEY = 'envelope-budget-pwa-v1';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const DEFAULT_CYCLE_TYPE = 'biweekly';
const DEFAULT_CYCLE_DAYS = 14;
const CYCLE_PANEL_COLLAPSED_KEY = 'envelope-budget-pwa-cycle-panel-collapsed';

const defaultState = {
  schemaVersion: 3,
  cycleType: DEFAULT_CYCLE_TYPE,
  customCycleDays: DEFAULT_CYCLE_DAYS,
  monthlyAnchorDay: null,
  nextCycleDate: '',
  currentCycleStartedAt: null,
  lastCycleDate: '',
  envelopes: [
    { id: crypto.randomUUID(), name: 'Groceries', emoji: '🥦', fundingAmount: 250, fundEveryCycle: true, openingBalance: 0 },
    { id: crypto.randomUUID(), name: 'Gas', emoji: '⛽', fundingAmount: 150, fundEveryCycle: true, openingBalance: 0 },
    { id: crypto.randomUUID(), name: 'Household', emoji: '🧻', fundingAmount: 75, fundEveryCycle: true, openingBalance: 0 },
    { id: crypto.randomUUID(), name: 'Restaurants', emoji: '🍔', fundingAmount: 100, fundEveryCycle: true, openingBalance: 0 },
    { id: crypto.randomUUID(), name: 'Shopping', emoji: '🛒', fundingAmount: 50, fundEveryCycle: true, openingBalance: 0 },
    { id: crypto.randomUUID(), name: 'Maintenance', emoji: '🔧', fundingAmount: 50, fundEveryCycle: true, openingBalance: 0 }
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
  envelopeFundEveryCycle: document.querySelector('#envelopeFundEveryCycle'),
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
  clearHistoryBtn: document.querySelector('#clearHistoryBtn'),
  installBtn: document.querySelector('#installBtn'),
  toast: document.querySelector('#toast'),
  cyclePanel: document.querySelector('#cyclePanel'),
  cyclePanelBody: document.querySelector('#cyclePanelBody'),
  toggleCyclePanelBtn: document.querySelector('#toggleCyclePanelBtn'),
  cycleToggleLabel: document.querySelector('#cycleToggleLabel'),
  cycleStatusTitle: document.querySelector('#cycleStatusTitle'),
  cycleStatusText: document.querySelector('#cycleStatusText'),
  cycleFundingTotal: document.querySelector('#cycleFundingTotal'),
  reviewCycleBtn: document.querySelector('#reviewCycleBtn'),
  cycleDateInput: document.querySelector('#cycleDateInput'),
  saveCycleDateBtn: document.querySelector('#saveCycleDateBtn'),
  cycleTypeSelect: document.querySelector('#cycleTypeSelect'),
  customCycleDaysWrap: document.querySelector('#customCycleDaysWrap'),
  customCycleDaysInput: document.querySelector('#customCycleDaysInput'),
  cycleDialog: document.querySelector('#cycleDialog'),
  cycleForm: document.querySelector('#cycleForm'),
  cycleDialogTitle: document.querySelector('#cycleDialogTitle'),
  cycleDialogText: document.querySelector('#cycleDialogText'),
  cycleFundingRows: document.querySelector('#cycleFundingRows'),
  cycleDialogTotal: document.querySelector('#cycleDialogTotal')
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysToDateKey(key, days) {
  const date = parseLocalDate(key);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function addMonthsToDateKey(key, months, anchorDay = null) {
  const date = parseLocalDate(key);
  if (!date) return '';
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + months;
  const preferredDay = Number(anchorDay) || date.getDate();
  const lastDay = new Date(targetYear, targetMonth + 1, 0, 12).getDate();
  const next = new Date(targetYear, targetMonth, Math.min(preferredDay, lastDay), 12);
  return localDateKey(next);
}

function cycleTypeLabel(type = state?.cycleType) {
  return ({
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
    custom: 'Custom interval'
  })[type] || 'Every 2 weeks';
}

function cycleDescription() {
  if (state.cycleType === 'weekly') return 'every 7 days';
  if (state.cycleType === 'monthly') return 'monthly';
  if (state.cycleType === 'custom') return `every ${Math.max(1, Number(state.customCycleDays || DEFAULT_CYCLE_DAYS))} days`;
  return 'every 14 days';
}

function nextCycleDateAfter(key) {
  if (state.cycleType === 'monthly') {
    return addMonthsToDateKey(key, 1, state.monthlyAnchorDay);
  }
  const days = state.cycleType === 'weekly'
    ? 7
    : state.cycleType === 'custom'
      ? Math.max(1, Number(state.customCycleDays || DEFAULT_CYCLE_DAYS))
      : 14;
  return addDaysToDateKey(key, days);
}

function formatDateKey(key) {
  const date = parseLocalDate(key);
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set';
}

function migrateState(parsed) {
  if (!parsed || !Array.isArray(parsed.envelopes) || !Array.isArray(parsed.transactions)) {
    return structuredClone(defaultState);
  }

  const migrated = parsed;
  migrated.schemaVersion = 3;
  migrated.cycleType = ['weekly', 'biweekly', 'monthly', 'custom'].includes(migrated.cycleType) ? migrated.cycleType : DEFAULT_CYCLE_TYPE;
  migrated.customCycleDays = Number.isFinite(Number(migrated.customCycleDays)) && Number(migrated.customCycleDays) >= 1
    ? Math.round(Number(migrated.customCycleDays))
    : (Number.isFinite(Number(migrated.cycleDays)) && Number(migrated.cycleDays) >= 1 ? Math.round(Number(migrated.cycleDays)) : DEFAULT_CYCLE_DAYS);
  migrated.monthlyAnchorDay = Number.isInteger(Number(migrated.monthlyAnchorDay)) && Number(migrated.monthlyAnchorDay) >= 1 && Number(migrated.monthlyAnchorDay) <= 31
    ? Number(migrated.monthlyAnchorDay)
    : null;
  migrated.nextCycleDate = typeof migrated.nextCycleDate === 'string' ? migrated.nextCycleDate : '';
  migrated.currentCycleStartedAt = Number.isFinite(Number(migrated.currentCycleStartedAt)) ? Number(migrated.currentCycleStartedAt) : null;
  migrated.lastCycleDate = typeof migrated.lastCycleDate === 'string' ? migrated.lastCycleDate : '';

  migrated.envelopes = migrated.envelopes.map(env => {
    const oldBase = Number(env.budget || 0) + Number(env.carry || 0);
    const fundingAmount = Number.isFinite(Number(env.fundingAmount))
      ? Number(env.fundingAmount)
      : Math.max(0, Number(env.budget || 0) / 2);
    const openingBalance = Number.isFinite(Number(env.openingBalance))
      ? Number(env.openingBalance)
      : oldBase;
    return {
      ...env,
      fundingAmount,
      fundEveryCycle: typeof env.fundEveryCycle === 'boolean' ? env.fundEveryCycle : true,
      openingBalance
    };
  });

  return migrated;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return migrateState(JSON.parse(raw));
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

function balanceForEnvelope(env) {
  return Number(env.openingBalance || 0) + addedForEnvelope(env.id) - spentForEnvelope(env.id);
}

function cycleTransactions() {
  if (!state.currentCycleStartedAt) return state.transactions;
  return state.transactions.filter(t => Number(t.createdAt || 0) >= state.currentCycleStartedAt);
}

function plannedCycleFunding() {
  return state.envelopes
    .filter(env => env.fundEveryCycle)
    .reduce((sum, env) => sum + Number(env.fundingAmount || 0), 0);
}

function isCycleDue() {
  const due = parseLocalDate(state.nextCycleDate);
  if (!due) return false;
  const today = parseLocalDate(localDateKey());
  return due.getTime() <= today.getTime();
}

function render() {
  const cycleTx = cycleTransactions();
  const spent = cycleTx
    .filter(t => !isAddTransaction(t))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const added = cycleTx
    .filter(isAddTransaction)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const available = state.envelopes.reduce((sum, env) => sum + balanceForEnvelope(env), 0);

  els.summaryBudgeted.textContent = money.format(plannedCycleFunding());
  els.summarySpent.textContent = money.format(spent);
  els.summaryAdded.textContent = money.format(added);
  els.summaryRemaining.textContent = money.format(available);

  els.envelopeGrid.innerHTML = '';
  for (const env of state.envelopes) {
    const spentAmount = spentForEnvelope(env.id);
    const addedAmount = addedForEnvelope(env.id);
    const balance = balanceForEnvelope(env);
    const reference = Math.max(Number(env.fundingAmount || 0), balance + spentAmount, 1);
    const pct = Math.max(0, Math.min(100, (Math.max(0, balance) / reference) * 100));
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'envelope-card';
    card.innerHTML = `
      <div class="envelope-top">
        <span class="envelope-icon">${escapeHtml(env.emoji || '💵')}</span>
        <span class="envelope-meta">${env.fundEveryCycle ? `${money.format(Number(env.fundingAmount || 0))} / cycle` : 'Manual funding'}</span>
      </div>
      <div class="envelope-name">${escapeHtml(env.name)}</div>
      <div class="envelope-remaining ${balance < 0 ? 'over' : ''}">${money.format(balance)} available</div>
      <div class="envelope-meta">${money.format(spentAmount)} spent${addedAmount > 0 ? ` · ${money.format(addedAmount)} added` : ''}</div>
      <div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
    `;
    card.addEventListener('click', () => openSpendDialog(env.id));
    els.envelopeGrid.appendChild(card);
  }

  renderCyclePanel();
  renderHistory();
  renderTransactionEnvelopeOptions();
}


function isCyclePanelCollapsed() {
  return localStorage.getItem(CYCLE_PANEL_COLLAPSED_KEY) === '1';
}

function setCyclePanelCollapsed(collapsed) {
  els.cyclePanel.classList.toggle('collapsed', collapsed);
  els.toggleCyclePanelBtn.setAttribute('aria-expanded', String(!collapsed));
  els.cycleToggleLabel.textContent = collapsed ? 'Expand' : 'Minimize';
  els.toggleCyclePanelBtn.querySelector('.cycle-toggle-icon').textContent = collapsed ? '⌄' : '⌃';
  localStorage.setItem(CYCLE_PANEL_COLLAPSED_KEY, collapsed ? '1' : '0');
}

function renderCyclePanel() {
  setCyclePanelCollapsed(isCyclePanelCollapsed());
  const total = plannedCycleFunding();
  els.cycleFundingTotal.textContent = money.format(total);
  els.cycleDateInput.value = state.nextCycleDate || '';
  els.cycleTypeSelect.value = state.cycleType || DEFAULT_CYCLE_TYPE;
  els.customCycleDaysInput.value = state.customCycleDays || DEFAULT_CYCLE_DAYS;
  els.customCycleDaysWrap.classList.toggle('hidden', els.cycleTypeSelect.value !== 'custom');

  if (!state.nextCycleDate) {
    els.cyclePanel.classList.remove('cycle-ready');
    els.cycleStatusTitle.textContent = 'Set your next budget cycle';
    els.cycleStatusText.textContent = `Choose the schedule and next date for your ${cycleTypeLabel().toLowerCase()} budget cycle.`;
    els.reviewCycleBtn.textContent = 'Review cycle funding';
    els.reviewCycleBtn.disabled = true;
    return;
  }

  const due = isCycleDue();
  els.cyclePanel.classList.toggle('cycle-ready', due);
  els.cycleStatusTitle.textContent = due ? 'New Budget Cycle Ready' : `Next Budget Cycle: ${formatDateKey(state.nextCycleDate)}`;
  els.cycleStatusText.textContent = due
    ? `Funding is ready for ${formatDateKey(state.nextCycleDate)}. Nothing changes until you review and confirm.`
    : `Your next ${cycleTypeLabel().toLowerCase()} cycle begins ${formatDateKey(state.nextCycleDate)} and repeats ${cycleDescription()}. You can review it early if needed.`;
  els.reviewCycleBtn.textContent = due ? 'Review & start cycle' : 'Review cycle funding';
  els.reviewCycleBtn.disabled = false;
}

function renderHistory() {
  els.historyList.innerHTML = '';
  const sorted = [...state.transactions].sort((a,b) => b.createdAt - a.createdAt);
  if (!sorted.length) {
    els.historyList.innerHTML = '<div class="empty">No activity recorded yet.</div>';
    return;
  }

  const seenGroups = new Set();
  const seenCycles = new Set();
  let rendered = 0;

  for (const t of sorted) {
    if (rendered >= 30) break;

    if (t.cycleId) {
      if (seenCycles.has(t.cycleId)) continue;
      seenCycles.add(t.cycleId);
      const parts = state.transactions.filter(x => x.cycleId === t.cycleId);
      const totalAmount = parts.reduce((sum, part) => sum + Number(part.amount || 0), 0);
      const cycleDate = t.cycleDate || localDateKey(new Date(t.createdAt));
      const breakdown = parts.map(part => {
        const env = state.envelopes.find(e => e.id === part.envelopeId);
        return `${escapeHtml(env?.emoji || '💵')} ${escapeHtml(env?.name || 'Deleted envelope')} +${money.format(Number(part.amount || 0))}`;
      }).join(' · ');

      const row = document.createElement('div');
      row.className = 'history-item cycle-history';
      row.innerHTML = `
        <div>
          <div class="history-title">Budget cycle funding <span class="add-badge">${formatDateKey(cycleDate)}</span></div>
          <div class="history-note">Confirmed ${new Date(t.createdAt).toLocaleString()}</div>
          <div class="split-breakdown">${breakdown}</div>
        </div>
        <div class="history-amount history-add">+${money.format(totalAmount)}</div>
      `;
      els.historyList.appendChild(row);
      rendered += 1;
      continue;
    }

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
    id: crypto.randomUUID(), envelopeId: selectedEnvelopeId, type: 'spend', amount,
    note: els.spendNote.value.trim(), createdAt: Date.now()
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
    id: crypto.randomUUID(), envelopeId: selectedEnvelopeId, type: 'add', amount,
    note: els.spendNote.value.trim(), createdAt: Date.now()
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
  for (const row of rows) row.querySelector('.remove-split').disabled = rows.length <= 2;
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
      id: crypto.randomUUID(), groupId, envelopeId: part.envelopeId, type: 'spend',
      amount: part.amount, note, createdAt: createdAt + index
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
  els.envelopeBudget.value = env ? env.fundingAmount : '';
  els.envelopeFundEveryCycle.checked = env ? Boolean(env.fundEveryCycle) : true;
  els.deleteEnvelopeBtn.classList.toggle('hidden', !env);
  els.envelopeDialog.showModal();
  setTimeout(() => els.envelopeName.focus(), 30);
}

els.envelopeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = els.envelopeName.value.trim();
  const fundingAmount = Number(els.envelopeBudget.value);
  if (!name || !Number.isFinite(fundingAmount) || fundingAmount < 0) return;

  if (editingEnvelopeId) {
    const env = state.envelopes.find(e => e.id === editingEnvelopeId);
    if (!env) return;
    env.name = name;
    env.emoji = els.envelopeEmoji.value.trim() || '💵';
    env.fundingAmount = fundingAmount;
    env.fundEveryCycle = els.envelopeFundEveryCycle.checked;
  } else {
    state.envelopes.push({
      id: crypto.randomUUID(), name, emoji: els.envelopeEmoji.value.trim() || '💵',
      fundingAmount, fundEveryCycle: els.envelopeFundEveryCycle.checked, openingBalance: 0
    });
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
  if (!t || t.cycleId) return;
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

function openCycleDialog() {
  if (!state.nextCycleDate) return;
  const envelopes = state.envelopes.filter(env => env.fundEveryCycle);
  if (!envelopes.length) {
    alert('No envelopes are set to fund every budget cycle. Edit an envelope or add money manually.');
    return;
  }

  els.cycleDialogTitle.textContent = isCycleDue() ? 'New Budget Cycle Ready' : 'Review Budget Cycle';
  els.cycleDialogText.textContent = isCycleDue()
    ? `${formatDateKey(state.nextCycleDate)} is ready. Leftover balances stay in place; confirming only adds this cycle's funding.`
    : `This cycle is scheduled for ${formatDateKey(state.nextCycleDate)}. You can adjust amounts for this cycle without changing the normal defaults.`;
  els.cycleFundingRows.innerHTML = '';

  for (const env of envelopes) {
    const row = document.createElement('label');
    row.className = 'cycle-funding-row';
    row.innerHTML = `
      <span><strong>${escapeHtml(env.emoji || '💵')} ${escapeHtml(env.name)}</strong><small>Current balance: ${money.format(balanceForEnvelope(env))}</small></span>
      <input class="cycle-funding-input" data-envelope-id="${escapeHtml(env.id)}" type="number" inputmode="decimal" min="0" step="0.01" value="${Number(env.fundingAmount || 0).toFixed(2)}" />
    `;
    row.querySelector('input').addEventListener('input', updateCycleDialogTotal);
    els.cycleFundingRows.appendChild(row);
  }
  updateCycleDialogTotal();
  els.cycleDialog.showModal();
}

function updateCycleDialogTotal() {
  const total = [...els.cycleFundingRows.querySelectorAll('.cycle-funding-input')]
    .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
  els.cycleDialogTotal.textContent = money.format(total);
}

els.reviewCycleBtn.addEventListener('click', openCycleDialog);

els.toggleCyclePanelBtn.addEventListener('click', () => {
  setCyclePanelCollapsed(!els.cyclePanel.classList.contains('collapsed'));
});

els.cycleTypeSelect.addEventListener('change', () => {
  els.customCycleDaysWrap.classList.toggle('hidden', els.cycleTypeSelect.value !== 'custom');
});

els.saveCycleDateBtn.addEventListener('click', () => {
  const key = els.cycleDateInput.value;
  const cycleType = els.cycleTypeSelect.value;
  const customDays = Math.round(Number(els.customCycleDaysInput.value));
  if (!parseLocalDate(key)) {
    alert('Choose a valid next budget cycle date.');
    return;
  }
  if (!['weekly', 'biweekly', 'monthly', 'custom'].includes(cycleType)) return;
  if (cycleType === 'custom' && (!Number.isFinite(customDays) || customDays < 1 || customDays > 365)) {
    alert('Custom cycle length must be between 1 and 365 days.');
    return;
  }
  state.cycleType = cycleType;
  state.customCycleDays = cycleType === 'custom' ? customDays : (state.customCycleDays || DEFAULT_CYCLE_DAYS);
  state.nextCycleDate = key;
  state.monthlyAnchorDay = cycleType === 'monthly' ? parseLocalDate(key).getDate() : state.monthlyAnchorDay;
  saveState();
  toast('Budget cycle settings saved');
  render();
});

els.cycleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.nextCycleDate) return;
  const inputs = [...els.cycleFundingRows.querySelectorAll('.cycle-funding-input')];
  const entries = inputs.map(input => ({
    envelopeId: input.dataset.envelopeId,
    amount: Number(input.value)
  }));
  if (entries.some(entry => !Number.isFinite(entry.amount) || entry.amount < 0)) return;

  const cycleId = crypto.randomUUID();
  const cycleDate = state.nextCycleDate;
  const startedAt = Date.now();
  state.currentCycleStartedAt = startedAt;

  entries.filter(entry => entry.amount > 0).forEach((entry, index) => {
    state.transactions.push({
      id: crypto.randomUUID(), envelopeId: entry.envelopeId, type: 'add', amount: entry.amount,
      note: 'Budget cycle funding', cycleId, cycleDate, createdAt: startedAt + index
    });
  });

  state.lastCycleDate = cycleDate;
  state.nextCycleDate = nextCycleDateAfter(cycleDate);
  saveState();
  els.cycleDialog.close();
  toast('New budget cycle started');
  render();
});

els.clearHistoryBtn.addEventListener('click', () => {
  if (!state.transactions.length || !confirm('Clear all activity history? Current envelope balances will be preserved.')) return;
  for (const env of state.envelopes) env.openingBalance = balanceForEnvelope(env);
  state.transactions = [];
  state.currentCycleStartedAt = null;
  saveState();
  toast('Activity cleared; balances preserved');
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
    state = migrateState(parsed);
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

saveState();
render();
