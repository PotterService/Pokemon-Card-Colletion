const API_BASE = 'https://api.tcgdex.net/v2/en';
const CACHE_TTL = 60 * 60 * 1000;

let allSets = [];
let currentSet = null;
let currentCards = [];
let collection = [];
let wishlist = [];
let currentModalCard = null;

const pageMeta = {
  dashboard: ['Welcome back', 'Collection Dashboard'],
  sets: ['TCGdex card database', 'Browse Pokémon Sets'],
  setDetail: ['Set checklist', 'Pokémon Set'],
  collection: ['Cards you own', 'My Collection'],
  wishlist: ['Cards you are hunting', 'Wishlist'],
  scanner: ['Future feature', 'Pokémon Card Scanner'],
  settings: ['Local browser storage', 'Settings']
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await BowDB.open();
  await refreshLocalData();
  bindNavigation();
  bindControls();
  renderDashboard();
  loadSets();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
}

async function refreshLocalData() {
  collection = await BowDB.getAll('collection');
  wishlist = await BowDB.getAll('wishlist');
}

function bindNavigation() {
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.page));
  });
  document.querySelectorAll('[data-go]').forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.go));
  });
  document.getElementById('browseSetsButton').addEventListener('click', () => showPage('sets'));
  document.getElementById('backToSets').addEventListener('click', () => showPage('sets'));
  document.getElementById('menuButton').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
}

function bindControls() {
  document.getElementById('setSearch').addEventListener('input', renderSets);
  document.getElementById('seriesFilter').addEventListener('change', renderSets);
  document.getElementById('setSort').addEventListener('change', renderSets);
  document.getElementById('cardSearch').addEventListener('input', renderCurrentSetCards);
  document.getElementById('ownedFilter').addEventListener('change', renderCurrentSetCards);
  document.getElementById('cardSort').addEventListener('change', renderCurrentSetCards);
  document.getElementById('collectionSearch').addEventListener('input', renderCollection);
  document.getElementById('collectionSetFilter').addEventListener('change', renderCollection);
  document.getElementById('collectionTradeFilter').addEventListener('change', renderCollection);
  document.getElementById('wishlistSearch').addEventListener('input', renderWishlist);

  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal()));
  document.getElementById('ownedModal').addEventListener('click', event => {
    if (event.target.id === 'ownedModal') closeModal();
  });

  document.getElementById('ownedForm').addEventListener('submit', saveOwnedCard);
  document.getElementById('removeOwnedButton').addEventListener('click', removeOwnedCard);
  document.getElementById('wishlistButton').addEventListener('click', toggleWishlistFromModal);
  document.getElementById('exportBackupButton').addEventListener('click', exportBackup);
  document.getElementById('importBackupInput').addEventListener('change', importBackup);
  document.getElementById('exportCsvButton').addEventListener('click', exportCsv);
  document.getElementById('clearCacheButton').addEventListener('click', clearCache);
  document.getElementById('resetCollectionButton').addEventListener('click', resetCollection);
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`${page}Page`);
  if (target) target.classList.add('active');
  const nav = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  const [eyebrow, title] = pageMeta[page] || ['', 'Bow Pokémon'];
  document.getElementById('pageEyebrow').textContent = eyebrow;
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('browseSetsButton').style.display = ['dashboard','collection','wishlist'].includes(page) ? '' : 'none';
  document.getElementById('sidebar').classList.remove('open');

  if (page === 'dashboard') renderDashboard();
  if (page === 'collection') renderCollection();
  if (page === 'wishlist') renderWishlist();
  if (page === 'sets') renderSets();
  window.scrollTo({top:0, behavior:'smooth'});
}

