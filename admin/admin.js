// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://akuvykkoonkvdnumbatd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdXZ5a2tvb25rdmRudW1iYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODMzMDEsImV4cCI6MjA5NTU1OTMwMX0.SBOTW1ozBT16gZvOKvgE-VadENq9pTjzIU3JRAWJ0Xs';
const ADMIN_PASSWORD    = 'teacher2025';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Vote metadata (mirrors voteQs in app.js) ────────────────────────────────
const VOTE_META = [
  { q: 'Gender stereotypes today vs 30 years ago?',
    opts: ['Still just as bad', 'Things have improved'] },
  { q: 'Pushed into something because of gender?',
    opts: ['Yes, definitely', 'No, not really'] },
  { q: 'Which affects children the most?',
    opts: ['Toys & marketing', 'Movies & TV', 'What parents say', 'Social peer pressure'] },
  { q: 'Modern Disney — genuine change?',
    opts: ['Yes, real progress', 'Not really / too slow'] },
  { q: 'Aware of stereotypes as a child?',
    opts: ['Aware as a kid', 'Only realised later'] },
  { q: 'Who is more affected by stereotypes in childhood?',
    opts: ['Boys more', 'Girls more', 'Both equally', 'Depends on family'] },
];

const QUIZ_TYPES = [
  { key: 'Freethinker', icon: '🌱', color: '#34D399' },
  { key: 'Classic',     icon: '🏛️',  color: '#60A5FA' },
  { key: 'Rebel',       icon: '🔥', color: '#FCD34D' },
  { key: 'Unaware',     icon: '👁️',  color: '#A78BFA' },
];

// ── State ───────────────────────────────────────────────────────────────────
let voteCounts  = {};                         // { qi: { choice: count } }
let quizCounts  = { Freethinker:0, Classic:0, Rebel:0, Unaware:0 };
let lbRows      = [];

// ── Auth ────────────────────────────────────────────────────────────────────
function checkPassword() {
  const val = document.getElementById('pw-input').value;
  if (val === ADMIN_PASSWORD) {
    sessionStorage.setItem('adminAuth', '1');
    boot();
  } else {
    const err = document.getElementById('pw-error');
    err.textContent = 'Wrong password — try again.';
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
  }
}

function boot() {
  document.getElementById('auth-gate').style.display  = 'none';
  document.getElementById('dashboard').style.display  = 'block';
  initDashboard();
}

window.addEventListener('load', () => {
  if (sessionStorage.getItem('adminAuth') === '1') boot();
  else setTimeout(() => document.getElementById('pw-input')?.focus(), 80);
});

// ── Init ────────────────────────────────────────────────────────────────────
async function initDashboard() {
  await Promise.all([loadVotes(), loadQuizResults(), loadLeaderboard()]);
  initRealtime();
}

// ── Votes ────────────────────────────────────────────────────────────────────
async function loadVotes() {
  const { data } = await db.from('votes').select('question_id, choice');
  voteCounts = {};
  (data || []).forEach(({ question_id, choice }) => {
    if (!voteCounts[question_id]) voteCounts[question_id] = {};
    voteCounts[question_id][choice] = (voteCounts[question_id][choice] || 0) + 1;
  });
  renderVotes();
}

