// Tests for the shared kit: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const KIT = process.env.SK_KIT || path.join(__dirname, '..', 'web', 'kit');
const SK = require(path.join(KIT, 'sk-core.js'));
require(path.join(KIT, 'sk-ielts.js'));
require(path.join(KIT, 'sk-apps.js'));
const { Frac } = SK;
const I = SK.ielts;

test('fractions parse what students type and compare exactly', () => {
  assert.equal(Frac.parse('3/4').toString(), '3/4');
  assert.equal(Frac.parse('6/8').toString(), '3/4');
  assert.equal(Frac.parse('0.75').toString(), '3/4');
  assert.equal(Frac.parse('-2').toString(), '-2');
  assert.equal(Frac.parse('1,200').toString(), '1200');
  assert.equal(Frac.parse('−5/10').toString(), '-1/2');
  assert.equal(Frac.parse('abc'), null);
  assert.equal(Frac.parse('3/0'), null);
  assert.equal(Frac.parse('.'), null);
  assert.ok(new Frac(1, 3).add(new Frac(1, 6)).eq(new Frac(1, 2)));
  assert.throws(() => new Frac(1, 0));
});

test('numeric entry accepts equivalent answers and honors rounding', () => {
  assert.ok(SK.checkNumeric('2/4', '1/2'));
  assert.ok(SK.checkNumeric('0.5', '1/2'));
  assert.ok(!SK.checkNumeric('0.33', '1/3'));
  assert.ok(SK.checkNumeric('33.3', 33.33, 1));
  assert.ok(!SK.checkNumeric('33.4', 33.33, 1));
  assert.ok(!SK.checkNumeric('', '1'));
});

test('every question type marks right and wrong answers', () => {
  assert.ok(SK.isCorrect({ type: 'single', answer: 2 }, 2));
  assert.ok(!SK.isCorrect({ type: 'single', answer: 2 }, 1));
  assert.ok(SK.isCorrect({ type: 'se', answer: [1, 4] }, [4, 1]));
  assert.ok(!SK.isCorrect({ type: 'se', answer: [1, 4] }, [1]));
  assert.ok(SK.isCorrect({ type: 'tc', answer: [0, 2] }, [0, 2]));
  assert.ok(!SK.isCorrect({ type: 'tc', answer: [0, 2] }, [0, 1]));
  assert.ok(SK.isCorrect({ type: 'order', answer: ['a', 'b', 'c'] }, ['a', 'b', 'c']));
  assert.ok(SK.isCorrect({ type: 'gaps', answer: ['on', 'ter'] }, [' ON', 'ter ']));
  assert.ok(!SK.isCorrect({ type: 'single', answer: 0 }, undefined));
  assert.equal(SK.gapScore({ answer: ['a', 'b', 'c'] }, ['a', 'x', 'c']), 2);
});

test('shuffling keeps the right answer on the same text', () => {
  const r = SK.rng(1);
  const tc = { id: 't', type: 'tc', stem: 'a ___ b ___', blanks: [['x', 'y', 'z'], ['p', 'q', 'r']], answer: [0, 0] };
  const se = { id: 's', type: 'se', stem: 'a ___', choices: ['a', 'b', 'c', 'd', 'e', 'f'], answer: [0, 1] };
  for (let i = 0; i < 50; i++) {
    const a = SK.shuffleItem(r, tc);
    assert.deepEqual(a.blanks.map((b, k) => b[a.answer[k]]), ['x', 'p']);
    const b = SK.shuffleItem(r, se);
    assert.deepEqual(b.answer.map((k) => b.choices[k]).sort(), ['a', 'b']);
  }
  const o = SK.shuffleItem(r, { id: 'o', type: 'order', stem: '', answer: ['I', 'like', 'tea'] });
  assert.notDeepEqual(o.tiles, o.answer);
  assert.deepEqual([...o.tiles].sort(), ['I', 'like', 'tea'].sort());
});

