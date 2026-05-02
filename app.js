const STORE_KEY = 'inventory_counter_v1';
const state = loadState();

const tabsScroll = document.getElementById('tabsScroll');
const addTabBtn = document.getElementById('addTabBtn');
const qtyButtons = document.getElementById('qtyButtons');
const itemGrid = document.getElementById('itemGrid');
const countLog = document.getElementById('countLog');
const activeTabTitle = document.getElementById('activeTabTitle');
const searchInput = document.getElementById('searchInput');
const clearSessionBtn = document.getElementById('clearSessionBtn');
const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
const installBtn = document.getElementById('installBtn');

let deferredInstallPrompt = null;

const presetQuantities = [1, 5, 10, 25, 50];

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) return JSON.parse(raw);
  return { tabs: [], items: [], counts: {}, activeTabId: null, selectedQty: 1, search: '' };
}

function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function uid() { return crypto.randomUUID(); }

function render() {
  renderTabs(); renderQty(); renderGrid(); renderLog();
  searchInput.value = state.search || '';
  saveState();
}

function renderTabs() {
  tabsScroll.innerHTML = '';
  state.tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `tab ${tab.id === state.activeTabId ? 'active' : ''}`;
    btn.textContent = `${tab.icon || '📁'} ${tab.name}`;
    btn.onclick = () => { state.activeTabId = tab.id; render(); };
    btn.oncontextmenu = (e) => { e.preventDefault(); openTabMenu(tab); };
    tabsScroll.appendChild(btn);
  });
  if (!state.activeTabId && state.tabs[0]) state.activeTabId = state.tabs[0].id;
}

function renderQty() {
  qtyButtons.innerHTML = '';
  [...presetQuantities, '+'].forEach(q => {
    const btn = document.createElement('button');
    btn.className = `qty-btn ${q === state.selectedQty ? 'active' : ''}`;
    btn.textContent = q;
    btn.onclick = () => q === '+' ? setCustomQty() : (state.selectedQty = q, render());
    qtyButtons.appendChild(btn);
  });
}

function renderGrid() {
  itemGrid.innerHTML = '';
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  activeTabTitle.textContent = tab ? tab.name : 'No tabs yet';
  if (!tab) return;

  const addTile = document.createElement('button');
  addTile.className = 'tile add-item';
  addTile.textContent = '+ Add Item';
  addTile.onclick = () => openItemForm();
  itemGrid.appendChild(addTile);

  const filtered = state.items.filter(i => i.tabId === tab.id && i.name.toLowerCase().includes((state.search || '').toLowerCase()));
  filtered.forEach(item => {
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.innerHTML = `<div class="icon">${item.icon || '📦'}</div><div>${item.name}</div>`;
    tile.onclick = () => addCount(item.id, state.selectedQty);
    tile.oncontextmenu = (e) => { e.preventDefault(); openItemMenu(item); };
    itemGrid.appendChild(tile);
  });
}

function renderLog() {
  countLog.innerHTML = '';
  state.tabs.forEach(tab => {
    const entries = state.items
      .filter(i => i.tabId === tab.id && state.counts[i.id] > 0)
      .map(i => ({ ...i, count: state.counts[i.id] }));
    if (!entries.length) return;
    const group = document.createElement('div'); group.className = 'group';
    group.innerHTML = `<h4>${tab.name}</h4>`;
    entries.forEach(entry => {
      const row = document.createElement('div'); row.className = 'log-row';
      row.innerHTML = `<span>${entry.name}</span>`;
      const dec = document.createElement('button'); dec.className = 'count-btn'; dec.textContent = '−'; dec.onclick = () => addCount(entry.id, -1);
      const value = document.createElement('span'); value.className = 'count-value'; value.textContent = entry.count; value.onclick = () => setManualCount(entry.id, entry.count);
      const inc = document.createElement('button'); inc.className = 'count-btn'; inc.textContent = '+'; inc.onclick = () => addCount(entry.id, 1);
      row.append(dec, value, inc);
      group.appendChild(row);
    });
    countLog.appendChild(group);
  });
}