function renderVotes() {
  const el = document.getElementById('vote-feed');
  if (!el) return;

  let grandTotal = 0;
  el.innerHTML = VOTE_META.map((vq, qi) => {
    const counts = voteCounts[qi] || {};
    const total  = Object.values(counts).reduce((a, b) => a + b, 0);
    grandTotal  += total;

    const bars = vq.opts.map((opt, oi) => {
      const n   = counts[oi] || 0;
      const pct = total > 0 ? Math.round((n / total) * 100) : 0;
      return `<div class="vbar-row">
        <div class="vbar-meta">
          <span class="vbar-label">${opt}</span>
          <span class="vbar-count">${n} <span class="muted">(${pct}%)</span></span>
        </div>
        <div class="vbar-track"><div class="vbar-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');

    return `<div class="vq-block">
      <div class="vq-head">
        <span class="vq-num">Q${qi + 1}</span>
        <span class="vq-text">${vq.q}</span>
        <span class="vq-total">${total}</span>
      </div>
      ${bars}
    </div>`;
  }).join('');

  const badge = document.getElementById('vote-total-badge');
  if (badge) badge.textContent = grandTotal + ' votes total';
}

// ── Quiz Results ─────────────────────────────────────────────────────────────
async function loadQuizResults() {
  const { data } = await db.from('quiz_results').select('result_type');
  quizCounts = { Freethinker: 0, Classic: 0, Rebel: 0, Unaware: 0 };
  (data || []).forEach(({ result_type }) => {
    if (quizCounts[result_type] !== undefined) quizCounts[result_type]++;
  });
  renderQuizResults();
}

function renderQuizResults() {
  const el = document.getElementById('quiz-feed');
  if (!el) return;
  const total = Object.values(quizCounts).reduce((a, b) => a + b, 0);

  el.innerHTML = QUIZ_TYPES.map(({ key, icon, color }) => {
    const n   = quizCounts[key];
    const pct = total > 0 ? Math.round((n / total) * 100) : 0;
    return `<div class="quiz-row">
      <div class="quiz-row-head">
        <span class="quiz-icon">${icon}</span>
        <span class="quiz-name">${key}</span>
        <span class="quiz-count">${n}</span>
        <span class="muted">${pct}%</span>
      </div>
      <div class="vbar-track">
        <div class="vbar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
  }).join('');

  const badge = document.getElementById('quiz-total-badge');
  if (badge) badge.textContent = total + ' result' + (total !== 1 ? 's' : '');
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
async function loadLeaderboard() {
  const { data } = await db.from('leaderboard')
    .select('name, score').order('score', { ascending: false }).limit(20);
  lbRows = data || [];
  renderLeaderboard();
}

function renderLeaderboard() {
  const el = document.getElementById('lb-feed');
  if (!el) return;
  if (!lbRows.length) {
    el.innerHTML = '<div class="feed-empty">No scores yet</div>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = lbRows.map((r, i) => `
    <div class="lb-row">
      <span class="lb-rank">${medals[i] || '#' + (i + 1)}</span>
      <span class="lb-name">${r.name}</span>
      <span class="lb-score">${r.score} <span class="muted">pts</span></span>
    </div>`).join('');
}

// ── Live event feed ───────────────────────────────────────────────────────────
function pushEvent(html) {
  const feed = document.getElementById('event-feed');
  if (!feed) return;
  const empty = feed.querySelector('.feed-empty');
  if (empty) empty.remove();

  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const div = document.createElement('div');
  div.className = 'event-item';
  div.innerHTML = `<span class="event-time">${now}</span>${html}`;
  feed.prepend(div);

  // Flash animation
  requestAnimationFrame(() => div.classList.add('flash'));
  setTimeout(() => div.classList.remove('flash'), 900);

  // Keep max 30 events
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

// ── Realtime ─────────────────────────────────────────────────────────────────
function initRealtime() {

  // Votes — INSERT
  db.channel('admin:votes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, ({ new: row }) => {
      const qi  = row.question_id;
      const ch  = row.choice;
      if (!voteCounts[qi]) voteCounts[qi] = {};
      voteCounts[qi][ch] = (voteCounts[qi][ch] || 0) + 1;
      renderVotes();
      const opt  = VOTE_META[qi]?.opts[ch] ?? `Option ${ch}`;
      pushEvent(`<span class="ev-tag ev-vote">Vote</span> Q${qi + 1} → <strong>${opt}</strong>`);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'votes' }, () => {
      loadVotes();
    })
    .subscribe();

  // Quiz results — INSERT
  db.channel('admin:quiz')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_results' }, ({ new: row }) => {
      const t = row.result_type;
      if (quizCounts[t] !== undefined) quizCounts[t]++;
      renderQuizResults();
      const type = QUIZ_TYPES.find(x => x.key === t);
      pushEvent(`<span class="ev-tag ev-quiz">Quiz</span> ${type?.icon ?? ''} <strong>${t}</strong>`);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'quiz_results' }, () => {
      loadQuizResults();
    })
    .subscribe();

  // Leaderboard — INSERT + DELETE
  db.channel('admin:lb')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leaderboard' }, ({ new: row }) => {
      loadLeaderboard();
      pushEvent(`<span class="ev-tag ev-lb">Score</span> <strong>${row.name}</strong> → ${row.score} pts`);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leaderboard' }, () => {
      loadLeaderboard();
    })
    .subscribe();

  // Presence — count all active users on the main site
  const presenceCh = db.channel('presence:site');
  presenceCh
    .on('presence', { event: 'sync' }, () => {
      const n = Object.keys(presenceCh.presenceState()).length;
      document.getElementById('active-count').textContent     = n;
      document.getElementById('active-count-big').textContent = n;
    })
    .subscribe(async status => {
      // Join as admin (counted as 1 user)
      if (status === 'SUBSCRIBED')
        await presenceCh.track({ role: 'admin', joined: Date.now() });
    });
}

// ── Reset all ─────────────────────────────────────────────────────────────────
async function resetAll() {
  if (!confirm('Clear ALL votes, quiz results and leaderboard scores? This cannot be undone.')) return;
  const pw = prompt('Admin password:');
  if (!pw) return;
  try {
    const { error } = await db.rpc('reset_all', { admin_pass: pw });
    if (error) throw error;
    // Clear local state
    voteCounts = {};
    quizCounts = { Freethinker: 0, Classic: 0, Rebel: 0, Unaware: 0 };
    lbRows = [];
    renderVotes();
    renderQuizResults();
    renderLeaderboard();
    pushEvent('<span class="ev-tag ev-reset">Reset</span> All data cleared by admin');
  } catch (e) {
    alert('Reset failed: ' + (e.message || 'Wrong password'));
  }
}
