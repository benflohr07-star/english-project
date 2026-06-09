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
let voteCounts       = {};   // { qi: { choice: count } }
let voteGender       = {};   // { qi: { choice: { Boy:n, Girl:n, other:n } } }
let quizCounts       = { Freethinker:0, Classic:0, Rebel:0, Unaware:0 };
let quizGender       = { Freethinker:{Boy:0,Girl:0,other:0}, Classic:{Boy:0,Girl:0,other:0}, Rebel:{Boy:0,Girl:0,other:0}, Unaware:{Boy:0,Girl:0,other:0} };
let participantGender= { Boy:0, Girl:0, other:0 };
let lbRows           = [];

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
  const { data } = await db.from('votes').select('question_id, choice, gender');
  voteCounts = {};
  voteGender = {};
  (data || []).forEach(({ question_id, choice, gender }) => {
    // Totals
    if (!voteCounts[question_id]) voteCounts[question_id] = {};
    voteCounts[question_id][choice] = (voteCounts[question_id][choice] || 0) + 1;
    // Gender split
    const g = gender || 'other';
    if (!voteGender[question_id]) voteGender[question_id] = {};
    if (!voteGender[question_id][choice]) voteGender[question_id][choice] = { Boy:0, Girl:0, other:0 };
    voteGender[question_id][choice][g]++;
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

    // ── Main bars (overall) ─────────────────────────────────────────────────
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

    // ── Gender split mini-bars ───────────────────────────────────────────────
    const gSplit = voteGender[qi] || {};
    const boyTotal  = vq.opts.reduce((s,_,oi) => s + (gSplit[oi]?.Boy  || 0), 0);
    const girlTotal = vq.opts.reduce((s,_,oi) => s + (gSplit[oi]?.Girl || 0), 0);

    const genderSection = (boyTotal + girlTotal > 0) ? `
    <div class="gender-split">
      <div class="gender-split-col">
        <div class="gender-split-head"><span class="gsplit-dot gsplit-dot-boy"></span>Boys (${boyTotal})</div>
        ${vq.opts.map((opt, oi) => {
          const n   = gSplit[oi]?.Boy || 0;
          const pct = boyTotal > 0 ? Math.round((n / boyTotal) * 100) : 0;
          return `<div class="vbar-row" style="margin-bottom:5px">
            <div class="vbar-meta" style="font-size:11px">
              <span class="vbar-label" style="font-size:11px">${opt}</span>
              <span class="vbar-count">${n}</span>
            </div>
            <div class="vbar-track" style="height:4px"><div class="vbar-fill vbar-fill-boy" style="width:${pct}%;height:4px"></div></div>
          </div>`;
        }).join('')}
      </div>
      <div class="gender-split-col">
        <div class="gender-split-head"><span class="gsplit-dot gsplit-dot-girl"></span>Girls (${girlTotal})</div>
        ${vq.opts.map((opt, oi) => {
          const n   = gSplit[oi]?.Girl || 0;
          const pct = girlTotal > 0 ? Math.round((n / girlTotal) * 100) : 0;
          return `<div class="vbar-row" style="margin-bottom:5px">
            <div class="vbar-meta" style="font-size:11px">
              <span class="vbar-label" style="font-size:11px">${opt}</span>
              <span class="vbar-count">${n}</span>
            </div>
            <div class="vbar-track" style="height:4px"><div class="vbar-fill vbar-fill-girl" style="width:${pct}%;height:4px"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

    return `<div class="vq-block">
      <div class="vq-head">
        <span class="vq-num">Q${qi + 1}</span>
        <span class="vq-text">${vq.q}</span>
        <span class="vq-total">${total}</span>
      </div>
      ${bars}${genderSection}
    </div>`;
  }).join('');

  const badge = document.getElementById('vote-total-badge');
  if (badge) badge.textContent = grandTotal + ' votes total';
}