async function fetchJson(url, cacheKey, ttl = CACHE_TTL) {
  const cached = await BowDB.cacheGet(cacheKey, ttl);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TCGdex request failed (${response.status})`);
  const data = await response.json();
  await BowDB.cachePut(cacheKey, data);
  return data;
}

async function loadSets() {
  const status = document.getElementById('setsStatus');
  try {
    allSets = await fetchJson(`${API_BASE}/sets`, 'all_sets', 12 * CACHE_TTL);
    populateSeries();
    renderSets();
  } catch (error) {
    status.className = 'notice error';
    status.textContent = error.message;
  }
}

function populateSeries() {
  const series = [...new Set(allSets.map(s => s.serie?.name || '').filter(Boolean))].sort();
  const select = document.getElementById('seriesFilter');
  select.innerHTML = '<option value="">All Series</option>' +
    series.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
}

function renderSets() {
  if (!allSets.length) return;
  const q = document.getElementById('setSearch').value.trim().toLowerCase();
  const serie = document.getElementById('seriesFilter').value;
  const sort = document.getElementById('setSort').value;

  let sets = allSets.filter(set => {
    const seriesName = set.serie?.name || '';
    return (!q || `${set.name || ''} ${seriesName}`.toLowerCase().includes(q))
      && (!serie || seriesName === serie);
  });

  sets.sort((a,b) => {
    if (sort === 'name') return String(a.name).localeCompare(String(b.name));
    const da = new Date(a.releaseDate || 0), db = new Date(b.releaseDate || 0);
    return sort === 'oldest' ? da-db : db-da;
  });

  document.getElementById('setsStatus').className = 'result-count';
  document.getElementById('setsStatus').textContent = `${sets.length} sets found`;
  document.getElementById('setsGrid').innerHTML = sets.map(set => {
    const logo = setImage(set.logo);
    const symbol = setImage(set.symbol);
    const total = set.cardCount?.total ?? set.cardCount?.official ?? '?';
    const owned = collection.filter(c => c.set_id === set.id).length;
    return `<button class="set-card" data-set-id="${escapeHtml(set.id)}">
      <div class="set-logo-area">
        ${logo ? `<img class="set-logo" src="${escapeHtml(logo)}" alt="" loading="lazy">` : `<div class="set-logo-placeholder">${escapeHtml((set.name||'?').charAt(0))}</div>`}
        ${symbol ? `<img class="set-symbol" src="${escapeHtml(symbol)}" alt="">` : ''}
      </div>
      <div class="set-card-body">
        <small>${escapeHtml(set.serie?.name || 'Pokémon TCG')}</small>
        <h2>${escapeHtml(set.name || set.id)}</h2>
        <p>${escapeHtml(set.releaseDate || 'Release date unavailable')}</p>
        <div><strong>${owned}</strong><span> owned of ${escapeHtml(total)}</span></div>
      </div>
    </button>`;
  }).join('');

  document.querySelectorAll('[data-set-id]').forEach(button => {
    button.addEventListener('click', () => openSet(button.dataset.setId));
  });
}

async function openSet(setId) {
  showPage('setDetail');
  document.getElementById('pageTitle').textContent = 'Loading Set…';
  const status = document.getElementById('cardsStatus');
  status.className = 'loading';
  status.textContent = 'Loading cards from TCGdex…';
  try {
    currentSet = await fetchJson(`${API_BASE}/sets/${encodeURIComponent(setId)}`, `set_${setId}`, 6 * CACHE_TTL);
    currentCards = currentSet.cards || [];
    document.getElementById('pageTitle').textContent = currentSet.name || 'Pokémon Set';
    renderSetHero();
    renderCurrentSetCards();
  } catch (error) {
    status.className = 'notice error';
    status.textContent = error.message;
  }
}

function renderSetHero() {
  const total = currentSet.cardCount?.total ?? currentCards.length;
  const ownedCount = collection.filter(c => c.set_id === currentSet.id).length;
  const percent = total ? Math.min(100, Math.round(ownedCount/total*100)) : 0;
  const logo = setImage(currentSet.logo);
  const symbol = setImage(currentSet.symbol);
  const hero = document.getElementById('setHero');
  hero.classList.remove('skeleton');
  hero.innerHTML = `<div class="set-identity">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ''}
    <div><p class="eyebrow">${escapeHtml(currentSet.serie?.name || 'Pokémon Set')}</p>
    <h2>${escapeHtml(currentSet.name || '')}</h2><p>Released ${escapeHtml(currentSet.releaseDate || 'date unavailable')}</p></div>
    ${symbol ? `<img class="hero-symbol" src="${escapeHtml(symbol)}" alt="">` : ''}
  </div>
  <div class="set-progress"><div><strong>${ownedCount}</strong><span> of ${escapeHtml(total)} unique cards owned</span></div>
  <div class="progress-track"><i style="width:${percent}%"></i></div><small>${percent}% complete</small></div>`;
}

function renderCurrentSetCards() {
  if (!currentSet) return;
  const q = document.getElementById('cardSearch').value.trim().toLowerCase();
  const filter = document.getElementById('ownedFilter').value;
  const sort = document.getElementById('cardSort').value;
  let cards = currentCards.filter(card => {
    const owned = collection.some(c => c.card_id === card.id);
    return (!q || `${card.name||''} ${card.localId||''}`.toLowerCase().includes(q))
      && (!filter || (filter === 'owned' && owned) || (filter === 'missing' && !owned));
  });
  cards.sort((a,b) => sort === 'name' ? String(a.name).localeCompare(String(b.name)) : cardNumber(a.localId)-cardNumber(b.localId));
  document.getElementById('cardsStatus').className = 'result-count';
  document.getElementById('cardsStatus').textContent = `${cards.length} cards shown`;
  document.getElementById('cardsGrid').innerHTML = cards.map(card => cardTile(card)).join('');
  bindCardButtons();
}

function cardTile(card, localRecord = null) {
  const owned = localRecord || collection.find(c => c.card_id === card.id);
  const image = owned?.image_url || cardImage(card, 'low');
  const quantity = owned?.quantity || 0;
  return `<article class="pokemon-card ${owned ? 'is-owned' : ''}">
    <button class="card-open" data-card-id="${escapeHtml(card.id)}">
      <div class="card-image-wrap">
        ${owned ? '<span class="owned-chip">✓ Owned</span>' : ''}
        ${owned?.favorite ? '<span class="favorite-chip">♥</span>' : ''}
        ${quantity > 1 ? `<span class="quantity-chip">×${quantity}</span>` : ''}
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(card.name||owned?.card_name||'')}" loading="lazy">` : '<div class="image-placeholder">?</div>'}
      </div>
      <div class="pokemon-card-body">
        <small>#${escapeHtml(card.localId || owned?.local_id || '')}</small>
        <h3>${escapeHtml(card.name || owned?.card_name || 'Unknown Card')}</h3>
        <p>${escapeHtml(card.rarity || owned?.condition_name || '')}</p>
        <span class="mark-button">${owned ? 'Update Details' : '+ Mark as Owned'}</span>
      </div>
    </button>
  </article>`;
}

function bindCardButtons() {
  document.querySelectorAll('.card-open').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset.cardId;
      let card = currentCards.find(c => c.id === id);
      if (!card) {
        const owned = collection.find(c => c.card_id === id);
        try { card = await fetchJson(`${API_BASE}/cards/${encodeURIComponent(id)}`, `card_${id}`); }
        catch { card = { id, name: owned?.card_name, localId: owned?.local_id, image: owned?.image_url?.replace(/\/(low|high)\.webp$/,'') }; }
      }
      openOwnedModal(card);
    });
  });
}

function openOwnedModal(card) {
  currentModalCard = card;
  const owned = collection.find(c => c.card_id === card.id);
  const wished = wishlist.find(c => c.card_id === card.id);
  const image = owned?.image_url || cardImage(card, 'high');
  const setId = currentSet?.id || owned?.set_id || card.set?.id || '';
  const setName = currentSet?.name || card.set?.name || setId;

  document.getElementById('modalCardImage').src = image;
  document.getElementById('modalCardName').textContent = card.name || owned?.card_name || 'Unknown Card';
  document.getElementById('modalCardMeta').textContent = `${setName} · #${card.localId || owned?.local_id || ''}`;
  document.getElementById('modalCardId').value = card.id;
  document.getElementById('modalSetId').value = setId;
  document.getElementById('modalLocalId').value = card.localId || owned?.local_id || '';
  document.getElementById('modalImageUrl').value = image;
  document.getElementById('normalQuantity').value = owned?.normal_quantity ?? 1;
  document.getElementById('reverseQuantity').value = owned?.reverse_quantity ?? 0;
  document.getElementById('holoQuantity').value = owned?.holo_quantity ?? 0;
  document.getElementById('conditionName').value = owned?.condition_name || 'Near Mint';
  document.getElementById('purchasePrice').value = owned?.purchase_price || 0;
  document.getElementById('estimatedValue').value = owned?.estimated_value || 0;
  document.getElementById('favorite').checked = Boolean(owned?.favorite);
  document.getElementById('forTrade').checked = Boolean(owned?.for_trade);
  document.getElementById('cardNotes').value = owned?.notes || '';
  document.getElementById('removeOwnedButton').style.display = owned ? '' : 'none';
  document.getElementById('wishlistButton').textContent = wished ? 'Remove from Wishlist' : 'Add to Wishlist';
  document.getElementById('ownedModal').classList.add('open');
}

