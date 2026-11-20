const $ = id => document.getElementById(id);
const LIMIT_TDS = 500, PH_MIN = 6.5, PH_MAX = 8.5, MAX_POINTS = 150;
let history = [], timer = null, lastSafe = null;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const isSafe = r => r.ph >= PH_MIN && r.ph <= PH_MAX && r.tds_out <= LIMIT_TDS;
const removal = r => r.tds_in > 0 ? (r.tds_in - r.tds_out) / r.tds_in * 100 : 0;
const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

// --- Simulated readings ---
const sim = { tdsIn: 650, tdsOut: 45, ph: 7.2, temp: 25.5, turb: 1.1 };
function simReading() {
  sim.tdsIn = clamp(sim.tdsIn + (Math.random() - 0.5) * 50, 350, 950);
  const spike = Math.random() < 0.06;
  sim.tdsOut = spike ? sim.tdsIn * (0.55 + Math.random() * 0.25) : sim.tdsIn * (0.03 + Math.random() * 0.07);
  sim.ph = clamp(sim.ph + (Math.random() - 0.5) * 0.12, 6.8, 8.2);
  if (Math.random() < 0.05) sim.ph = Math.random() < 0.5 ? 5.6 + Math.random() : 8.8 + Math.random() * 0.7;
  sim.temp = clamp(sim.temp + (Math.random() - 0.5) * 0.3, 23, 28);
  sim.turb = clamp(sim.turb + (Math.random() - 0.5) * 0.3, 0.1, 5);
  return { ts: Date.now(), ph: +sim.ph.toFixed(2), tds_in: Math.round(sim.tdsIn),
           tds_out: Math.round(sim.tdsOut), temp_c: +sim.temp.toFixed(1), turbidity: +sim.turb.toFixed(2) };
}

// --- ESP32 live readings ---
async function espReading(url) {
  const res = await fetch(url.replace(/\/$/, '') + '/data', { cache: 'no-store' });
  const d = await res.json();
  return { ts: d.ts || Date.now(), ph: finiteNumber(d.ph), tds_in: finiteNumber(d.tds_in),
           tds_out: finiteNumber(d.tds_out), temp_c: finiteNumber(d.temp_c),
           turbidity: d.turbidity == null ? null : finiteNumber(d.turbidity, null) };
}

// --- Telegram ---
function tgSend(text) {
  const token = $('tgToken').value.trim(), chat = $('tgChat').value.trim();
  if (!token || !chat) return;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text })
  }).catch(() => {});
}
$('tgTest').onclick = () => tgSend('SafiSense water helper is ready for a check ✅');
$('tgToken').value = localStorage.getItem('safisense_tg_token') || '';
$('tgChat').value = localStorage.getItem('safisense_tg_chat') || '';
$('tgToken').onchange = e => localStorage.setItem('safisense_tg_token', e.target.value.trim());
$('tgChat').onchange = e => localStorage.setItem('safisense_tg_chat', e.target.value.trim());

// --- Main loop ---
async function tick() {
  const mode = $('mode').value;
  let r, msg;
  
  if (mode === 'sim') {
    r = simReading();
    msg = 'Practice mode: pretend water readings';
  } 
  else if (mode === 'server') {
    const base = $('espUrl').value.trim() || 'http://localhost:8000';
    try {
      const res = await fetch(base.replace(/\/+$/, '') + '/api/latest', { cache: 'no-store' });
      if (res.status === 404) {
        $('conn').textContent = 'The water station is ready and waiting for its first reading…';
        return;
      }
      const d = await res.json();
      r = {
        ts: d.ts || Date.now(),
        ph: finiteNumber(d.ph),
        tds_in: finiteNumber(d.tds_in),
        tds_out: finiteNumber(d.tds_out),
        temp_c: finiteNumber(d.temp_c),
        turbidity: d.turbidity == null ? null : finiteNumber(d.turbidity, null),
        ml_safe: d.safe,
        ml_probability: d.probability_safe,
      };
      msg = `Live water check · model prediction: ${d.safe ? "SAFE class" : "CHECK class"}`;
    } catch (e) {
      $('conn').textContent = 'We cannot reach the water station yet. Ask a grown-up to check that the helper is running.';
      return;
    }
  } 
  else {
    const url = $('espUrl').value.trim() || 'http://192.168.4.1';
    try {
      r = await espReading(url);
      msg = `Live check from our water sensor`;
    } catch (e) {
      $('conn').textContent = `We cannot find the water sensor. Ask a grown-up to check its connection. (${e.message})`;
      return;
    }
  }
  
  r.removal = removal(r);
  r.safe = isSafe(r);
  history.push(r);
  if (history.length > MAX_POINTS) history.shift();
  render(r, msg);
  if (lastSafe === true && !r.safe) tgSend('⚠️ SafiSense: this water needs attention — ' + JSON.stringify({ ph: r.ph, tiny_things_remaining: r.tds_out }));
  lastSafe = r.safe;
}