test('the bank validator catches broken questions', () => {
  assert.equal(SK.validateItem({ id: 'a', type: 'single', stem: 'x', choices: ['a', 'b'], answer: 0 }).length, 0);
  assert.ok(SK.validateItem({ id: 'a', type: 'single', stem: 'x', choices: ['a', 'a'], answer: 0 }).length);
  assert.ok(SK.validateItem({ id: 'a', type: 'single', stem: 'x', choices: ['a', 'b'], answer: 5 }).length);
  assert.ok(SK.validateItem({ id: 'a', type: 'se', stem: 'x', choices: ['a', 'b', 'c', 'd', 'e', 'f'], answer: [0] }).length);
  assert.ok(SK.validateItem({ id: 'a', type: 'tc', stem: 'x ___', blanks: [['a', 'b', 'c']], answer: [0] }).length, 'one blank needs five options');
  assert.ok(SK.validateBank([{ id: 'a', type: 'text', stem: '', answer: 'x' }, { id: 'a', type: 'text', stem: '', answer: 'y' }]).length);
});

test('spaced repetition spaces reviews out and resets on a miss', () => {
  const now = Date.UTC(2026, 0, 1);
  let c = SK.srs.fresh('w');
  c = SK.srs.review(c, 4, now); assert.equal(c.interval, 1);
  c = SK.srs.review(c, 4, now); assert.equal(c.interval, 6);
  c = SK.srs.review(c, 4, now); assert.ok(c.interval > 6);
  const before = c.interval;
  c = SK.srs.review(c, 5, now); assert.ok(c.interval > before);
  c = SK.srs.review(c, 1, now); assert.equal(c.interval, 0); assert.equal(c.reps, 0); assert.equal(c.lapses, 1);
  assert.ok(c.ease >= 1.3);
  const deck = { a: Object.assign(SK.srs.fresh('a'), { due: now - 1 }), b: Object.assign(SK.srs.fresh('b'), { due: now + 1e9 }) };
  assert.deepEqual(SK.srs.queue(['a', 'b', 'c', 'd'], deck, now, 1), ['a', 'c']);
  for (let i = 0; i < 30; i++) c = SK.srs.review(c, 1, now);
  assert.equal(SK.round(c.ease, 2), 1.3, 'ease never drops below 1.3');
});

test('writing analysis counts what it should', () => {
  const s = 'The test was taken by many students. However, the results were surprising. For example, scores rose.\n\nIn conclusion, practice helps.';
  const a = SK.text.analyse(s);
  assert.equal(a.paragraphs, 2);
  assert.equal(a.sentences, 4);
  assert.ok(a.passive.some((p) => /was taken/i.test(p)));
  assert.ok(a.transitions.includes('however') && a.transitions.includes('for example') && a.transitions.includes('in conclusion'));
  assert.equal(SK.text.passive('She is in need of help. He was speeding.').length, 0, 'no false passives');
  assert.equal(SK.text.wordCount("It's a well-known fact: 3,000 people came."), 7);
  const d = SK.text.diff('the cat sat on the mat', 'the cat on a mat');
  assert.equal(d.parts.filter((p) => p[0] === 'missed').map((p) => p[1]).join(' '), 'sat the');
  assert.equal(d.accuracy, SK.round(4 / 6, 3));
});

test('Complete the Words blanks the second half of every second word after the first sentence', () => {
  const c = SK.cTest('Bees find flowers by color. They also use scent to find the nectar inside.', 10);
  assert.equal(c.parts[0], 'Bees find flowers by color. ');
  const filled = c.parts.map((p) => (typeof p === 'string' ? p : c.answer[p.gap])).join('');
  assert.equal(filled, 'Bees find flowers by color. They also use scent to find the nectar inside.');
  assert.ok(c.answer.length >= 3);
  for (const a of c.answer) assert.ok(a.length >= 1);
});