function closeModal() {
  document.getElementById('ownedModal').classList.remove('open');
  currentModalCard = null;
}

async function saveOwnedCard(event) {
  event.preventDefault();
  const normal = Number(document.getElementById('normalQuantity').value || 0);
  const reverse = Number(document.getElementById('reverseQuantity').value || 0);
  const holo = Number(document.getElementById('holoQuantity').value || 0);
  if (normal + reverse + holo < 1) return alert('Enter at least one owned copy.');

  const record = {
    card_id: document.getElementById('modalCardId').value,
    set_id: document.getElementById('modalSetId').value,
    card_name: document.getElementById('modalCardName').textContent,
    local_id: document.getElementById('modalLocalId').value,
    image_url: document.getElementById('modalImageUrl').value,
    quantity: normal + reverse + holo,
    normal_quantity: normal,
    reverse_quantity: reverse,
    holo_quantity: holo,
    condition_name: document.getElementById('conditionName').value,
    purchase_price: Number(document.getElementById('purchasePrice').value || 0),
    estimated_value: Number(document.getElementById('estimatedValue').value || 0),
    favorite: document.getElementById('favorite').checked,
    for_trade: document.getElementById('forTrade').checked,
    notes: document.getElementById('cardNotes').value,
    updated_at: new Date().toISOString()
  };
  await BowDB.put('collection', record);
  await refreshLocalData();
  closeModal();
  refreshVisibleViews();
  showToast('Card saved to your collection');
}