// ── Quiz Results ─────────────────────────────────────────────────────────────
async function loadQuizResults() {
  const { data } = await db.from('quiz_results').select('result_type, gender');
  quizCounts  = { Freethinker:0, Classic:0, Rebel:0, Unaware:0 };
  quizGender  = { Freethinker:{Boy:0,Girl:0,other:0}, Classic:{Boy:0,Girl:0,other:0}, Rebel:{Boy:0,Girl:0,other:0}, Unaware:{Boy:0,Girl:0,other:0} };
  participantGender = { Boy:0, Girl:0, other:0 };
  (data || []).forEach(({ result_type, gender }) => {
    if (quizCounts[result_type] !== undefined) {
      quizCounts[result_type]++;
      const g = gender || 'other';
      quizGender[result_type][g]++;
      participantGender[g]++;
    }
  });
  renderQuizResults();
  renderGenderSummary();
}

function renderQuizResults() {
  const el = document.getElementById('quiz-feed');
  if (!el) return;
  const total = Object.values(quizCounts).reduce((a, b) => a + b, 0);

  el.innerHTML = QUIZ_TYPES.map(({ key, icon, color }) => {
    const n   = quizCounts[key];
    const gd  = quizGender[key] || { Boy:0, Girl:0, other:0 };
    const pct = total > 0 ? Math.round((n / total) * 100) : 0;

    const genderPills = n > 0 ? `<div class="quiz-gender">
      ${gd.Boy  > 0 ? `<span class="quiz-gender-pill qgp-boy">👦 ${gd.Boy} Boy${gd.Boy!==1?'s':''}</span>` : ''}
      ${gd.Girl > 0 ? `<span class="quiz-gender-pill qgp-girl">👧 ${gd.Girl} Girl${gd.Girl!==1?'s':''}</span>` : ''}
      ${gd.other> 0 ? `<span class="quiz-gender-pill qgp-other">— ${gd.other} not specified</span>` : ''}
    </div>` : '';

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
      ${genderPills}
    </div>`;
  }).join('');

  const badge = document.getElementById('quiz-total-badge');
  if (badge) badge.textContent = total + ' result' + (total !== 1 ? 's' : '');
}

function renderGenderSummary() {
  const el = document.getElementById('gender-summary');
  if (!el) return;
  const { Boy, Girl, other } = participantGender;
  const total = Boy + Girl + other;
  el.innerHTML = total === 0
    ? '<span class="muted">No quiz completions yet</span>'
    : `<span class="gs-pill gs-boy">👦 ${Boy} Boy${Boy!==1?'s':''}</span>
       <span class="gs-sep">·</span>
       <span class="gs-pill gs-girl">👧 ${Girl} Girl${Girl!==1?'s':''}</span>
       <span class="gs-sep">·</span>
       <span class="gs-pill gs-other">${other} not specified</span>`;
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
      const g   = row.gender || 'other';
      if (!voteCounts[qi]) voteCounts[qi] = {};
      voteCounts[qi][ch] = (voteCounts[qi][ch] || 0) + 1;
      if (!voteGender[qi]) voteGender[qi] = {};
      if (!voteGender[qi][ch]) voteGender[qi][ch] = { Boy:0, Girl:0, other:0 };
      voteGender[qi][ch][g]++;
      renderVotes();
      const opt  = VOTE_META[qi]?.opts[ch] ?? `Option ${ch}`;
      const gTag = row.gender ? ` <span class="muted">(${row.gender})</span>` : '';
      pushEvent(`<span class="ev-tag ev-vote">Vote</span> Q${qi + 1} → <strong>${opt}</strong>${gTag}`);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'votes' }, () => {
      loadVotes();
    })
    .subscribe();

  // Quiz results — INSERT
  db.channel('admin:quiz')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_results' }, ({ new: row }) => {
      const t = row.result_type;
      const g = row.gender || 'other';
      if (quizCounts[t] !== undefined) {
        quizCounts[t]++;
        if (!quizGender[t]) quizGender[t] = { Boy:0, Girl:0, other:0 };
        quizGender[t][g]++;
        participantGender[g] = (participantGender[g] || 0) + 1;
        renderQuizResults();
        renderGenderSummary();
      }
      const type = QUIZ_TYPES.find(x => x.key === t);
      const gTag = row.gender ? ` <span class="muted">(${row.gender})</span>` : '';
      pushEvent(`<span class="ev-tag ev-quiz">Quiz</span> ${type?.icon ?? ''} <strong>${t}</strong>${gTag}`);
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
    voteCounts        = {};
    voteGender        = {};
    quizCounts        = { Freethinker:0, Classic:0, Rebel:0, Unaware:0 };
    quizGender        = { Freethinker:{Boy:0,Girl:0,other:0}, Classic:{Boy:0,Girl:0,other:0}, Rebel:{Boy:0,Girl:0,other:0}, Unaware:{Boy:0,Girl:0,other:0} };
    participantGender = { Boy:0, Girl:0, other:0 };
    lbRows            = [];
    renderVotes();
    renderQuizResults();
    renderGenderSummary();
    renderLeaderboard();
    pushEvent('<span class="ev-tag ev-reset">Reset</span> All data cleared by admin');
  } catch (e) {
    alert('Reset failed: ' + (e.message || 'Wrong password'));
  }
}

// ── Export helpers ────────────────────────────────────────────────────────────

/**
 * Show/hide the loading spinner on an export button.
 * Saves the original innerHTML in data-label so it can be restored.
 */
function setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (loading) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Fetching…';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.label || btn.innerHTML;
    btn.disabled = false;
  }
}

/**
 * Build a properly-escaped CSV string and trigger a browser download.
 * Prepends a UTF-8 BOM so Excel opens accented characters correctly.
 * @param {string}   filename  e.g. 'votes-export.csv'
 * @param {Array[]}  rows      2-D array of cells (first row = headers)
 */
function downloadCSV(filename, rows) {
  const csv = rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '');
      // Wrap in quotes if the cell contains a comma, quote, or newline
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ── Export 1: Votes as CSV ────────────────────────────────────────────────────

async function exportVotesCSV() {
  setBtnLoading('btn-export-votes', true);
  try {
    const { data, error } = await db
      .from('votes')
      .select('question_id, choice, gender, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const headers = ['Question #', 'Question Text', 'Choice #', 'Answer Label', 'Gender', 'Timestamp (UTC)'];
    const rows = data.map(r => [
      r.question_id + 1,
      VOTE_META[r.question_id]?.q     ?? `Question ${r.question_id + 1}`,
      r.choice + 1,
      VOTE_META[r.question_id]?.opts[r.choice] ?? `Option ${r.choice + 1}`,
      r.gender ?? 'not specified',
      r.created_at,
    ]);

    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`votes-export-${date}.csv`, [headers, ...rows]);
    pushEvent(`<span class="ev-tag ev-vote">Export</span> Votes CSV — ${data.length} rows`);
  } catch (e) {
    alert('Votes export failed: ' + (e.message || e));
  } finally {
    setBtnLoading('btn-export-votes', false);
  }
}

// ── Export 2: Quiz Results as CSV ─────────────────────────────────────────────

async function exportQuizCSV() {
  setBtnLoading('btn-export-quiz', true);
  try {
    const { data, error } = await db
      .from('quiz_results')
      .select('result_type, gender, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;

    // Count per type + gender for the summary block
    const counts = { Freethinker:0, Classic:0, Rebel:0, Unaware:0 };
    const gByType = { Freethinker:{Boy:0,Girl:0,other:0}, Classic:{Boy:0,Girl:0,other:0}, Rebel:{Boy:0,Girl:0,other:0}, Unaware:{Boy:0,Girl:0,other:0} };
    data.forEach(r => {
      if (r.result_type in counts) {
        counts[r.result_type]++;
        const g = r.gender || 'other';
        gByType[r.result_type][g]++;
      }
    });

    const headers  = ['Result Type', 'Gender', 'Timestamp (UTC)'];
    const dataRows = data.map(r => [r.result_type, r.gender ?? 'not specified', r.created_at]);
    const summary  = [
      [],
      ['── Summary ──', '', ''],
      ...Object.entries(counts).map(([type, n]) => {
        const gd = gByType[type];
        return [type, n, `${gd.Boy} Boys / ${gd.Girl} Girls / ${gd.other} not specified`];
      }),
      ['Total', data.length, ''],
    ];

    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`quiz-results-export-${date}.csv`, [headers, ...dataRows, ...summary]);
    pushEvent(`<span class="ev-tag ev-quiz">Export</span> Quiz CSV — ${data.length} results`);
  } catch (e) {
    alert('Quiz export failed: ' + (e.message || e));
  } finally {
    setBtnLoading('btn-export-quiz', false);
  }
}

// ── Export 3: Full Excel workbook (Votes + Quiz + Leaderboard) ────────────────

async function exportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS library not loaded — please refresh the page and try again.');
    return;
  }
  setBtnLoading('btn-export-excel', true);
  try {
    // Fetch all three datasets in parallel
    const [votesRes, quizRes, lbRes] = await Promise.all([
      db.from('votes')
        .select('question_id, choice, gender, created_at')
        .order('created_at', { ascending: true }),
      db.from('quiz_results')
        .select('result_type, gender, created_at')
        .order('created_at', { ascending: true }),
      db.from('leaderboard')
        .select('name, score, created_at')
        .order('score', { ascending: false }),
    ]);
    if (votesRes.error) throw new Error('Votes: '    + votesRes.error.message);
    if (quizRes.error)  throw new Error('Quiz: '     + quizRes.error.message);
    if (lbRes.error)    throw new Error('Leaderboard: ' + lbRes.error.message);

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Votes ────────────────────────────────────────────────────────
    const votesSheet = [
      ['Question #', 'Question Text', 'Choice #', 'Answer Label', 'Gender', 'Timestamp (UTC)'],
      ...votesRes.data.map(r => [
        r.question_id + 1,
        VOTE_META[r.question_id]?.q              ?? `Question ${r.question_id + 1}`,
        r.choice + 1,
        VOTE_META[r.question_id]?.opts[r.choice] ?? `Option ${r.choice + 1}`,
        r.gender ?? 'not specified',
        r.created_at,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(votesSheet), 'Votes');

    // ── Sheet 2: Quiz Results (with summary block) ────────────────────────────
    const qCounts  = { Freethinker:0, Classic:0, Rebel:0, Unaware:0 };
    const qGByType = { Freethinker:{Boy:0,Girl:0,other:0}, Classic:{Boy:0,Girl:0,other:0}, Rebel:{Boy:0,Girl:0,other:0}, Unaware:{Boy:0,Girl:0,other:0} };
    quizRes.data.forEach(r => {
      if (r.result_type in qCounts) {
        qCounts[r.result_type]++;
        const g = r.gender || 'other';
        qGByType[r.result_type][g]++;
      }
    });

    const quizSheet = [
      ['Result Type', 'Gender', 'Timestamp (UTC)'],
      ...quizRes.data.map(r => [r.result_type, r.gender ?? 'not specified', r.created_at]),
      [],
      ['── Summary ──', '', ''],
      ...Object.entries(qCounts).map(([type, n]) => {
        const gd = qGByType[type];
        return [type, n, `${gd.Boy} Boys / ${gd.Girl} Girls / ${gd.other} not specified`];
      }),
      ['Total', quizRes.data.length, ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quizSheet), 'Quiz Results');

    // ── Sheet 3: Leaderboard ──────────────────────────────────────────────────
    const lbSheet = [
      ['Rank', 'Name', 'Score (pts)', 'Submitted At (UTC)'],
      ...lbRes.data.map((r, i) => [i + 1, r.name, r.score, r.created_at]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lbSheet), 'Leaderboard');

    // Download
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `stereotypes-project-export-${date}.xlsx`);

    const total = votesRes.data.length + quizRes.data.length + lbRes.data.length;
    pushEvent(`<span class="ev-tag ev-lb">Export</span> Excel — ${total} rows across 3 sheets`);
  } catch (e) {
    alert('Excel export failed: ' + (e.message || e));
  } finally {
    setBtnLoading('btn-export-excel', false);
  }
}