test('streaks and study plans', () => {
  assert.equal(SK.streak(['2026-03-01', '2026-03-02', '2026-03-03'], '2026-03-03'), 3);
  assert.equal(SK.streak(['2026-03-01', '2026-03-02'], '2026-03-03'), 2, 'today not done yet still counts yesterday');
  assert.equal(SK.streak(['2026-03-01'], '2026-03-05'), 0);
  assert.equal(SK.addDays('2026-02-27', 3), '2026-03-02');
  const plan = SK.planWeeks('2026-01-01', '2026-02-26', [{ name: 'Weak', weight: 4 }, { name: 'Strong', weight: 1 }], 8);
  assert.equal(plan.length, 8);
  assert.ok(plan.filter((w) => w.focus === 'Weak').length > plan.filter((w) => w.focus === 'Strong').length);
  assert.equal(plan[plan.length - 1].focus, 'Full practice tests and review');
  assert.deepEqual(SK.planWeeks('2026-01-05', '2026-01-01', [{ name: 'x', weight: 1 }], 5), []);
});

test('chart steps are round numbers', () => {
  assert.deepEqual([0.3, 3, 7, 13, 36, 180, 2400].map(SK.niceStep), [0.5, 5, 10, 20, 50, 200, 5000]);
});

test('weak areas rank the lowest accuracy first and ignore thin data', () => {
  const w = SK.weakAreas([{ exam: 'IELTS', byTopic: { Reading: { right: 2, total: 10 }, Listening: { right: 9, total: 10 }, Speaking: { right: 0, total: 1 } } }], 5);
  assert.deepEqual(w.map((x) => x.topic), ['IELTS Reading', 'IELTS Listening']);
});