async function removeOwnedCard() {
  const id = document.getElementById('modalCardId').value;
  if (!confirm('Remove this card from your collection?')) return;
  await BowDB.remove('collection', id);
  await refreshLocalData();
  closeModal();
  refreshVisibleViews();
  showToast('Card removed');
}

async function toggleWishlistFromModal() {
  const id = document.getElementById('modalCardId').value;
  const existing = wishlist.find(w => w.card_id === id);
  if (existing) {
    await BowDB.remove('wishlist', id);
    showToast('Removed from wishlist');
  } else {
    await BowDB.put('wishlist', {
      card_id: id,
      set_id: document.getElementById('modalSetId').value,
      card_name: document.getElementById('modalCardName').textContent,
      local_id: document.getElementById('modalLocalId').value,
      image_url: document.getElementById('modalImageUrl').value,
      target_price: 0,
      notes: '',
      created_at: new Date().toISOString()
    });
    showToast('Added to wishlist');
  }
  await refreshLocalData();
  document.getElementById('wishlistButton').textContent = existing ? 'Add to Wishlist' : 'Remove from Wishlist';
  renderWishlist();
  renderDashboard();
}

function refreshVisibleViews() {
  renderDashboard();
  renderCollection();
  renderWishlist();
  renderSets();
  if (currentSet) {
    renderSetHero();
    renderCurrentSetCards();
  }
}