function addCount(itemId, qty) {
  state.counts[itemId] = Math.max(0, (state.counts[itemId] || 0) + qty);
  render();
}

function setCustomQty() {
  const val = Number(prompt('Enter quantity increment')); if (!val || val < 1) return;
  state.selectedQty = Math.floor(val); render();
}

function setManualCount(itemId, current) {
  const val = Number(prompt('Set count', current));
  if (Number.isNaN(val) || val < 0) return;
  state.counts[itemId] = Math.floor(val); render();
}

function openTabMenu(tab) {
  const action = prompt(`Tab: ${tab.name}\nType: rename / delete`);
  if (action === 'rename') {
    const name = prompt('New tab name', tab.name); if (!name) return;
    tab.name = name; render();
  } else if (action === 'delete') {
    const destination = state.tabs.filter(t => t.id !== tab.id);
    if (destination.length) {
      const move = confirm('Move items to first remaining tab? Cancel = delete items');
      if (move) {
        state.items.filter(i => i.tabId === tab.id).forEach(i => i.tabId = destination[0].id);
      } else {
        state.items.filter(i => i.tabId === tab.id).forEach(i => delete state.counts[i.id]);
        state.items = state.items.filter(i => i.tabId !== tab.id);
      }
    }
    state.tabs = state.tabs.filter(t => t.id !== tab.id);
    if (state.activeTabId === tab.id) state.activeTabId = state.tabs[0]?.id || null;
    render();
  }
}

function openItemMenu(item) {
  const action = prompt(`Item: ${item.name}\nType: edit / move / delete`);
  if (action === 'edit') {
    const name = prompt('Item name', item.name); if (name) item.name = name;
    const icon = prompt('Item icon (emoji optional)', item.icon || ''); item.icon = icon || '';
    render();
  } else if (action === 'move') {
    const names = state.tabs.map(t => t.name).join(', ');
    const target = prompt(`Move to which tab? ${names}`);
    const tab = state.tabs.find(t => t.name.toLowerCase() === (target || '').toLowerCase());
    if (tab) item.tabId = tab.id;
    render();
  } else if (action === 'delete') {
    state.items = state.items.filter(i => i.id !== item.id);
    delete state.counts[item.id];
    render();
  }
}

function openTabForm() {
  modalForm.innerHTML = `
    <h3>Add Tab</h3>
    <input name="name" placeholder="Tab name" required />
    <input name="icon" placeholder="Icon (optional)" />
    <div class="modal-actions"><button class="btn btn-ghost" value="cancel">Cancel</button><button class="btn btn-add" value="default">Save</button></div>
  `;
  modal.showModal();
  modalForm.onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(modalForm);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const tab = { id: uid(), name, icon: String(form.get('icon') || '').trim() };
    state.tabs.push(tab); state.activeTabId = tab.id;
    modal.close(); render();
  };
}

function openItemForm() {
  if (!state.activeTabId) return;
  modalForm.innerHTML = `
    <h3>Add Item</h3>
    <input name="name" placeholder="Item name" required />
    <input name="icon" placeholder="Icon (optional)" />
    <div class="modal-actions"><button class="btn btn-ghost" value="cancel">Cancel</button><button class="btn btn-add" value="default">Save</button></div>
  `;
  modal.showModal();
  modalForm.onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(modalForm);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    state.items.push({ id: uid(), name, icon: String(form.get('icon') || '').trim(), tabId: state.activeTabId });
    modal.close(); render();
  };
}

addTabBtn.onclick = openTabForm;
clearSessionBtn.onclick = () => { if (confirm('Clear all counts?')) { state.counts = {}; render(); } };
searchInput.oninput = (e) => { state.search = e.target.value; renderGrid(); saveState(); };

render();


window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.hidden = false;
});

installBtn.onclick = async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
};

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
