let allCards = [];      // flat list of every card with metadata
let activePool = [];    // indices into allCards currently in rotation
let currentIdx = null;  // index in allCards for card on screen
let isFlipped = false;

// Per-card state: consecutive correct streak
const streaks = {};     // cardId -> number (0–10)
const learnt  = new Set();

async function loadData() {
  const res = await fetch('data/flashcards.json');
  const data = await res.json();

  // Flatten all categories into one list, tagging each card with its type
  data.nouns.forEach(c      => allCards.push({ ...c, type: 'noun' }));
  data.pronouns.forEach(c   => allCards.push({ ...c, type: 'pronoun' }));
  data.verbs.forEach(c      => allCards.push({ ...c, type: 'verb' }));
  data.adjectives.forEach(c => allCards.push({ ...c, type: 'adjective' }));
  data.phrases.forEach(c    => allCards.push({ ...c, type: 'phrase' }));

  allCards.forEach((_, i) => { streaks[i] = 0; });

  const total = allCards.length;
  document.getElementById('total-count').textContent = total;
  document.getElementById('comp-total').textContent  = total;

  activePool = shuffle([...allCards.keys()]);
  nextCard();
}

// ── Card rendering ────────────────────────────────────────────────

function nextCard() {
  if (activePool.length === 0) {
    showCompletion();
    return;
  }

  // Pick a random card from the pool
  const poolPos = Math.floor(Math.random() * activePool.length);
  currentIdx = activePool[poolPos];

  isFlipped = false;
  const cardEl = document.getElementById('card');
  cardEl.style.transition = 'none';
  cardEl.classList.remove('flipped');
  cardEl.offsetHeight; // force reflow so the snap is immediate
  cardEl.style.transition = '';
  document.getElementById('answer-btns').classList.add('hidden');
  document.getElementById('flip-hint-bar').classList.remove('hidden');

  renderFront(allCards[currentIdx]);
  renderBack(allCards[currentIdx]);
  updateStreakDots(currentIdx);
}

function renderFront(card) {
  const front = document.getElementById('card-front');
  const typeLabel = card.type === 'verb'
    ? `Verb · ${subtypeLabel(card.subtype)}`
    : typeToLabel(card.type);
  front.innerHTML = `
    <span class="card-type-badge">${typeLabel}</span>
    <span class="card-label">English</span>
    <span class="card-main">${card.english}</span>
    <div class="streak-dots" id="streak-dots"></div>`;
  // Tall card for verbs (more content on back)
  document.getElementById('card-scene').classList.toggle('tall', card.type === 'verb');
  renderStreakDots();
}

function renderBack(card) {
  const back = document.getElementById('card-back');
  if (card.type === 'noun') {
    const g = card.gender.toLowerCase();
    back.innerHTML = `
      <span class="card-label">German</span>
      <span class="card-main">${card.german}</span>
      <span class="gender-badge ${g}">${card.gender}</span>`;
  } else if (card.type === 'pronoun') {
    back.innerHTML = `
      <span class="card-label">German Cases</span>
      <div class="pronoun-grid">
        <div class="pronoun-cell"><div class="p-label">Nominativ</div><div class="p-val">${card.nominativ}</div></div>
        <div class="pronoun-cell"><div class="p-label">Akkusativ</div><div class="p-val">${card.akkusativ}</div></div>
        <div class="pronoun-cell"><div class="p-label">Dativ</div><div class="p-val">${card.dativ}</div></div>
      </div>`;
  } else if (card.type === 'verb') {
    back.innerHTML = `
      <span class="verb-subtype ${card.subtype}">${subtypeLabel(card.subtype)}</span>
      <table class="verb-table">
        <thead><tr><th>Pronoun</th><th>Form</th><th>Pronoun</th><th>Form</th></tr></thead>
        <tbody>
          <tr><td>ich</td><td>${card.ich}</td><td>wir</td><td>${card.wir}</td></tr>
          <tr><td>du</td><td>${card.du}</td><td>ihr</td><td>${card.ihr}</td></tr>
          <tr><td>er/sie/es</td><td>${card.er}</td><td>sie/Sie</td><td>${card.sie}</td></tr>
          <tr><td>Präteritum</td><td>${card.praeteritum}</td><td>Perfekt</td><td>${card.perfekt}</td></tr>
        </tbody>
      </table>`;
  } else {
    back.innerHTML = `
      <span class="card-label">German</span>
      <span class="card-main">${card.german}</span>`;
  }
}

function renderStreakDots() {
  const container = document.getElementById('streak-dots');
  if (!container) return;
  const streak = streaks[currentIdx] || 0;
  container.innerHTML = Array.from({ length: 10 }, (_, i) =>
    `<div class="streak-dot ${i < streak ? 'filled' : ''}"></div>`
  ).join('');
}

function updateStreakDots(idx) {
  const container = document.getElementById('streak-dots');
  if (!container) return;
  const streak = streaks[idx] || 0;
  container.querySelectorAll('.streak-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < streak);
  });
}

// ── Flip ─────────────────────────────────────────────────────────

function flipCard() {
  if (isFlipped) return;
  isFlipped = true;
  document.getElementById('card').classList.add('flipped');
  document.getElementById('answer-btns').classList.remove('hidden');
  document.getElementById('flip-hint-bar').classList.add('hidden');
}

// ── Answer ────────────────────────────────────────────────────────

function answer(correct) {
  if (!isFlipped) return;

  if (correct) {
    streaks[currentIdx] = (streaks[currentIdx] || 0) + 1;
    if (streaks[currentIdx] >= 10) {
      retireCard(currentIdx);
    }
  } else {
    streaks[currentIdx] = 0;
  }

  updateProgress();
  nextCard();
}

function retireCard(idx) {
  learnt.add(idx);
  activePool = activePool.filter(i => i !== idx);
  document.getElementById('learnt-count').textContent = learnt.size;
}

// ── Progress ──────────────────────────────────────────────────────

function updateProgress() {
  const pct = allCards.length ? (learnt.size / allCards.length) * 100 : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
}

// ── Completion ────────────────────────────────────────────────────

function showCompletion() {
  document.getElementById('completion').classList.remove('hidden');
}

function restart() {
  learnt.clear();
  allCards.forEach((_, i) => { streaks[i] = 0; });
  activePool = shuffle([...allCards.keys()]);
  document.getElementById('learnt-count').textContent = 0;
  document.getElementById('completion').classList.add('hidden');
  updateProgress();
  nextCard();
}

// ── Utils ─────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function typeToLabel(type) {
  return { noun: 'Noun', pronoun: 'Pronoun', verb: 'Verb', adjective: 'Adjective', phrase: 'Phrase' }[type] || type;
}

function subtypeLabel(subtype) {
  return { regular: 'Regular', strong: 'Strong / Irregular', separable: 'Separable', reflexive: 'Reflexive', modal: 'Modal' }[subtype] || subtype;
}

// ── Events ────────────────────────────────────────────────────────

document.getElementById('card-scene').addEventListener('click', flipCard);
document.getElementById('btn-correct').addEventListener('click', e => { e.stopPropagation(); answer(true); });
document.getElementById('btn-wrong').addEventListener('click',   e => { e.stopPropagation(); answer(false); });
document.getElementById('btn-restart').addEventListener('click', restart);

document.addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
  if (e.key === 'c' || e.key === 'C') answer(true);
  if (e.key === 'w' || e.key === 'W') answer(false);
});

loadData();