function renderDashboard() {
  const total = collection.reduce((s,c) => s + Number(c.quantity||0), 0);
  const value = collection.reduce((s,c) => s + Number(c.estimated_value||0)*Number(c.quantity||0), 0);
  const sets = new Set(collection.map(c => c.set_id));
  document.getElementById('totalCardsStat').textContent = total;
  document.getElementById('uniqueCardsStat').textContent = collection.length;
  document.getElementById('setsStartedStat').textContent = sets.size;
  document.getElementById('estimatedValueStat').textContent = money(value);
  document.getElementById('wishlistStat').textContent = wishlist.length;

  const recent = [...collection].sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,6);
  document.getElementById('recentCards').innerHTML = recent.length ? recent.map(card => `
    <button class="recent-row card-open" data-card-id="${escapeHtml(card.card_id)}">
      <img src="${escapeHtml(card.image_url)}" alt="">
      <div><strong>${escapeHtml(card.card_name)}</strong><small>${escapeHtml(card.set_id)} · #${escapeHtml(card.local_id)}</small></div>
      <b>×${card.quantity}</b>
    </button>`).join('') : empty('No cards added yet. Browse a set to begin.');

  const grouped = {};
  collection.forEach(card => {
    grouped[card.set_id] ||= {unique:0,total:0};
    grouped[card.set_id].unique++;
    grouped[card.set_id].total += Number(card.quantity||0);
  });
  document.getElementById('setProgressList').innerHTML = Object.entries(grouped).length ? Object.entries(grouped).slice(0,8).map(([id,data]) => `
    <button class="progress-row" data-open-set="${escapeHtml(id)}">
      <div><strong>${escapeHtml(id)}</strong><small>${data.unique} unique · ${data.total} total</small></div><span>Open →</span>
    </button>`).join('') : empty('Set progress appears after you add cards.');

  bindCardButtons();
  document.querySelectorAll('[data-open-set]').forEach(b => b.addEventListener('click', () => openSet(b.dataset.openSet)));
}

function renderCollection() {
  const q = document.getElementById('collectionSearch').value.trim().toLowerCase();
  const setFilter = document.getElementById('collectionSetFilter').value;
  const flag = document.getElementById('collectionTradeFilter').value;
  const sets = [...new Set(collection.map(c => c.set_id))].sort();
  const select = document.getElementById('collectionSetFilter');
  const current = select.value;
  select.innerHTML = '<option value="">All Sets</option>' + sets.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if (sets.includes(current)) select.value = current;

  const filtered = collection.filter(c => (!q || `${c.card_name} ${c.set_id} ${c.local_id}`.toLowerCase().includes(q))
    && (!setFilter || c.set_id === setFilter)
    && (!flag || (flag === 'trade' && c.for_trade) || (flag === 'favorite' && c.favorite)));

  document.getElementById('collectionStatus').textContent = `${filtered.length} unique cards · ${filtered.reduce((s,c)=>s+Number(c.quantity||0),0)} total cards`;
  document.getElementById('collectionGrid').innerHTML = filtered.length ? filtered.map(c => cardTile({
    id:c.card_id,name:c.card_name,localId:c.local_id,image:c.image_url?.replace(/\/(low|high)\.webp$/,'')
  }, c)).join('') : empty('No cards match your collection filters.');
  bindCardButtons();
}

