/* sk-ielts-ui.js: page parts for IELTS practice. A question set shows a recording or a passage with numbered
   questions on one page, as on test day; a test runs several sets against one clock and converts the raw score
   to an approximate band. Figures for maps, charts and processes are drawn as SVG from data, as text. */
(function () {
  'use strict';
  const SK = window.SK, h = SK.h, s = SK.s, I = SK.ielts;

  // ---------- figures ----------
  const frame = (w, hh, label, kids) => s('svg', { viewBox: '0 0 ' + w + ' ' + hh, class: 'sk-figure', role: 'img', 'aria-label': label, width: w, height: hh }, kids);
  const text = (x, y, t, anchor, size) => s('text', { x, y, 'text-anchor': anchor || 'middle', 'dominant-baseline': 'middle', style: size ? 'font-size:' + size + 'px' : null }, String(t));
  // Long labels wrap onto two lines inside a box.
  const label = (x, y, t, max) => {
    const words = String(t).split(' ');
    if (String(t).length <= max || words.length === 1) return [text(x, y, t, 'middle', String(t).length > max ? 11 : 13)];
    let a = '', b = '';
    for (const w of words) { if ((a + ' ' + w).trim().length <= max && !b) a = (a + ' ' + w).trim(); else b = (b + ' ' + w).trim(); }
    return [text(x, y - 8, a, 'middle', 12), text(x, y + 8, b, 'middle', 12)];
  };
  SK.figures.map = function (f) {
    const W = 380, H = 400, bw = 120, bh = 54;
    const pos = { END: [W / 2, 40] };
    [1, 2, 3, 4].forEach((r) => { const y = 330 - (r - 1) * 76; pos['L' + r] = [92, y]; pos['R' + r] = [W - 92, y]; });
    const kids = [s('rect', { x: W / 2 - 22, y: 70, width: 44, height: H - 110, class: 'soft', rx: 4 }), text(W / 2, 200, f.path, 'middle', 11),
      s('polygon', { points: (W / 2 - 12) + ',' + (H - 14) + ' ' + (W / 2 + 12) + ',' + (H - 14) + ' ' + (W / 2) + ',' + (H - 32), class: 'mark' }), text(W / 2, H - 6, f.entrance, 'middle', 11)];
    for (const [slot, [x, y]] of Object.entries(pos)) {
      const lab = f.labels[slot] || '';
      const letter = /^[A-H]$/.test(lab);
      kids.push(s('rect', { x: x - bw / 2, y: y - bh / 2, width: bw, height: bh, rx: 6, class: letter ? 'area' : 'soft' }));
      kids.push(...(letter ? [text(x, y, lab, 'middle', 20)] : label(x, y, lab, 14)));
    }
    return frame(W, H, 'Map of ' + f.title, kids);
  };
  const axisChart = (f, draw) => {
    const W = 600, H = 300, L = 56, B = 40, T = 30, R = 12;
    const all = f.series.flatMap((x) => x.values);
    const top = Math.max(...all);
    const step = SK.niceStep(top / 4);
    const max = Math.ceil(top / step) * step || 1;
    const y = (v) => H - B - (v / max) * (H - B - T);
    const kids = [text(W / 2, 12, f.title, 'middle', 13)];
    for (let v = 0; v <= max + 1e-9; v += step) kids.push(s('line', { x1: L, y1: y(v), x2: W - R, y2: y(v), class: 'grid' }), text(L - 6, y(v), SK.round(v, 1), 'end', 11));
    kids.push(text(14, (H - B + T) / 2, f.unit, 'middle', 11));
    kids[kids.length - 1].setAttribute('transform', 'rotate(-90 14 ' + (H - B + T) / 2 + ')');
    draw(kids, { W, H, L, B, T, R, y });
    // legend
    const lg = h('div', { class: 'sk-row sk-small', style: { justifyContent: 'center', gap: '14px', marginTop: '-4px' } }, f.series.map((x, i) => h('span', {}, h('span', { style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', marginRight: '5px', verticalAlign: 'middle', background: ['#2f5bd3', '#c2410c', '#0f766e', '#9333ea', '#be123c', '#4d7c0f'][i] } }), x.name)));
    return h('div', {}, frame(W, H, f.title, kids), lg);
  };
  SK.figures.line = (f) => axisChart(f, (kids, g) => {
    const n = f.xs.length, x = (i) => g.L + 10 + (i / (n - 1)) * (g.W - g.L - g.R - 20);
    f.xs.forEach((t, i) => kids.push(text(x(i), g.H - g.B + 16, t, 'middle', 11)));
    f.series.forEach((ser, k) => {
      kids.push(s('polyline', { points: ser.values.map((v, i) => x(i) + ',' + g.y(v)).join(' '), class: 'series s' + k, style: 'fill:none' }));
      ser.values.forEach((v, i) => kids.push(s('circle', { cx: x(i), cy: g.y(v), r: 3.5, class: 's' + k }, s('title', {}, ser.name + ', ' + f.xs[i] + ': ' + v))));
    });
  });
  SK.figures.bar = (f) => axisChart(f, (kids, g) => {
    const n = f.xs.length, k = f.series.length, gw = (g.W - g.L - g.R) / n, bw = (gw * 0.8) / k;
    f.xs.forEach((t, i) => {
      kids.push(text(g.L + gw * i + gw / 2, g.H - g.B + 16, t, 'middle', 11));
      f.series.forEach((ser, j) => { const v = ser.values[i]; kids.push(s('rect', { x: g.L + gw * i + gw * 0.1 + j * bw, y: g.y(v), width: bw - 2, height: g.H - g.B - g.y(v), class: 's' + j }, s('title', {}, ser.name + ', ' + t + ': ' + v))); });
    });
  });
  SK.figures.pie = function (f) {
    const R = 86, W = 230 * f.xs.length, H = 250;
    const kids = [text(W / 2, 12, f.title, 'middle', 13)];
    f.xs.forEach((yr, p) => {
      const cx = 115 + p * 230, cy = 140;
      let a0 = -Math.PI / 2;
      kids.push(text(cx, 34, yr, 'middle', 13));
      f.series.forEach((ser, i) => {
        const v = ser.values[p], a1 = a0 + (v / 100) * 2 * Math.PI;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const pt = (a) => (cx + R * Math.cos(a)) + ',' + (cy + R * Math.sin(a));
        kids.push(s('path', { d: 'M' + cx + ',' + cy + ' L' + pt(a0) + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + pt(a1) + ' Z', class: 'slice s' + i }, s('title', {}, ser.name + ': ' + v + '%')));
        const mid = (a0 + a1) / 2;
        if (v >= 6) kids.push(s('text', { x: cx + R * 0.62 * Math.cos(mid), y: cy + R * 0.62 * Math.sin(mid), 'text-anchor': 'middle', 'dominant-baseline': 'middle', style: 'fill:#fff;font-size:12px;font-weight:700' }, v + '%'));
        a0 = a1;
      });
    });
    const lg = h('div', { class: 'sk-row sk-small', style: { justifyContent: 'center', gap: '14px' } }, f.series.map((x, i) => h('span', {}, h('span', { style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', marginRight: '5px', verticalAlign: 'middle', background: ['#2f5bd3', '#c2410c', '#0f766e', '#9333ea', '#be123c', '#4d7c0f'][i] } }), x.name + (x.values.length ? '' : ''))));
    return h('div', {}, frame(W, H, f.title, kids), lg);
  };
  // A process as numbered boxes, two columns, read down the left then down the right.
  SK.figures.process = function (f) {
    const n = f.steps.length, per = Math.ceil(n / 2), W = 560, rowH = 74, H = per * rowH + 30;
    const kids = [text(W / 2, 12, f.title, 'middle', 13)];
    const at = (i) => [i < per ? 140 : 420, 50 + (i % per) * rowH];
    f.steps.forEach((st, i) => {
      const [x, y] = at(i);
      kids.push(s('rect', { x: x - 125, y: y - 24, width: 250, height: 48, rx: 8, class: 'step' }), text(x - 112, y, String(i + 1), 'middle', 12));
      kids.push(...label(x + 8, y, st, 30));
      if (i + 1 < n) {
        const [x2, y2] = at(i + 1);
        if (x2 === x) kids.push(s('line', { x1: x, y1: y + 24, x2: x, y2: y2 - 26, class: 'axis' }), s('polygon', { points: (x - 5) + ',' + (y2 - 31) + ' ' + (x + 5) + ',' + (y2 - 31) + ' ' + x + ',' + (y2 - 25), class: 'mark' }));
        else kids.push(s('polyline', { points: (x + 125) + ',' + y + ' ' + (W / 2) + ',' + y + ' ' + (W / 2) + ',' + y2 + ' ' + (x2 - 127) + ',' + y2, class: 'axis', style: 'fill:none' }));
      }
    });
    return frame(W, H, f.title, kids);
  };
  // Two plans of the same place, before and after, from boxes on a 10 by 10 grid.
  SK.figures.plans = function (f) {
    const one = (plan, ox) => {
      const out = [text(ox + 140, 14, plan.year, 'middle', 13), s('rect', { x: ox + 10, y: 26, width: 260, height: 260, class: 'soft', rx: 6 })];
      for (const b of plan.items) {
        const x = ox + 10 + b.x * 26, y = 26 + b.y * 26, w = b.w * 26, hh = b.h * 26;
        out.push(s('rect', { x, y, width: w, height: hh, rx: 4, class: b.kind === 'road' ? 'road' : b.kind === 'green' ? 'mark2' : 'area', style: b.kind === 'green' ? 'opacity:.35' : null }));
        out.push(...label(x + w / 2, y + hh / 2, b.label, Math.max(6, Math.floor(w / 8))));
      }
      return out;
    };
    return frame(570, 300, f.title, one(f.before, 0).concat(one(f.after, 290)));
  };

  // ---------- one question set on one page ----------
  // set: { id, title, instructions, limit, audio | passage, passageTitle, figure, table, questions, transcript }
  // opts: { mode: 'practice' | 'test', start: 1, plays, seconds, onFinish(summary, responses), noLog, embedded }
  SK.setView = function (el, set, opts) {
    opts = Object.assign({ mode: 'practice', start: 1 }, opts || {});
    const qs = set.questions;
    const resp = qs.map(() => undefined);
    let checked = false;
    const t0 = Date.now();
    const timer = opts.seconds ? SK.timer(opts.seconds, () => check(true)) : null;
    SK.clear(el);
    const top = SK.card(set.title || null);
    if (timer) top.appendChild(h('div', { class: 'sk-row', style: { justifyContent: 'flex-end' } }, timer.el));
    if (set.instructions) top.appendChild(h('p', { class: 'sk-small' }, SK.rich(set.instructions)));
    if (set.limit) top.appendChild(h('p', {}, h('strong', { text: 'Write ' + set.limit + ' for each answer.' })));
    if (set.audio) top.appendChild(SK.audioPlayer(set.audio, { maxPlays: opts.plays || (opts.mode === 'test' ? 1 : 0) }));
    if (set.figure && SK.figures[set.figure.kind]) top.appendChild(SK.figures[set.figure.kind](set.figure));
    if (set.table) top.appendChild(SK.table(set.table.head, set.table.rows, false));
    const qBox = h('div', {});
    const holder = set.passage ? h('div', { class: 'sk-split' }, h('div', {}, set.passageTitle ? h('h3', { text: set.passageTitle }) : null, h('div', { class: 'sk-passage', tabindex: '0' }, SK.rich(set.passage))), qBox) : qBox;
    top.appendChild(holder);
    const after = h('div', {});
    const btns = h('div', { class: 'sk-row', style: { marginTop: '12px' } });
    top.append(btns, after);
    el.appendChild(top);
    const heading = (k) => {
      const q = qs[k];
      if (!q.heading || (k > 0 && qs[k - 1].heading === q.heading)) return null;
      const long = q.type === 'single' && q.choices.length > 5;
      return h('div', {}, h('h4', { style: { margin: '14px 0 6px', whiteSpace: 'pre-line' } }, SK.rich(q.heading)),
        long ? h('ul', { class: 'sk-small', style: { margin: '0 0 8px', paddingLeft: '18px' } }, q.choices.map((c) => h('li', { text: c }))) : null);
    };
    function draw() {
      SK.clear(qBox);
      qs.forEach((q, k) => {
        const n = opts.start + k;
        const box = h('div', { class: 'sk-q', style: { margin: '8px 0', paddingBottom: '8px', borderBottom: '1px dashed var(--line)' } });
        const ok = checked ? SK.isCorrect(q, resp[k]) : null;
        if (q.type === 'text') {
          const parts = String(q.stem).split('___');
          const inp = h('input', { type: 'text', value: resp[k] || '', disabled: checked, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Answer ' + n, class: 'sk-gap' + (checked ? (ok ? ' right' : ' wrong') : ''), style: { width: '14ch', fontFamily: 'inherit' }, oninput: (e) => { resp[k] = e.target.value; } });
          box.appendChild(h('div', {}, h('strong', { text: n + '. ' }), SK.rich(parts[0]), inp, parts.length > 1 ? SK.rich(parts.slice(1).join('')) : null));
          if (checked && !ok) box.appendChild(h('div', { class: 'sk-small' }, 'Answer: ', h('strong', { text: q.answer }), q.accept && q.accept.length ? h('span', { class: 'sk-muted', text: ' (also accepted: ' + q.accept.slice(0, 4).join('; ') + ')' }) : null));
        } else if (q.type === 'single' && q.choices.length > 5) {
          // A long shared list (headings, endings, a word box) is a drop-down, as the options are printed once on paper.
          box.appendChild(h('div', { style: { marginBottom: '6px' } }, h('strong', { text: n + '. ' }), SK.rich(q.stem)));
          box.appendChild(h('select', { disabled: checked, 'aria-label': 'Answer ' + n, class: 'sk-pick' + (checked ? (ok ? ' right' : ' wrong') : ''), style: { maxWidth: '100%' }, onchange: (e) => { resp[k] = e.target.value === '' ? undefined : Number(e.target.value); } },
            [h('option', { value: '' }, 'Choose…')].concat(q.choices.map((c, i) => h('option', { value: i, selected: resp[k] === i }, c)))));
          if (checked && !ok) box.appendChild(h('div', { class: 'sk-small' }, 'Answer: ', h('strong', { text: q.choices[q.answer] })));
        } else {
          box.appendChild(h('div', { style: { marginBottom: '6px' } }, h('strong', { text: n + '. ' }), SK.rich(q.stem)));
          const sub = h('div', {});
          SK.drawItem(sub, Object.assign({}, q, { stem: '', passage: null }), resp[k], (r) => { resp[k] = r; }, checked);
          const stemDiv = sub.querySelector('.sk-stem');
          if (stemDiv && !stemDiv.textContent) stemDiv.remove();
          box.appendChild(sub);
        }
        if (checked && q.explanation && (!ok || opts.mode === 'practice')) box.appendChild(h('div', { class: 'sk-small sk-muted', style: { marginTop: '4px' } }, SK.rich((ok ? '' : '') + q.explanation)));
        const head = heading(k);
        if (head) qBox.appendChild(head);
        qBox.appendChild(box);
      });
      SK.clear(btns);
      if (!checked) btns.appendChild(SK.btn(opts.mode === 'test' ? 'Submit answers' : 'Check answers', () => check(false), '', { 'data-auto': 'once' }));
    }
    function check(timeUp) {
      if (checked) return;
      checked = true;
      if (timer) timer.stop();
      SK.speech.stop();
      const sum = SK.summarise(qs, resp, (Date.now() - t0) / 1000);
      qs.forEach((q, k) => { if (!SK.isCorrect(q, resp[k])) SK.logMistake(q, resp[k]); });
      if (!opts.noLog) { SK.logSession(sum); SK.logPractice(sum.seconds / 60, set.title || 'Questions'); }
      draw();
      SK.clear(after);
      if (!opts.embedded) after.appendChild(SK.note((timeUp ? 'Time is up. ' : '') + 'You got ' + sum.correct + ' of ' + sum.total + ' right.', sum.correct === sum.total ? 'right' : 'info'));
      const said = set.transcript || (set.audio ? SK.audioText(set.audio) : '');
      if (said) after.appendChild(h('details', { style: { marginTop: '8px' } }, h('summary', { text: 'Show the transcript' }), h('div', { class: 'sk-passage', style: { marginTop: '8px', whiteSpace: 'pre-wrap' } }, said)));
      if (opts.onFinish) opts.onFinish(sum, resp);
    }
    draw();
    return { check: () => check(false), responses: resp };
  };

  // Practice screen: a "new set" button over a set maker.
  SK.setPractice = function (el, opts) {
    const start = () => {
      const set = opts.make(SK.seedNow());
      if (!set) { SK.clear(el).appendChild(SK.note('No sets available.', 'wrong')); return; }
      const box = h('div', {});
      SK.clear(el);
      el.appendChild(box);
      SK.setView(box, set, Object.assign({}, opts.view || {}, { onFinish: (sum, r) => { el.appendChild(h('div', { class: 'sk-row', style: { margin: '10px 0' } }, SK.btn(opts.again || 'Another set', start, '', { 'data-auto': 'once' }))); if (opts.onFinish) opts.onFinish(sum, r, set); } }));
    };
    SK.clear(el);
    el.appendChild(SK.card(opts.title, opts.intro ? h('p', { class: 'sk-muted' }, SK.rich(opts.intro)) : null, opts.extra ? opts.extra() : null, h('div', { style: { marginTop: '10px' } }, SK.btn(opts.button || 'Start', start, '', { 'data-auto': 'once' }))));
  };

  // Speaking: the questions are read aloud one at a time, and each answer is recorded on this device.
  // opts: { title, seconds, prep, intro, onDone(results) }
  SK.askAndRecord = function (el, qs, opts) {
    opts = opts || {};
    let k = 0;
    const results = [];
    const step = () => {
      SK.clear(el);
      if (k >= qs.length) {
        const card = SK.card(opts.doneTitle || 'Well done', h('p', { text: 'You answered ' + results.length + ' of ' + qs.length + ' questions. Listen back below, or rate your recordings in the Speaking Self-Check app.' }));
        el.appendChild(card);
        SK.recordingsList(card, SK.APP.name, 10);
        if (opts.onDone) opts.onDone(results);
        return;
      }
      const q = qs[k];
      el.appendChild(SK.card((opts.title || 'Question') + ' ' + (k + 1) + ' of ' + qs.length, opts.intro ? h('p', { class: 'sk-small sk-muted' }, SK.rich(opts.intro)) : null,
        h('div', { class: 'sk-passage', style: { whiteSpace: 'pre-line' } }, SK.rich(q)), SK.speech.ok() ? SK.btn('Hear the question again', () => SK.speech.say(q.replace(/\*/g, '')), 'ghost small') : null,
        h('div', { style: { marginTop: '10px' } }, SK.recorder({ prep: opts.prep || 0, seconds: opts.seconds, onDone: (blob, s) => {
          results.push({ q, seconds: s });
          SK.clips.save({ id: 'c-' + Date.now(), at: Date.now(), app: SK.APP.name, day: SK.dayKey(), q, seconds: s, blob }).catch((e) => SK.warn('The recording could not be saved: ' + e.message));
          SK.logPractice(s / 60, opts.title || 'Speaking');
        } })),
        h('div', { class: 'sk-row', style: { marginTop: '10px' } }, SK.btn(k + 1 < qs.length ? 'Next question' : 'Finish', () => { k++; step(); }, '', { 'data-auto': '1' }))));
      if (!SK.selftesting && opts.speak !== false) SK.speech.say(q.replace(/\*/g, ''));
    };
    step();
  };
  // Recordings saved by an app (or all apps), newest first, with play and delete.
  SK.recordingsList = function (el, app, max) {
    const box = h('div', {}, h('p', { class: 'sk-muted sk-small', text: 'Loading recordings…' }));
    el.appendChild(box);
    SK.clips.list().then((clips) => {
      const mine = clips.filter((c) => !app || c.app === app).slice(0, max || 50);
      SK.clear(box);
      if (!mine.length) { box.appendChild(h('p', { class: 'sk-muted', text: 'No recordings yet.' })); return; }
      mine.forEach((c) => box.appendChild(h('div', { style: { borderTop: '1px solid var(--line)', padding: '8px 0' } }, h('p', { class: 'sk-small' }, h('strong', { text: c.day + ' ' }), String(c.q || '').replace(/\*/g, '').slice(0, 160)),
        h('audio', { controls: true, src: URL.createObjectURL(c.blob), style: { width: '100%' } }), SK.confirmTwice(SK.btn('Delete', null, 'ghost small'), 'Delete', () => SK.clips.remove(c.id).then(() => { box.remove(); SK.recordingsList(el, app, max); })))));
    }).catch(() => { SK.clear(box).appendChild(SK.note('Recordings are not available in this browser.', 'wrong')); });
  };

  // A bank of fixed sets (recordings or passages): a list with your best score for each, and "next unseen".
  // opts: { title, intro, sets: [set], audio: true to offer hearing it once, view: extra setView options, tips }
  SK.setBank = function (el, opts) {
    const key = SK.APP.name + '.done', onceKey = SK.APP.name + '.once';
    const open = (set) => {
      const box = h('div', {});
      SK.clear(el);
      el.appendChild(box);
      SK.setView(box, set, Object.assign({ plays: SK.store.get(onceKey, false) ? 1 : 0 }, opts.view || {}, { onFinish: (sum) => {
        const d = SK.store.get(key, {});
        if (!d[set.id] || sum.correct >= d[set.id].right) d[set.id] = { right: sum.correct, total: sum.total, day: SK.dayKey() };
        SK.store.set(key, d);
        el.appendChild(h('div', { class: 'sk-row', style: { margin: '10px 0' } }, SK.btn('Next set', next, '', { 'data-auto': 'once' }), SK.btn('All sets', draw, 'ghost')));
      } }));
    };
    const next = () => {
      const done = SK.store.get(key, {});
      const unseen = opts.sets.filter((s) => !done[s.id]);
      open(unseen.length ? unseen[0] : SK.pick(SK.rng(SK.seedNow()), opts.sets));
    };
    function draw() {
      const done = SK.store.get(key, {});
      SK.clear(el);
      const card = SK.card(opts.title, opts.intro ? h('p', { class: 'sk-muted' }, SK.rich(opts.intro)) : null);
      if (opts.audio) card.appendChild(SK.select([['0', 'Play as often as I like'], ['1', 'Hear it once, as in the test']], SK.store.get(onceKey, false) ? '1' : '0', (v) => SK.store.set(onceKey, v === '1'), 'Listening'));
      card.appendChild(h('div', { style: { margin: '12px 0' } }, SK.btn(Object.keys(done).length < opts.sets.length ? 'Start the next new set' : 'Start a random set', next, '', { 'data-auto': 'once' })));
      card.appendChild(SK.table(['Set', 'Questions', 'Best score', ''], opts.sets.map((s) => [s.title, s.questions.length, done[s.id] ? done[s.id].right + ' / ' + done[s.id].total : '-', SK.btn('Open', () => open(s), 'ghost small')])));
      el.appendChild(card);
      if (opts.tips) el.appendChild(SK.card('Tips', h('ul', {}, opts.tips.map((t) => h('li', {}, SK.rich(t))))));
    }
    draw();
  };

  // A whole test: sets in order against one clock, numbered 1 to 40, then a raw score and an approximate band.
  // parts: [{ set, label }]. opts: { title, seconds, table: 'listening' | 'academic' | 'general', checkSeconds, onFinish(result) }
  SK.testRun = function (el, parts, opts) {
    const views = [];
    let k = 0, done = false, number = 1;
    const results = parts.map(() => null);
    const t0 = Date.now();
    const timer = SK.timer(opts.seconds, () => finish(true));
    const nav = h('div', { class: 'sk-row' });
    const bar = SK.card(null, h('div', { class: 'sk-row', style: { justifyContent: 'space-between' } }, h('strong', { text: opts.title }), timer.el), nav);
    const stage = h('div', {});
    SK.clear(el);
    el.append(bar, stage);
    const boxes = parts.map(() => h('div', { class: 'sk-hidden' }));
    boxes.forEach((b) => stage.appendChild(b));
    parts.forEach((p, i) => {
      const start = number;
      number += p.set.questions.length;
      views[i] = SK.setView(boxes[i], Object.assign({}, p.set, { title: p.label + ': ' + (p.set.title || '') }), { mode: 'test', start, embedded: true, noLog: true, onFinish: (sum, r) => { results[i] = { sum, r }; } });
      boxes[i].querySelectorAll('.sk-btn').forEach((b) => { if (/Submit answers/.test(b.textContent)) b.remove(); });
    });
    const show = (i) => {
      k = i;
      SK.speech.stop();
      boxes.forEach((b, j) => b.classList.toggle('sk-hidden', j !== i));
      SK.clear(nav);
      parts.forEach((p, j) => nav.appendChild(SK.btn(p.label, () => show(j), j === i ? 'small' : 'ghost small')));
      nav.appendChild(i + 1 < parts.length ? SK.btn('Next part', () => show(i + 1), 'small', { 'data-auto': '1' }) : SK.btn('Finish the test', () => finish(false), 'small', { 'data-auto': 'once' }));
    };
    function finish(timeUp) {
      if (done) return;
      done = true;
      timer.stop();
      SK.speech.stop();
      views.forEach((v) => v.check());
      boxes.forEach((b) => b.classList.remove('sk-hidden'));
      const correct = SK.sum(results.map((x) => (x ? x.sum.correct : 0)));
      const total = SK.sum(results.map((x) => (x ? x.sum.total : 0)));
      const byTopic = {};
      results.forEach((x) => x && Object.entries(x.sum.byTopic).forEach(([t, v]) => { byTopic[t] = byTopic[t] || { right: 0, total: 0 }; byTopic[t].right += v.right; byTopic[t].total += v.total; }));
      const raw40 = total ? Math.round((correct / total) * 40) : 0;
      const band = opts.table ? I.band(raw40, opts.table) : null;
      const seconds = (Date.now() - t0) / 1000;
      SK.logSession({ correct, total, seconds, byTopic }, { test: opts.title, band });
      SK.logPractice(seconds / 60, opts.title);
      SK.clear(nav);
      bar.appendChild(SK.stats([['Correct', correct + ' / ' + total], ['Approximate band', band === null ? 'below 2.5' : band], ['Time', SK.formatTime(seconds)]]));
      bar.appendChild(SK.note((timeUp ? 'Time is up. ' : '') + (total !== 40 ? 'Scaled to 40 questions, that is about ' + raw40 + '. ' : '') + 'Bands come from the approximate tables IELTS publishes; real tests vary slightly. Your answers and the transcripts are below.'));
      if (opts.onFinish) opts.onFinish({ correct, total, band, raw40 });
    }
    show(0);
  };

})();