// ---------- IELTS rules ----------
test('the overall band rounds .25 up to the half band and .75 up to the whole band', () => {
  assert.equal(I.overall([6, 6.5, 6, 6.5]), 6.5);     // mean 6.25
  assert.equal(I.overall([6.5, 6.5, 7, 7]), 7);       // mean 6.75
  assert.equal(I.overall([6, 6, 6, 6.5]), 6);         // mean 6.125
  assert.equal(I.overall([6.5, 6.5, 6.5, 7]), 6.5);   // mean 6.625
  assert.equal(I.overall([9, 9, 9, 9]), 9);
  assert.equal(I.overall([0, 0, 0, 0]), 0);
  assert.equal(I.overall([6, 6, 6]), null);
  assert.equal(I.overall([6, 6, 6, 6.3]), null);
  // brute force against the rule written a second way: nearest half, ties going up
  const halves = SK.range(19).map((x) => x / 2);
  for (const a of halves) for (const b of [4, 5.5, 7]) for (const c of [5, 6.5]) for (const d of [3, 6, 8.5]) {
    const mean = (a + b + c + d) / 4;
    assert.equal(I.overall([a, b, c, d]), Math.floor(mean * 2 + 0.5) / 2, [a, b, c, d].join(','));
  }
});
test('raw scores convert to bands with the approximate tables, and never go down as the raw score rises', () => {
  assert.equal(I.band(30, 'listening'), 7);
  assert.equal(I.band(30, 'academic'), 7);
  assert.equal(I.band(30, 'general'), 6);
  assert.equal(I.band(40, 'general'), 9);
  assert.equal(I.band(39, 'general'), 8.5);
  assert.equal(I.band(1, 'listening'), null);
  for (const t of ['listening', 'academic', 'general']) {
    let prev = -1;
    for (let r = 0; r <= 40; r++) { const b = I.band(r, t); const v = b === null ? 0 : b; assert.ok(v >= prev, t + ' ' + r); prev = v; }
    assert.equal(I.band(I.rawFor(7, t), t), 7);
  }
  assert.throws(() => I.band(20, 'nope'));
});
test('requirements: overall and every skill must be met', () => {
  const s = { listening: 7, reading: 6.5, writing: 5.5, speaking: 6.5 };
  assert.equal(I.meets(s, { overall: 6.5 }).ok, true);
  assert.equal(I.meets(s, { overall: 6.5, minimum: 6 }).ok, false);
  assert.deepEqual(I.meets(s, { overall: 6.5, minimum: 6 }).gaps, ['writing 5.5 < 6']);
  assert.equal(I.meets(s, { overall: 6, writing: 5.5 }).ok, true);
  assert.equal(I.cefr(7), 'C1');
});
test('word limits count words and numbers the way IELTS does', () => {
  const two = 'NO MORE THAN TWO WORDS AND/OR A NUMBER';
  assert.deepEqual(I.parseLimit(two), { words: 2, numbers: 1, only: false });
  assert.deepEqual(I.parseLimit('ONE WORD ONLY'), { words: 1, numbers: 0, only: true });
  assert.ok(I.fitsLimit('15 March', 'ONE WORD AND/OR A NUMBER').ok);
  assert.ok(I.fitsLimit('£45', 'ONE WORD AND/OR A NUMBER').ok);
  assert.ok(I.fitsLimit('well-known brand', two).ok);
  assert.ok(!I.fitsLimit('the old brand', two).ok);
  assert.ok(!I.fitsLimit('15 and 20', two).ok);
  assert.ok(!I.fitsLimit('library 2', 'ONE WORD ONLY').ok);
  assert.ok(!I.fitsLimit('', 'ONE WORD ONLY').ok);
  assert.ok(I.fitsLimit('7.30 pm', 'ONE WORD AND/OR A NUMBER').ok);
  assert.throws(() => I.parseLimit('write something'));
});
test('typed answers ignore case, spacing and a final full stop, and accept listed variants', () => {
  const q = { type: 'text', answer: '15 March', accept: I.dateAnswers(15, 2) };
  for (const a of ['15 march', ' 15  March ', '15th March', 'March 15', 'march 15th', '15 March.']) assert.ok(SK.isCorrect(q, a), a);
  assert.ok(!SK.isCorrect(q, '16 March'));
  assert.ok(SK.isCorrect({ type: 'text', answer: '1200' }, '1,200'));
  assert.ok(!SK.isCorrect({ type: 'text', answer: 'accommodation' }, 'accomodation'));
});
test('numbers, years, ordinals, digits and spelling are said the way people say them', () => {
  assert.equal(I.words(0), 'zero');
  assert.equal(I.words(15), 'fifteen');
  assert.equal(I.words(50), 'fifty');
  assert.equal(I.words(1215), 'one thousand two hundred and fifteen');
  assert.equal(I.words(3005), 'three thousand and five');
  assert.equal(I.year(1998), 'nineteen ninety-eight');
  assert.equal(I.year(2005), 'two thousand and five');
  assert.equal(I.year(2000), 'two thousand');
  assert.equal(I.year(2024), 'twenty twenty-four');
  assert.equal(I.year(1905), 'nineteen oh five');
  assert.equal(I.ordinal(1), 'first');
  assert.equal(I.ordinal(12), 'twelfth');
  assert.equal(I.ordinal(21), 'twenty-first');
  assert.equal(I.ordinal(30), 'thirtieth');
  assert.equal(I.saidDigits('07700 912 345'), 'oh double seven double oh, nine one two, three four five');
  assert.equal(I.saidDigits('777'), 'seven double seven');
  assert.equal(I.spell('Hargreaves'), 'H, A, R, G, R, E, A, V, E, S');
  assert.equal(I.spell('Hill'), 'H, I, double L');
  assert.equal(I.spell('BT7 3QL'), 'B, T, seven, space, three, Q, L');
  assert.equal(I.saidTime(7, 30), 'half past seven');
  assert.equal(I.saidTime(8, 45), 'quarter to nine');
  assert.equal(I.saidTime(12, 45), 'quarter to one');
  assert.equal(I.saidPrice(12, 50), 'twelve pounds fifty');
  assert.equal(I.saidPrice(1, 0), 'one pound');
  // every number from 0 to 9999 reads back to itself
  const back = (w) => { let total = 0, cur = 0; for (const t of w.replace(/-/g, ' ').split(' ')) { if (t === 'and') continue; if (t === 'hundred') cur *= 100; else if (t === 'thousand') { total += cur * 1000; cur = 0; } else { const k = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'].indexOf(t); cur += k >= 0 ? k : ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'].indexOf(t) * 10; } } return total + cur; };
  for (let n = 0; n <= 9999; n++) assert.equal(back(I.words(n)), n, String(n));
});
test('generated Part 1 calls say every answer, and every answer fits the word limit', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const kind of I.FORM_KINDS) {
      const c = I.formCall(seed, kind);
      const said = c.lines.map((l) => l[1]).join(' ').toLowerCase();
      assert.ok(c.questions.length >= 5);
      for (const q of c.questions) {
        assert.ok(SK.isCorrect(q, q.answer), kind + ' ' + q.answer);
        for (const a of q.accept) assert.ok(SK.isCorrect(q, a));
        assert.ok(I.fitsLimit(q.answer, q.limit).ok, kind + ': ' + q.answer + ' breaks ' + q.limit);
        // the answer is in the call, as words, spelled letters, or figures said aloud
        const a = String(q.answer).toLowerCase();
        const spelled = I.spell(q.answer).toLowerCase();
        const n = Number(a);
        const heard = said.includes(a) || said.includes(spelled) || (Number.isInteger(n) && n < 1000000 && said.includes(I.words(n))) ||
          q.accept.some((x) => said.includes(String(x).toLowerCase())) || /\d/.test(a);
        assert.ok(heard, kind + ' never says ' + q.answer);
      }
    }
  }
});
test('numbers, spelling and distractor items give a markable answer that differs from the trap', () => {
  const r = SK.rng(9);
  for (let i = 0; i < 400; i++) {
    for (const it of [I.numberItem(r), I.spellItem(r), I.distractorItem(r)]) {
      assert.ok(SK.isCorrect(it, it.answer), it.id);
      assert.ok(it.say || it.lines);
      if (it.wrong) assert.ok(!SK.isCorrect(it, it.wrong), it.id + ' trap marks as right');
    }
  }
  for (const k of I.NUMBER_KINDS) assert.ok(SK.isCorrect(I.numberItem(SK.rng(3), k), I.numberItem(SK.rng(3), k).answer));
});
test('maps: each asked place has one letter, the letters are unique, and the description names its slot', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const m = I.mapPuzzle(seed);
    const letters = Object.values(m.letters);
    assert.equal(new Set(letters).size, letters.length);
    assert.equal(m.questions.length, 5);
    for (const q of m.questions) {
      const L = q.choices[q.answer];
      const slot = Object.keys(m.letters).find((s) => m.letters[s] === L);
      assert.ok(slot && q.stem.includes(m.slots[slot]), 'map ' + seed);
      assert.equal(m.figure.labels[slot], L);
    }
    for (const s of m.landmarks) assert.equal(m.figure.labels[s], m.slots[s]);
  }
});
test('chart facts are true of the numbers, and false ones are not', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const kind of ['line', 'bar', 'table', 'pie']) {
      const d = I.chartData(seed, kind);
      assert.equal(d.series.length, d.names.length);
      for (const s of d.series) assert.equal(s.values.length, d.xs.length);
      if (kind === 'pie') for (let j = 0; j < d.xs.length; j++) assert.equal(SK.sum(d.series.map((s) => s.values[j])), 100);
      const f = I.facts(d);
      for (const t of f.true) assert.ok(!f.false.includes(t));
      for (const t of f.true.concat(f.false)) {
        const m = t.match(/^In (\d+), (.+) had the highest figure\.$/);
        if (!m) continue;
        const j = d.xs.indexOf(m[1]);
        const top = Math.max(...d.series.map((s) => s.values[j]));
        const isTop = d.series.find((s) => s.name === m[2]).values[j] === top;
        assert.equal(isTop, f.true.includes(t), t);
      }
    }
  }
});
test('change and proportion language matches the size of the change', () => {
  assert.equal(I.describeChange(100, 102).verb, 'remained stable');
  assert.deepEqual(I.describeChange(100, 110), { verb: 'rose', adverb: 'slightly', size: 'small' });
  assert.equal(I.describeChange(100, 70).adverb, 'steadily');
  assert.equal(I.describeChange(100, 160).adverb, 'sharply');
  assert.equal(I.describeChange(100, 250).verb, 'more than doubled');
  assert.equal(I.approx(26), 'just over a quarter');
  assert.equal(I.approx(32), 'just under a third');
  assert.equal(I.approx(50), 'exactly half');
  assert.equal(I.approx(74), 'just under three quarters');
  assert.equal(I.approx(45), null);
  const r = SK.rng(4);
  for (let i = 0; i < 300; i++) {
    const t = I.trendItem(r), a = I.approxItem(r);
    for (const it of [t, a]) { assert.equal(SK.validateItem(it).length, 0, JSON.stringify(SK.validateItem(it))); assert.ok(SK.isCorrect(it, 0)); }
  }
});