function renderWishlist() {
  const q = document.getElementById('wishlistSearch').value.trim().toLowerCase();
  const filtered = wishlist.filter(c => !q || `${c.card_name} ${c.set_id} ${c.local_id}`.toLowerCase().includes(q));
  document.getElementById('wishlistGrid').innerHTML = filtered.length ? filtered.map(c => `
    <article class="pokemon-card">
      <button class="card-open" data-card-id="${escapeHtml(c.card_id)}">
        <div class="card-image-wrap"><img src="${escapeHtml(c.image_url)}" alt="${escapeHtml(c.card_name)}"></div>
        <div class="pokemon-card-body"><small>${escapeHtml(c.set_id)} · #${escapeHtml(c.local_id)}</small>
        <h3>${escapeHtml(c.card_name)}</h3><p>Wishlist</p><span class="mark-button">View Card</span></div>
      </button>
    </article>`).join('') : empty('Your wishlist is empty.');
  bindCardButtons();
}

async function exportBackup() {
  const data = {
    app: 'Bow Pokémon Collection Manager',
    version: 4,
    exported_at: new Date().toISOString(),
    collection,
    wishlist
  };
  download(JSON.stringify(data,null,2), `bow-pokemon-backup-${dateStamp()}.json`, 'application/json');
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.collection) || !Array.isArray(data.wishlist)) throw new Error('Invalid backup file.');
    await BowDB.clear('collection');
    await BowDB.clear('wishlist');
    for (const card of data.collection) await BowDB.put('collection', card);
    for (const card of data.wishlist) await BowDB.put('wishlist', card);
    await refreshLocalData();
    refreshVisibleViews();
    showToast('Backup imported successfully');
  } catch (error) {
    alert(error.message);
  }
  event.target.value = '';
}

function exportCsv() {
  const headers = ['Card ID','Name','Set','Card Number','Quantity','Normal','Reverse Holo','Holo/Special','Condition','Purchase Price','Estimated Value','Favorite','For Trade','Notes'];
  const rows = collection.map(c => [c.card_id,c.card_name,c.set_id,c.local_id,c.quantity,c.normal_quantity,c.reverse_quantity,c.holo_quantity,c.condition_name,c.purchase_price,c.estimated_value,c.favorite?'Yes':'No',c.for_trade?'Yes':'No',c.notes]);
  const csv = [headers,...rows].map(row => row.map(v => `"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
  download(csv, `bow-pokemon-collection-${dateStamp()}.csv`, 'text/csv');
}

async function clearCache() {
  await BowDB.clear('cache');
  allSets = [];
  currentSet = null;
  currentCards = [];
  document.getElementById('setsStatus').textContent = 'Cache cleared. Reloading sets…';
  await loadSets();
  showToast('Card cache cleared');
}

async function resetCollection() {
  if (!confirm('Erase the collection and wishlist saved in this browser? This cannot be undone.')) return;
  await BowDB.clear('collection');
  await BowDB.clear('wishlist');
  await refreshLocalData();
  refreshVisibleViews();
  showToast('Local collection erased');
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

function cardImage(card, quality='low') {
  if (!card?.image) return '';
  if (/\.(png|jpe?g|webp)$/i.test(card.image)) return card.image;
  return `${card.image}/${quality}.webp`;
}
function setImage(value) {
  if (!value) return '';
  if (/\.(png|jpe?g|webp)$/i.test(value)) return value;
  return `${value}.webp`;
}
function cardNumber(value='') { const m=String(value).match(/\d+/); return m?Number(m[0]):99999; }
function money(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0)); }
function escapeHtml(v='') { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function empty(text) { return `<div class="empty large">${escapeHtml(text)}</div>`; }
function dateStamp() { return new Date().toISOString().slice(0,10); }
function showToast(message) {
  const toast=document.getElementById('toast'); toast.textContent=message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('show'),2200);
}