function render(r, msg) {
  $('conn').textContent = `${msg} · ${history.length} readings · last ${new Date(r.ts).toLocaleTimeString()}`;
  
  // 1. Render the Rule Pill
  const pill = $('statusPill');
  pill.textContent = r.safe ? 'SAFE ✓' : 'NOT SAFE';
  pill.className = 'pill ' + (r.safe ? 'safe' : 'unsafe');

  // Show the rule result in kid-friendly language without implying a safety certification.
  const alert = $('healthAlert');
  const reasons = [];
  if (r.ph < PH_MIN || r.ph > PH_MAX) reasons.push('The pH is outside our 6.5–8.5 guide.');
  if (r.tds_out > LIMIT_TDS) reasons.push('TDS after cleaning is above the 500 ppm guide.');
  alert.hidden = false;
  alert.classList.toggle('good', reasons.length === 0);
  $('alertTitle').textContent = reasons.length ? 'NOT SAFE BY THIS CHECK' : 'SAFE BY THIS CHECK';
  $('alertText').textContent = reasons.length
    ? `${reasons.join(' ')} Ask a trusted adult to help check what might be happening.`
    : 'Nice investigating! This check only looks at pH and TDS. It cannot test for every germ or chemical.';

  // 2. Render the ML Badge (if it exists)
  const old = document.getElementById("mlBadge");
  if (old) old.remove();
  if (r.ml_safe !== undefined) {
    const ml = document.createElement("span");
    ml.id = "mlBadge";
    ml.className = "pill " + (r.ml_safe ? "safe" : "unsafe");
    ml.style.fontSize = "13px";
    ml.style.padding = "4px 10px";
    ml.style.marginLeft = "8px";
    ml.textContent = `Model guess: ${r.ml_safe ? "SAFE class" : "CHECK class"}` +
      (r.ml_probability != null ? ` (${(r.ml_probability * 100).toFixed(0)}%)` : "");
    $("statusPill").after(ml);
  }

  const set = (id, val, bad) => { const el = $(id); el.textContent = val; el.classList.toggle('bad', !!bad); };
  set('tPh', r.ph.toFixed(2), r.ph < PH_MIN || r.ph > PH_MAX);
  set('tTdsIn', r.tds_in, false);
  set('tTdsOut', r.tds_out, r.tds_out > LIMIT_TDS);
  set('tTemp', r.temp_c.toFixed(1), false);
  set('tTurb', r.turbidity == null ? '—' : r.turbidity.toFixed(2), false);
  set('tRem', r.removal.toFixed(1) + '%', r.removal < 80);
  drawChart();
}

// --- Chart (plain canvas, no external library) ---
function drawChart() {
  const c = $('chart'), ctx = c.getContext('2d');
  const W = c.width, H = c.height, L = 52, R = 12, T = 14, B = 30;
  ctx.clearRect(0, 0, W, H);
  if (!history.length) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Waiting for our first water check…', L + 20, H / 2);
    return;
  }
  const vals = history.flatMap(r => [finiteNumber(r.tds_in), finiteNumber(r.tds_out)]);
  const yMax = Math.max(1000, Math.ceil(Math.max(...vals) * 1.1 / 250) * 250);
  const x = i => history.length === 1 ? L + (W - L - R) / 2 : L + i / (history.length - 1) * (W - L - R);
  const y = v => T + (1 - v / yMax) * (H - T - B);

  ctx.strokeStyle = '#e2e8f0'; ctx.fillStyle = '#64748b'; ctx.font = '11px Inter, sans-serif';
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = yMax / steps * s, yy = y(v);
    ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(v, L - 6, yy + 4);
  }
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#dc2626';
  ctx.beginPath(); ctx.moveTo(L, y(LIMIT_TDS)); ctx.lineTo(W - R, y(LIMIT_TDS)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'left'; ctx.fillText('500 ppm guide', L + 4, y(LIMIT_TDS) - 5);

  const line = (key, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    history.forEach((r, i) => i ? ctx.lineTo(x(i), y(r[key])) : ctx.moveTo(x(i), y(r[key])));
    ctx.stroke(); ctx.lineWidth = 1;
    history.forEach((r, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x(i), y(r[key]), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  };
  line('tds_in', '#0284c7');
  line('tds_out', '#0d9488');

  ctx.save();
  ctx.translate(14, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TDS (ppm)', 0, 0);
  ctx.restore();
}

// --- CSV export ---
$('csvBtn').onclick = () => {
  if (!history.length) return;
  const head = 'ts_iso,ph,tds_in,tds_out,temp_c,turbidity,removal_pct,safe';
  const rows = history.map(r => [
    new Date(r.ts).toISOString(), r.ph, r.tds_in, r.tds_out, r.temp_c,
    r.turbidity ?? '', r.removal.toFixed(2), r.safe ? 1 : 0
  ].join(','));
  const blob = new Blob([head + '\n' + rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'safisense_readings.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

// --- Controls ---
$('clearBtn').onclick = () => {
  history = [];
  lastSafe = null;
  drawChart();
  $('healthAlert').hidden = true;
  $('healthAlert').classList.remove('good');
  $('statusPill').textContent = 'Waiting for a check';
  $('statusPill').className = 'pill';
  const mlBadge = $('mlBadge');
  if (mlBadge) mlBadge.remove();
  $('conn').textContent = 'Our page is clean and ready for a new check.';
};
$('startBtn').onclick = () => {
  if (timer) return;
  tick();
  timer = setInterval(tick, 2000);
  $('startBtn').disabled = true; $('stopBtn').disabled = false;
};
$('stopBtn').onclick = () => {
  clearInterval(timer); timer = null;
  $('startBtn').disabled = false; $('stopBtn').disabled = true;
  $('conn').textContent = 'Checking paused.';
};
$('mode').onchange = () => {
  const m = $('mode').value;
  $('espUrl').style.display = (m === 'esp32' || m === 'server') ? '' : 'none';
  if (m === 'server') {
    $('espUrl').placeholder = "http://localhost:8000";
  } else {
    $('espUrl').placeholder = "http://192.168.4.1";
  }
  if (timer) { clearInterval(timer); timer = null; tick(); timer = setInterval(tick, 2000); }
};
$('espUrl').style.display = 'none';
window.addEventListener('resize', drawChart);
drawChart();