// ---------- word quizzes ----------
test('word quizzes have one right meaning and blank the word in its sentence', () => {
  const words = [
    { id: 'a', w: 'abate', pos: 'verb', d: 'to lessen', e: 'The storm abated by noon.', syn: ['subside'] },
    { id: 'b', w: 'laud', pos: 'verb', d: 'to praise', e: 'Critics lauded the film.', syn: ['praise'] },
    { id: 'c', w: 'shun', pos: 'verb', d: 'to avoid', e: 'They shunned the press.', syn: ['avoid'] },
    { id: 'd', w: 'mollify', pos: 'verb', d: 'to calm', e: 'An apology mollified her.', syn: ['placate'] },
    { id: 'e', w: 'goad', pos: 'verb', d: 'to provoke', e: 'They goaded him on.', syn: ['prod'] },
    { id: 'f', w: 'heed', pos: 'verb', d: 'to pay attention to', e: 'Heed the warning.', syn: ['mind'] }];
  assert.equal(SK.blankOut('The storm abated by noon.', 'abate'), 'The storm _____ by noon.');
  assert.equal(SK.blankOut('No match here.', 'abate'), null);
  for (const kind of ['meaning', 'word', 'blank', 'synonym']) {
    for (let s = 1; s < 30; s++) {
      const it = SK.wordItem(SK.rng(s), words, words[0], kind);
      assert.equal(it.choices.length, 5);
      assert.equal(new Set(it.choices).size, 5);
      const right = it.choices[it.answer];
      assert.ok({ meaning: 'to lessen', word: 'abate', blank: 'abate', synonym: 'subside' }[kind] === right, kind + ' gave ' + right);
    }
  }
});

// ---------- reading question groups ----------
test('every reading group keeps the right answer pointing at the right option after shuffling', () => {
  const p = { id: 'p', title: 'T', paragraphs: ['One a.', 'Two b.', 'Three c.'], headings: { list: ['H1', 'H2', 'H3', 'X1', 'X2'], answer: [0, 1, 2] },
    info: [{ s: 'a thing', p: 2 }], endings: { starts: ['S1', 'S2'], ends: ['E1', 'E2', 'E3', 'E4'], answer: [1, 0] },
    summary: { text: 'A [1] and [2].', box: ['w1', 'w2', 'w3', 'w4'], answers: ['w2', 'w4'] }, short: [{ q: 'Q?', a: 'three' }],
    mcq: [{ stem: 'M?', choices: ['right', 'w1', 'w2', 'w3'], answer: 0 }], tfng: [{ s: 'S', a: 'Not Given' }] };
  for (let seed = 1; seed < 60; seed++) {
    const set = I.passageSet(p, Object.keys(I.groups), seed);
    const by = (t) => set.questions.filter((q) => q.topic === t);
    by('Matching headings').forEach((q, k) => assert.equal(q.choices[q.answer].split('. ')[1], p.headings.list[p.headings.answer[k]]));
    assert.equal(by('Matching information')[0].choices[by('Matching information')[0].answer], 'C');
    by('Sentence endings').forEach((q, k) => assert.equal(q.choices[q.answer], p.endings.ends[p.endings.answer[k]]));
    by('Summary completion').forEach((q, k) => assert.equal(q.choices[q.answer], p.summary.answers[k]));
    const m = by('Multiple choice')[0]; assert.equal(m.choices[m.answer], 'right');
    const t = by('True / False / Not Given')[0]; assert.equal(t.choices[t.answer], 'Not Given');
    for (const q of set.questions) { assert.deepEqual(SK.validateItem(q), [], q.id); assert.ok(SK.isCorrect(q, q.answer)); }
    assert.ok(set.passage.startsWith('**A** One a.'));
  }
});
