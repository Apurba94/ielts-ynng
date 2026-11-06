/* sk-ielts.js: IELTS rules and generated practice, with no page code, so Node can test it.
   Band tables, the overall band rounding rule, word limits, spoken numbers and dates, spelled names,
   Part 1 form calls, maps, distractors and the data behind Writing Task 1 charts. */
(function (root) {
  'use strict';
  const SK = root.SK || require('./sk-core.js');
  const I = (SK.ielts = {});

  // ---------- band scores ----------
  // Raw score (out of 40) to band. These are the approximate tables IELTS publishes as a guide; the exact
  // boundaries vary a little from one test version to another, so the apps always call the result approximate.
  I.TABLES = {
    listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
    academic: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
    general: [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5]],
  };
  // null means below the bottom of the published guide.
  I.band = function (raw, kind) {
    const t = I.TABLES[kind];
    if (!t) throw new Error('unknown table ' + kind);
    raw = Math.max(0, Math.min(40, Math.round(raw)));
    for (const [min, b] of t) if (raw >= min) return b;
    return null;
  };
  // The raw scores that give a band, for showing "you need about 30 of 40".
  I.rawFor = function (band, kind) {
    const row = I.TABLES[kind].find((r) => r[1] === band);
    return row ? row[0] : null;
  };
  // Overall band: the mean of the four skills, rounded to the nearest half band. A mean ending in .25 goes up to
  // the next half band and one ending in .75 goes up to the next whole band (6.25 -> 6.5, 6.75 -> 7).
  I.overall = function (bands) {
    if (bands.length !== 4 || bands.some((b) => typeof b !== 'number' || b < 0 || b > 9 || Math.round(b * 2) !== b * 2)) return null;
    const mean = SK.sum(bands) / 4;
    const whole = Math.floor(mean), frac = SK.round(mean - whole, 4);
    return frac < 0.25 ? whole : frac < 0.75 ? whole + 0.5 : whole + 1;
  };
  I.isBand = (b) => typeof b === 'number' && b >= 0 && b <= 9 && Math.round(b * 2) === b * 2;
  // CEFR levels that IELTS maps its bands to (a broad guide).
  I.cefr = (b) => (b >= 8.5 ? 'C2' : b >= 7 ? 'C1' : b >= 5.5 ? 'B2' : b >= 4 ? 'B1' : 'below B1');
  // Does a set of scores meet a requirement such as overall 6.5 with no skill below 6?
  I.meets = function (scores, req) {
    const gaps = [];
    const ov = I.overall([scores.listening, scores.reading, scores.writing, scores.speaking]);
    if (req.overall && (ov === null || ov < req.overall)) gaps.push('overall ' + (ov === null ? '?' : ov) + ' < ' + req.overall);
    for (const k of ['listening', 'reading', 'writing', 'speaking']) {
      const need = req[k] !== undefined && req[k] !== null && req[k] !== '' ? req[k] : req.minimum;
      if (need && !(scores[k] >= need)) gaps.push(k + ' ' + (scores[k] === undefined ? '?' : scores[k]) + ' < ' + need);
    }
    return { ok: gaps.length === 0, overall: ov, gaps };
  };

  // ---------- word limits ----------
  const NUMWORDS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4 };
  // "NO MORE THAN TWO WORDS AND/OR A NUMBER" -> { words: 2, numbers: 1 }; "ONE WORD ONLY" -> { words: 1, numbers: 0 }
  I.parseLimit = function (instr) {
    const s = String(instr).toUpperCase();
    const m = s.match(/(ONE|TWO|THREE|FOUR) WORDS?/);
    const words = m ? NUMWORDS[m[1]] : 0;
    const numbers = /A NUMBER/.test(s) ? 1 : 0;
    if (!words && !numbers) throw new Error('not a word limit: ' + instr);
    return { words, numbers, only: /ONLY/.test(s) };
  };
  // Split an answer into words and numbers as IELTS counts them: a hyphenated word is one word, a number written
  // in figures (15, 1,200, 7.30, 15th) is a number, and a symbol such as £ or % belongs to its number.
  I.tokens = function (answer) {
    const out = { words: [], numbers: [] };
    let prevNum = '';
    for (const t of String(answer).trim().split(/\s+/).filter(Boolean)) {
      const c = t.replace(/^[£$€(]+|[).,;:!?]+$/g, '');
      if (!c) continue;
      // Figures, and codes with figures in them such as a postcode, count as one number; a postcode's two halves are one code.
      if (/^\d[\d,.:/]*(st|nd|rd|th|%|am|pm)?$/i.test(c) || /^[A-Z]*\d[A-Z0-9]*$/i.test(c)) {
        if (prevNum && /[A-Z]/i.test(c + prevNum)) out.numbers[out.numbers.length - 1] += ' ' + c; else out.numbers.push(c);
        prevNum = c;
      } else { out.words.push(c); prevNum = ''; }
    }
    return out;
  };
  I.fitsLimit = function (answer, instr) {
    const lim = typeof instr === 'string' ? I.parseLimit(instr) : instr;
    const t = I.tokens(answer);
    let words = t.words.length, numbers = t.numbers.length;
    if (!lim.numbers) { words += numbers; numbers = 0; }   // with no number allowed, a figure counts as a word
    const ok = words <= lim.words && numbers <= lim.numbers && words + numbers > 0;
    let why = '';
    if (words + numbers === 0) why = 'There is no answer.';
    else if (numbers > lim.numbers) why = 'It has ' + numbers + ' numbers; only ' + lim.numbers + ' is allowed.';
    else if (words > lim.words) why = 'It has ' + words + ' word' + (words === 1 ? '' : 's') + '; the limit is ' + lim.words + '.';
    return { ok, words, numbers, why: ok ? 'It fits the limit.' : why };
  };

  // ---------- numbers, dates and times as they are spoken ----------
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  I.words = function (n) {
    if (!Number.isInteger(n) || n < 0 || n > 999999) throw new Error('out of range ' + n);
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + I.words(n % 100) : '');
    const th = Math.floor(n / 1000), rest = n % 1000;
    return I.words(th) + ' thousand' + (rest ? (rest < 100 ? ' and ' : ' ') + I.words(rest) : '');
  };
  // Years: 1998 -> nineteen ninety-eight, 2005 -> two thousand and five, 2024 -> twenty twenty-four.
  I.year = function (y) {
    if (y >= 2000 && y < 2010) return 'two thousand' + (y % 10 ? ' and ' + ONES[y % 10] : '');
    const hi = Math.floor(y / 100), lo = y % 100;
    return I.words(hi) + ' ' + (lo === 0 ? 'hundred' : lo < 10 ? 'oh ' + ONES[lo] : I.words(lo));
  };
  const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
  I.ordinal = function (n) {
    const w = I.words(n);
    const parts = w.split(/([ -])/);
    const last = parts[parts.length - 1];
    parts[parts.length - 1] = ORD[last] || (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th');
    return parts.join('');
  };
  I.suffix = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  I.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // Every way a test taker might write a date; all are accepted as long as the date is right.
  I.dateAnswers = function (d, m) {
    const M = I.MONTHS[m], s = d + I.suffix(d);
    return [d + ' ' + M, s + ' ' + M, M + ' ' + d, M + ' ' + s, 'the ' + s + ' of ' + M, s + ' of ' + M, d + ' ' + M.slice(0, 3), M.slice(0, 3) + ' ' + d];
  };
  I.saidDate = (d, m, r) => (r && r() < 0.5 ? 'the ' + I.ordinal(d) + ' of ' + I.MONTHS[m] : I.MONTHS[m] + ' the ' + I.ordinal(d));
  // Times on a 12-hour clock: 7.30 is said "half past seven" or "seven thirty".
  I.saidTime = function (h, min, r) {
    const next = h === 12 ? 1 : h + 1;
    const style = r ? r() : 0;
    if (min === 0) return ONES[h] + " o'clock";
    if (style < 0.5 && min === 30) return 'half past ' + ONES[h];
    if (style < 0.5 && min === 15) return 'quarter past ' + ONES[h];
    if (style < 0.5 && min === 45) return 'quarter to ' + (next < 20 ? ONES[next] : I.words(next));
    return I.words(h) + ' ' + (min < 10 ? 'oh ' + ONES[min] : I.words(min));
  };
  I.timeAnswers = (h, min) => { const mm = String(min).padStart(2, '0'); return [h + '.' + mm, h + ':' + mm, h + '.' + mm + ' am', h + '.' + mm + ' pm', h + ':' + mm + ' am', h + ':' + mm + ' pm'].concat(min === 0 ? [String(h), h + ' am', h + ' pm', h + " o'clock"] : []); };
  // Phone numbers are read digit by digit, with "oh" for 0 and "double" for a repeated digit.
  I.saidDigits = function (digits) {
    const name = (c) => (c === '0' ? 'oh' : ONES[Number(c)]);
    const groups = digits.split(' ');
    return groups.map((g) => {
      const out = [];
      for (let i = 0; i < g.length; i++) {
        if (i + 1 < g.length && g[i] === g[i + 1] && !(i + 2 < g.length && g[i + 2] === g[i])) { out.push('double ' + name(g[i])); i++; } else out.push(name(g[i]));
      }
      return out.join(' ');
    }).join(', ');
  };
  I.saidPrice = function (pounds, pence) {
    return I.words(pounds) + (pounds === 1 ? ' pound' : ' pounds') + (pence ? ' ' + I.words(pence) : '');
  };
  I.priceAnswers = (pounds, pence) => {
    const p = pence ? pounds + '.' + String(pence).padStart(2, '0') : String(pounds);
    return [p, '£' + p, p + ' pounds'].concat(pence ? [] : [p + '.00', '£' + p + '.00']).concat(pounds >= 1000 ? [p.replace(/^(\d+)(\d{3})/, '$1,$2'), '£' + p.replace(/^(\d+)(\d{3})/, '$1,$2')] : []);
  };
  // Letters spelled out, as a receptionist would: "T, H, O, double R, ..."
  I.spell = function (word) {
    const ch = String(word).toUpperCase().replace(/[^A-Z0-9 @.-]/g, '').split('');
    const out = [];
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i];
      if (c === ' ') { out.push('space'); continue; }
      const say = c === '@' ? 'at' : c === '.' ? 'dot' : c === '-' ? 'hyphen' : /\d/.test(c) ? (c === '0' ? 'zero' : ONES[Number(c)]) : c;
      if (i + 1 < ch.length && ch[i + 1] === c && /[A-Z0-9]/.test(c)) { out.push('double ' + say); i++; } else out.push(say);
    }
    return out.join(', ');
  };

  // ---------- pools for generated calls ----------
  I.SURNAMES = ['Thornton', 'Gallagher', 'Whitmore', 'Prescott', 'Ashworth', 'Fenwick', 'Moreland', 'Kowalski', 'Okafor', 'Lindqvist', 'Hargreaves', 'Beaumont', 'Caldwell', 'Pemberton', 'Rossiter', 'Delaney', 'Fairbanks', 'Yardley', 'Quinlan', 'Vasquez', 'Harrington', 'Mulholland', 'Brannigan', 'Ellwood', 'Kirkpatrick', 'Sorensen', 'Abernethy', 'Mackenzie', 'Pellegrino', 'Waddington'];
  I.FIRST = ['Sarah', 'Daniel', 'Priya', 'Tomas', 'Aisha', 'Liam', 'Mei', 'Oliver', 'Fatima', 'Jonas', 'Hannah', 'Kwame', 'Elena', 'Raj', 'Chloe', 'Marcus'];
  I.STREETS = ['Harbour Road', 'Elm Grove', 'Station Street', 'Kingsley Avenue', 'Mill Lane', 'Church Close', 'Park Crescent', 'Riverside Drive', 'Beacon Hill', 'Orchard Way', 'Fernley Road', 'Granby Terrace'];
  const pickWord = (r, list) => list[Math.floor(r() * list.length)];
  const letter = (r, avoid) => { let c; do { c = 'ABCDEFGHJKLMNPRSTUWY'[Math.floor(r() * 20)]; } while (avoid && avoid.includes(c)); return c; };
  I.postcode = (r) => letter(r) + letter(r) + SK.randInt(r, 1, 19) + ' ' + SK.randInt(r, 1, 9) + letter(r, 'CIKMOV') + letter(r, 'CIKMOV');
  I.phone = (r) => '0' + SK.randInt(r, 1, 9) + String(SK.randInt(r, 100, 999)) + ' ' + String(SK.randInt(r, 100, 999)) + ' ' + String(SK.randInt(r, 100, 999));

  // ---------- Part 1 form completion: a generated phone call with a form to fill ----------
  // Each scenario returns { title, staff, caller, lines, fields: [{ label, answer, accept, say }] }.
  // Spoken values come from the same numbers as the answers, so a call can never disagree with its key.
  const SCENARIOS = {
    cottage(r, nm) {
      const d = SK.randInt(r, 2, 28), m = SK.randInt(r, 0, 11), nights = SK.randInt(r, 2, 9), price = SK.randInt(r, 9, 39) * 10, extra = pickWord(r, ['cot', 'parking', 'bicycles', 'dog', 'heater']);
      const wrongD = d === 28 ? d - 1 : d + 1;
      return { title: 'Booking a holiday cottage', staff: 'Agent', place: 'Seaview Cottages', fields: [
        { label: 'Surname', answer: nm.last, ask: ["Can I take your surname, please?", 'Yes, it\'s ' + nm.last + '. That\'s ' + I.spell(nm.last) + '.'] },
        { label: 'Arrival date', answer: d + ' ' + I.MONTHS[m], accept: I.dateAnswers(d, m), ask: ['And when would you like to arrive?', 'On ' + I.saidDate(wrongD, m, r) + '. Oh no, sorry, I mean ' + I.saidDate(d, m, r) + '. The day before.'] },
        { label: 'Number of nights', answer: String(nights), accept: [I.words(nights)], ask: ['How long will you be staying?', I.words(nights) + ' nights, please.'] },
        { label: 'Total cost: £', answer: String(price), accept: I.priceAnswers(price, 0), ask: ['That comes to ' + I.saidPrice(price, 0) + ' in total, including cleaning.', 'That\'s fine.'] },
        { label: 'Special request: a', answer: extra, ask: ['Is there anything else you need?', extra === 'dog' ? 'We\'d like to bring our dog, if that\'s allowed.' : extra === 'cot' ? 'Yes, we need a cot for the baby.' : extra === 'parking' ? 'Just parking for one car, please.' : extra === 'bicycles' ? 'Could we hire two bicycles?' : 'A heater for the bedroom, as it gets cold.'] },
        { label: 'Phone', answer: nm.phone.replace(/ /g, ''), accept: [nm.phone], ask: ['And a contact number?', 'It\'s ' + I.saidDigits(nm.phone) + '.'] },
      ] };
    },
    gym(r, nm) {
      const num = SK.randInt(r, 2, 199), street = pickWord(r, I.STREETS), type = pickWord(r, ['off-peak', 'student', 'family', 'weekend']), fee = SK.randInt(r, 18, 49), pence = pickWord(r, [0, 50, 99]);
      const d = SK.randInt(r, 1, 28), m = SK.randInt(r, 0, 11);
      return { title: 'Joining a sports centre', staff: 'Receptionist', place: 'Lakeside Sports Centre', fields: [
        { label: 'Name', stem: 'Name: ' + nm.first + ' ___', answer: nm.last, ask: ['Could I have your full name?', nm.first + ' ' + nm.last + '. The surname is ' + I.spell(nm.last) + '.'] },
        { label: 'Address', stem: 'Address: ' + num + ' ___ ' + street.split(' ')[1], answer: street.split(' ')[0], ask: ['And your address?', I.words(num) + ' ' + street + '. ' + street.split(' ')[0] + ' is spelled ' + I.spell(street.split(' ')[0]) + '.'] },
        { label: 'Postcode', answer: nm.post, accept: [nm.post.replace(' ', '')], ask: ['Postcode?', I.spell(nm.post) + '.'] },
        { label: 'Type of membership', answer: type, ask: ['Which membership would you like? We have standard, off-peak, student, family and weekend.', type === 'off-peak' ? 'Off-peak, I think, as I can only come during the day.' : type === 'student' ? 'I\'m at the college, so student, please.' : type === 'family' ? 'Family, as my two children want to swim too.' : 'Just weekends. I work long hours in the week.'] },
        { label: 'Monthly fee: £', answer: fee + (pence ? '.' + String(pence).padStart(2, '0') : ''), accept: I.priceAnswers(fee, pence), ask: ['That one is ' + I.saidPrice(fee, pence) + ' a month.', 'Okay.'] },
        { label: 'Start date', answer: d + ' ' + I.MONTHS[m], accept: I.dateAnswers(d, m), ask: ['When would you like to start?', 'From ' + I.saidDate(d, m, r) + ', if possible.'] },
      ] };
    },
    lost(r, nm) {
      const item = pickWord(r, ['rucksack', 'umbrella', 'suitcase', 'jacket', 'camera']), colour = pickWord(r, ['navy', 'green', 'grey', 'yellow', 'brown', 'purple']), h = SK.randInt(r, 6, 11), min = pickWord(r, [15, 30, 45, 5, 20]), inside = pickWord(r, ['passport', 'keys', 'glasses', 'notebook', 'charger']), coach = SK.randInt(r, 2, 9);
      return { title: 'Reporting lost property', staff: 'Officer', place: 'the railway lost property office', fields: [
        { label: 'Item lost', answer: item, ask: ['What have you lost?', 'A ' + item + '. I left it on the train this morning.'] },
        { label: 'Colour', answer: colour, ask: ['What colour is it?', 'It\'s ' + colour + ', with a small black label.'] },
        { label: 'Train time: a.m.', answer: h + '.' + String(min).padStart(2, '0'), accept: I.timeAnswers(h, min), ask: ['Which train were you on?', 'The ' + I.saidTime(h, min, r) + ' from the airport.'] },
        { label: 'Coach (carriage) number', answer: String(coach), accept: [I.words(coach)], ask: ['Do you remember the carriage?', 'Coach ' + I.words(coach) + ', near the front.'] },
        { label: 'Contents include', answer: inside, ask: ['Is there anything valuable in it?', 'My ' + inside + ' is inside, so I really need it back.'] },
        { label: 'Surname', answer: nm.last, ask: ['And your surname?', I.spell(nm.last) + '.'] },
      ] };
    },
    course(r, nm) {
      const course = pickWord(r, ['photography', 'Spanish', 'pottery', 'cookery', 'guitar']), day = pickWord(r, ['Monday', 'Tuesday', 'Wednesday', 'Thursday']), other = pickWord(r, ['Friday', 'Saturday']), h = SK.randInt(r, 6, 8), weeks = SK.randInt(r, 6, 12), fee = SK.randInt(r, 6, 19) * 10;
      return { title: 'Enrolling on an evening class', staff: 'Adviser', place: 'Northfield Adult College', fields: [
        { label: 'Course', answer: course, ask: ['Which course are you interested in?', course + '. I\'ve always wanted to learn.'] },
        { label: 'Day', answer: day, ask: ['It runs on ' + other + ' mornings and ' + day + ' evenings. The ' + other + ' class is full, I\'m afraid.', 'Then ' + day + ' is fine.'] },
        { label: 'Start time: p.m.', answer: h + '.30', accept: I.timeAnswers(h, 30), ask: ['It starts at ' + I.saidTime(h, 30, r) + '.', 'Perfect.'] },
        { label: 'Length of course: weeks', answer: String(weeks), accept: [I.words(weeks)], ask: ['And it lasts ' + I.words(weeks) + ' weeks.', 'Great.'] },
        { label: 'Fee: £', answer: String(fee), accept: I.priceAnswers(fee, 0), ask: ['The fee is ' + I.saidPrice(fee, 0) + ', and materials are included.', 'That\'s reasonable.'] },
        { label: 'Surname', answer: nm.last, ask: ['Can I take your surname?', nm.last + ': ' + I.spell(nm.last) + '.'] },
      ] };
    },
    flat(r, nm) {
      const beds = SK.randInt(r, 1, 3), rent = SK.randInt(r, 55, 140) * 10, area = pickWord(r, ['Westbury', 'Holloway', 'Ashford', 'Greenhill', 'Southgate']), d = SK.randInt(r, 1, 28), m = SK.randInt(r, 0, 11), need = pickWord(r, ['garden', 'balcony', 'garage', 'lift']);
      return { title: 'Looking for a flat', staff: 'Agent', place: 'City Lettings', fields: [
        { label: 'Surname', answer: nm.last, ask: ['Let me take your details. Surname?', nm.last + '. ' + I.spell(nm.last) + '.'] },
        { label: 'Number of bedrooms', answer: String(beds), accept: [I.words(beds)], ask: ['How many bedrooms?', I.words(beds) + (beds === 1 ? ' bedroom' : ' bedrooms') + ' would be enough.'] },
        { label: 'Maximum rent per month: £', answer: String(rent), accept: I.priceAnswers(rent, 0), ask: ['What\'s your budget?', 'No more than ' + I.saidPrice(rent, 0) + ' a month.'] },
        { label: 'Preferred area', answer: area, ask: ['Any particular area?', area + ', as it\'s close to my work. That\'s ' + I.spell(area) + '.'] },
        { label: 'Must have a', answer: need, ask: ['Anything you must have?', 'A ' + need + '. That\'s essential for me.'] },
        { label: 'Move-in date', answer: d + ' ' + I.MONTHS[m], accept: I.dateAnswers(d, m), ask: ['When do you need to move?', 'By ' + I.saidDate(d, m, r) + '.'] },
      ] };
    },
    party(r, nm) {
      const guests = SK.randInt(r, 12, 60), d = SK.randInt(r, 1, 28), m = SK.randInt(r, 0, 11), h = SK.randInt(r, 6, 8), diet = pickWord(r, ['vegetarian', 'vegan', 'halal']), deposit = SK.randInt(r, 5, 20) * 10;
      return { title: 'Booking a room for a party', staff: 'Manager', place: 'The Old Mill Restaurant', fields: [
        { label: 'Name', answer: nm.last, ask: ['What name is it under?', nm.last + '. ' + I.spell(nm.last) + '.'] },
        { label: 'Date', answer: d + ' ' + I.MONTHS[m], accept: I.dateAnswers(d, m), ask: ['Which date?', I.saidDate(d, m, r) + '.'] },
        { label: 'Number of guests', answer: String(guests), accept: [I.words(guests)], ask: ['How many guests?', 'About ' + I.words(guests + 5) + '. No, wait, ' + I.words(guests) + ' have replied, so ' + I.words(guests) + '.'] },
        { label: 'Arrival time: p.m.', answer: h + '.00', accept: I.timeAnswers(h, 0), ask: ['What time will people arrive?', 'At ' + I.saidTime(h, 0, r) + '.'] },
        { label: 'Food: some guests need', answer: diet, ask: ['Any special food?', 'Several guests are ' + diet + '.'] },
        { label: 'Deposit: £', answer: String(deposit), accept: I.priceAnswers(deposit, 0), ask: ['We ask for a deposit of ' + I.saidPrice(deposit, 0) + '.', 'I can pay that now.'] },
      ] };
    },
  };
  I.FORM_KINDS = Object.keys(SCENARIOS);
  I.formCall = function (seed, kind) {
    const r = SK.rng(seed);
    kind = kind || SK.pick(r, I.FORM_KINDS);
    const nm = { first: SK.pick(r, I.FIRST), last: SK.pick(r, I.SURNAMES), phone: I.phone(r), post: I.postcode(r) };
    const sc = SCENARIOS[kind](r, nm);
    const lines = [[sc.staff, 'Good morning, ' + sc.place + '. How can I help?'], ['Caller', 'Hello. I\'m calling about ' + sc.title.toLowerCase().replace(/^\w+ing /, (w) => w) + '.']];
    for (const f of sc.fields) { lines.push([sc.staff, f.ask[0]]); lines.push(['Caller', f.ask[1]]); }
    lines.push([sc.staff, 'Thank you. That\'s all done.']);
    return {
      id: 'form-' + kind + '-' + seed, title: sc.title, kind, lines,
      questions: sc.fields.map((f, k) => ({ id: 'form-' + kind + '-' + seed + '-' + k, type: 'text', stem: f.stem || f.label + ' ___', answer: f.answer, accept: f.accept || [], limit: 'ONE WORD AND/OR A NUMBER', topic: 'Form completion', explanation: 'You heard: "' + f.ask[0] + ' ' + f.ask[1] + '"' })),
    };
  };

  // ---------- numbers, dates and spelling drills ----------
  I.NUMBER_KINDS = ['phone', 'price', 'year', 'date', 'time', 'large', 'teens', 'percent'];
  I.numberItem = function (r, kind) {
    kind = kind || SK.pick(r, I.NUMBER_KINDS);
    let say, answer, accept = [];
    if (kind === 'phone') { const p = I.phone(r); say = 'My number is ' + I.saidDigits(p) + '.'; answer = p.replace(/ /g, ''); accept = [p]; }
    else if (kind === 'price') { const a = SK.randInt(r, 2, 480), pc = SK.pick(r, [0, 25, 50, 75, 95, 99]); say = 'It costs ' + I.saidPrice(a, pc) + '.'; answer = pc ? a + '.' + String(pc).padStart(2, '0') : String(a); accept = I.priceAnswers(a, pc); }
    else if (kind === 'year') { const y = SK.pick(r, [SK.randInt(r, 1801, 1999), SK.randInt(r, 2000, 2009), SK.randInt(r, 2010, 2035)]); say = 'It was built in ' + I.year(y) + '.'; answer = String(y); }
    else if (kind === 'date') { const d = SK.randInt(r, 1, 31), m = SK.randInt(r, 0, 11); const dd = Math.min(d, [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]); say = 'The deadline is ' + I.saidDate(dd, m, r) + '.'; answer = dd + ' ' + I.MONTHS[m]; accept = I.dateAnswers(dd, m); }
    else if (kind === 'time') { const h = SK.randInt(r, 1, 12), mi = SK.pick(r, [0, 5, 10, 15, 20, 30, 40, 45, 50]); say = 'The coach leaves at ' + I.saidTime(h, mi, r) + '.'; answer = h + '.' + String(mi).padStart(2, '0'); accept = I.timeAnswers(h, mi); }
    else if (kind === 'large') { const n = SK.randInt(r, 11, 999) * SK.pick(r, [10, 100]); say = 'About ' + I.words(n) + ' people visit every year.'; answer = String(n); accept = [String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')]; }
    else if (kind === 'teens') { const t = SK.randInt(r, 3, 9); const n = SK.pick(r, [10 + t, t * 10]); say = 'There are ' + I.words(n) + ' places left on the course.'; answer = String(n); accept = [I.words(n)]; }
    else { const n = SK.randInt(r, 2, 98); say = 'Sales rose by ' + I.words(n) + ' per cent last year.'; answer = n + '%'; accept = [String(n), n + ' per cent', n + ' percent']; }
    return { id: 'num-' + kind + '-' + answer, type: 'text', topic: kind[0].toUpperCase() + kind.slice(1), say, stem: 'Write the ' + { phone: 'phone number', price: 'price in pounds', year: 'year', date: 'date', time: 'time', large: 'number', teens: 'number', percent: 'percentage' }[kind] + ' you hear, in figures.', answer, accept, explanation: 'You heard: "' + say + '"' };
  };
  I.SPELL_KINDS = ['surname', 'postcode', 'reference', 'street', 'email'];
  I.spellItem = function (r, kind) {
    kind = kind || SK.pick(r, I.SPELL_KINDS);
    let ans;
    if (kind === 'surname') ans = SK.pick(r, I.SURNAMES);
    else if (kind === 'postcode') ans = I.postcode(r);
    else if (kind === 'reference') ans = letter(r) + letter(r) + SK.randInt(r, 100, 999) + letter(r);
    else if (kind === 'street') ans = SK.pick(r, I.STREETS).split(' ')[0];
    else ans = SK.pick(r, I.FIRST).toLowerCase() + '.' + SK.pick(r, I.SURNAMES).toLowerCase() + '@' + SK.pick(r, ['mailbox', 'webpost', 'quickmail']) + '.com';
    const lead = { surname: 'My surname is', postcode: 'The postcode is', reference: 'Your booking reference is', street: 'The street name is', email: 'My email address is' }[kind];
    return { id: 'sp-' + kind + '-' + ans, type: 'text', topic: kind[0].toUpperCase() + kind.slice(1), say: lead + ' ' + I.spell(ans) + '.', stem: 'Type the ' + kind + ' exactly as it is spelled.', answer: ans, accept: kind === 'postcode' ? [ans.replace(' ', '')] : [], explanation: 'Spelled: ' + I.spell(ans) };
  };

  // ---------- distractors: the speaker changes their mind ----------
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  I.distractorItem = function (r) {
    const k = SK.randInt(r, 0, 7);
    const two = (list) => { const a = SK.sample(r, list, 2); return a; };
    let lines, answer, wrong, stem, accept = [];
    if (k === 0) { const [a, b] = two(DAYS); lines = [['Woman', 'Shall we meet on ' + a + '?'], ['Man', a + "'s difficult for me. I've got a dentist appointment. What about " + b + '?'], ['Woman', b + ' is fine.']]; answer = b; wrong = a; stem = 'Which day do they agree to meet?'; }
    else if (k === 1) { const h = SK.randInt(r, 2, 8); lines = [['Man', 'The tour starts at ' + I.words(h) + " o'clock, doesn't it?"], ['Woman', "It used to, but they've moved it half an hour later this season."]]; answer = h + '.30'; accept = I.timeAnswers(h, 30); wrong = h + '.00'; stem = 'What time does the tour start? Write the time in figures.'; }
    else if (k === 2) { const n = SK.randInt(r, 12, 40); lines = [['Woman', "We're expecting " + I.words(n) + ' people.'], ['Man', 'Did you count the two speakers?'], ['Woman', "Oh, no, I didn't. Add them on, then."]]; answer = String(n + 2); accept = [I.words(n + 2)]; wrong = String(n); stem = 'How many people are expected?'; }
    else if (k === 3) { const p = SK.randInt(r, 20, 60); lines = [['Man', 'The ticket is ' + I.saidPrice(p, 0) + '.'], ['Woman', "I'm a student. Is there a discount?"], ['Man', 'Yes, students pay five pounds less.']]; answer = String(p - 5); accept = I.priceAnswers(p - 5, 0); wrong = String(p); stem = 'How much does the woman pay, in pounds?'; }
    else if (k === 4) { const [a, b] = two(['bus', 'train', 'ferry', 'coach', 'taxi']); lines = [['Woman', 'I usually take the ' + a + '.'], ['Man', "There's a strike on the " + a + ' this week, though.'], ['Woman', "Then I'll have to get the " + b + ' instead.']]; answer = b; wrong = a; stem = 'How will the woman travel this week?'; }
    else if (k === 5) { const [a, b] = two(['Room 12', 'Room 21', 'the main hall', 'the library', 'Room 4B']); lines = [['Man', 'The seminar is in ' + a + ', as usual.'], ['Woman', 'Actually, there was an email this morning. ' + a + " is being painted, so it's in " + b + '.']]; answer = b.replace(/^the /, ''); accept = [b]; wrong = a; stem = 'Where is the seminar?'; }
    else if (k === 6) { const d = SK.randInt(r, 3, 21), m = SK.randInt(r, 0, 11); lines = [['Woman', 'The deadline is ' + I.saidDate(d, m, r) + ', right?'], ['Man', "That was the old date. They've given us one more week."]]; answer = (d + 7) + ' ' + I.MONTHS[m]; accept = I.dateAnswers(d + 7, m); wrong = d + ' ' + I.MONTHS[m]; stem = 'What is the new deadline?'; }
    else { const [a, b] = two(['blue', 'red', 'green', 'black', 'silver']); lines = [['Man', 'Was your bag ' + a + '?'], ['Woman', 'No, ' + a + " was my old one. This one's " + b + '.']]; answer = b; wrong = a; stem = 'What colour is the woman\'s bag?'; }
    return { id: 'dis-' + k + '-' + answer, type: 'text', topic: 'Changed answers', lines, stem, answer, accept, wrong, explanation: 'The first thing you hear, "' + wrong + '", is changed. The final answer is ' + answer + '.' };
  };

  // ---------- maps and plans: places either side of a path, described from the entrance ----------
  // Slots: L1..L4 on the left of the path walking in, R1..R4 on the right, and END at the far end.
  const MAP_THEMES = {
    park: { title: 'Riverside Park', path: 'path', entrance: 'main gate', places: ['café', 'toilets', 'playground', 'bandstand', 'rose garden', 'information centre', 'boating lake', 'picnic area', 'first aid post', 'gift shop'] },
    museum: { title: 'Ground floor of the City Museum', path: 'corridor', entrance: 'main entrance', places: ['cloakroom', 'gift shop', 'café', 'lecture theatre', 'toilets', 'children\'s gallery', 'lift', 'ticket desk', 'first aid room', 'library'] },
    campus: { title: 'Hartfield College campus', path: 'main road', entrance: 'front gate', places: ['library', 'sports hall', 'student union', 'science block', 'car park', 'canteen', 'medical centre', 'bookshop', 'chapel', 'art studio'] },
    centre: { title: 'Brookside Leisure Centre', path: 'corridor', entrance: 'entrance', places: ['changing rooms', 'gym', 'sauna', 'café', 'reception', 'small pool', 'dance studio', 'crèche', 'squash courts', 'shop'] },
  };
  I.MAP_SLOTS = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4', 'END'];
  const ORDW = ['first', 'second', 'third', 'fourth'];
  I.mapPuzzle = function (seed, themeName) {
    const r = SK.rng(seed);
    themeName = themeName || SK.pick(r, Object.keys(MAP_THEMES));
    const th = MAP_THEMES[themeName];
    const names = SK.sample(r, th.places, 9);
    const slots = {};
    I.MAP_SLOTS.forEach((s, i) => { slots[s] = names[i]; });
    // Three places are printed on the map as landmarks; five are asked about, labelled with letters A-H with three spare.
    const order = SK.shuffle(r, I.MAP_SLOTS);
    const landmarks = order.slice(0, 3), asked = order.slice(3, 8), spare = order.slice(8);
    const lettered = SK.shuffle(r, asked.concat(spare).concat([]));
    const letters = {};
    'ABCDEF'.split('').forEach((L, i) => { if (lettered[i]) letters[lettered[i]] = L; });
    const side = (s) => (s[0] === 'L' ? 'left' : 'right');
    const row = (s) => Number(s[1]);
    const other = (s) => (s[0] === 'L' ? 'R' : 'L') + s[1];
    // A description that pins the slot down, either from the entrance or from a landmark.
    const describe = function (s) {
      const opts = [];
      if (s === 'END') opts.push('right at the end of the ' + th.path + ', facing you as you walk in');
      else {
        opts.push('the ' + ORDW[row(s) - 1] + ' place on your ' + side(s) + ' as you go along the ' + th.path + ' from the ' + th.entrance);
        for (const L of landmarks) {
          if (L === 'END') { if (row(s) === 4) opts.push('the last place on the ' + side(s) + ' before you reach the ' + slots.END); continue; }
          if (other(s) === L) opts.push('directly opposite the ' + slots[L]);
          if (L[0] === s[0] && row(L) === row(s) + 1) opts.push('on the same side as the ' + slots[L] + ', just before it');
          if (L[0] === s[0] && row(L) === row(s) - 1) opts.push('next to the ' + slots[L] + ', a little further along on the same side');
        }
      }
      return SK.pick(r, opts);
    };
    const lines = [['Guide', 'Welcome to ' + th.title + '. You are at the ' + th.entrance + ', at the bottom of the map. The ' + th.path + ' runs straight ahead of you.']];
    const questions = asked.map((s, k) => {
      lines.push(['Guide', SK.pick(r, ['The ' + slots[s] + ' is ', 'You will find the ' + slots[s] + ' ', 'Now, the ' + slots[s] + ': it is ']) + describe(s) + '.']);
      return { id: 'map-' + seed + '-' + k, type: 'single', fixedOrder: true, topic: 'Map labelling', stem: 'Where is the ' + slots[s] + '?', choices: Object.values(letters).sort(), answer: Object.values(letters).sort().indexOf(letters[s]), explanation: 'The guide says the ' + slots[s] + ' is ' + describe(s) + '. That is ' + letters[s] + '.' };
    });
    lines.push(['Guide', 'Enjoy your visit.']);
    return { id: 'map-' + themeName + '-' + seed, title: th.title, theme: themeName, path: th.path, entrance: th.entrance, slots, landmarks, letters, lines, questions, figure: { kind: 'map', path: th.path, entrance: th.entrance, title: th.title, labels: Object.fromEntries(I.MAP_SLOTS.map((s) => [s, landmarks.includes(s) ? slots[s] : letters[s] || ''])) } };
  };

  // ---------- Writing Task 1 data ----------
  const SERIES_POOLS = [
    { title: 'Visitors to museums in one city', unit: 'thousand visitors', names: ['Science Museum', 'Art Gallery', 'History Museum', 'Maritime Museum'], lo: 20, hi: 160, pie: 'Share of visitors by museum' },
    { title: 'Electricity produced from different sources', unit: 'terawatt hours', names: ['Coal', 'Gas', 'Wind', 'Solar', 'Nuclear'], lo: 5, hi: 90, pie: 'Share of electricity by source' },
    { title: 'Average weekly spending on items by households', unit: 'pounds', names: ['Food', 'Transport', 'Leisure', 'Housing', 'Clothing'], lo: 10, hi: 120, pie: 'Share of weekly household spending by item' },
    { title: 'Students enrolled in language courses', unit: 'students', names: ['Spanish', 'Chinese', 'French', 'German', 'Arabic'], lo: 40, hi: 400, pie: 'Share of language-course students by language' },
    { title: 'Passengers using regional airports', unit: 'million passengers', names: ['Northfield', 'Eastport', 'Westvale', 'Southby'], lo: 2, hi: 40, pie: 'Share of passengers by airport' },
    { title: 'People cycling to work in European cities', unit: 'per cent of commuters', names: ['Amsterdam', 'Copenhagen', 'Berlin', 'London', 'Paris'], lo: 2, hi: 45, pie: 'Share of bicycles sold by city' },
  ];
  // A series with a clear shape, so the key features are real: rise, fall, fluctuate, peak, or stable.
  I.SHAPES = ['rise', 'fall', 'peak', 'dip', 'stable', 'fluctuate'];
  I.makeSeries = function (r, shape, n, lo, hi) {
    const span = hi - lo, out = [];
    const start = lo + span * (shape === 'fall' ? 0.6 + r() * 0.35 : shape === 'rise' ? r() * 0.3 : 0.25 + r() * 0.4);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let v;
      if (shape === 'rise') v = start + span * (0.45 + r() * 0.2) * t;
      else if (shape === 'fall') v = start - span * (0.45 + r() * 0.15) * t;
      else if (shape === 'peak') v = start + span * 0.45 * Math.sin(Math.PI * t) - span * 0.05 * t;
      else if (shape === 'dip') v = start - span * 0.3 * Math.sin(Math.PI * t);
      else if (shape === 'stable') v = start + span * 0.025 * (r() - 0.5);
      else v = start + span * 0.22 * (i % 2 ? 1 : -1) * (0.6 + r() * 0.4);
      out.push(Math.max(lo * 0.5, v));
    }
    const nice = span > 150 ? 5 : span > 40 ? 1 : 0.5;
    return out.map((v) => SK.round(Math.round(v / nice) * nice, 1));
  };
  I.chartData = function (seed, kind) {
    const r = SK.rng(seed);
    const pool = SK.pick(r, SERIES_POOLS);
    const k = kind === 'pie' ? 5 : kind === 'table' ? 4 : 3;
    const names = SK.sample(r, pool.names, Math.min(k, pool.names.length));
    const y0 = SK.pick(r, [1990, 1995, 2000, 2005, 2010]);
    const step = kind === 'line' ? 5 : SK.pick(r, [5, 10]);
    const n = kind === 'line' ? 6 : kind === 'bar' ? 4 : kind === 'table' ? 4 : 2;
    const xs = SK.range(n).map((i) => String(y0 + i * step));
    if (kind === 'pie') {
      // two years, each splitting 100 per cent five ways
      const pies = xs.map(() => { const raw = names.map(() => 5 + r() * 30); const tot = SK.sum(raw); const p = raw.map((x) => Math.round((100 * x) / tot)); p[0] += 100 - SK.sum(p); return p; });
      return { kind, seed, title: pool.pie + ', ' + xs[0] + ' and ' + xs[1], unit: 'per cent', topic: pool.pie, xs, names, series: names.map((nm, i) => ({ name: nm, values: pies.map((p) => p[i]) })) };
    }
    const shapes = SK.sample(r, I.SHAPES, names.length);
    const series = names.map((nm, i) => ({ name: nm, shape: shapes[i], values: I.makeSeries(r, shapes[i], n, pool.lo, pool.hi) }));
    return { kind, seed, title: pool.title + ', ' + xs[0] + ' to ' + xs[xs.length - 1], unit: pool.unit, topic: pool.title, xs, names, series };
  };
  const fmt = (v, unit) => (unit === 'per cent' || unit === 'per cent of commuters' ? v + '%' : unit === 'pounds' ? '£' + v : v + ' ' + unit);
  // True statements are checked against the numbers; false ones are made by swapping a fact.
  I.facts = function (d) {
    const T = [], F = [];
    const first = (s) => s.values[0], last = (s) => s.values[s.values.length - 1];
    const max = (s) => Math.max(...s.values), min = (s) => Math.min(...s.values);
    const xi = (s, v) => d.xs[s.values.indexOf(v)];
    for (const s of d.series) {
      const ch = last(s) - first(s), rel = Math.abs(ch) / Math.max(1, first(s));
      if (rel > 0.2 && ch > 0) { T.push(s.name + ' ended the period higher than it started.'); F.push(s.name + ' ended the period lower than it started.'); }
      if (rel > 0.2 && ch < 0) { T.push(s.name + ' was lower at the end of the period than at the start.'); F.push(s.name + ' was higher at the end of the period than at the start.'); }
      if (d.kind !== 'pie' && s.values.length > 2 && max(s) > Math.max(first(s), last(s)) * 1.15) T.push(s.name + ' reached its highest point, ' + fmt(max(s), d.unit) + ', in ' + xi(s, max(s)) + '.');
    }
    for (let j = 0; j < d.xs.length; j += Math.max(1, d.xs.length - 1)) {
      const vals = d.series.map((s) => s.values[j]);
      const top = Math.max(...vals), bottom = Math.min(...vals);
      if (vals.filter((v) => v === top).length === 1) {
        const winner = d.series[vals.indexOf(top)].name, loser = d.series[vals.indexOf(bottom)].name;
        T.push('In ' + d.xs[j] + ', ' + winner + ' had the highest figure.');
        if (loser !== winner) F.push('In ' + d.xs[j] + ', ' + loser + ' had the highest figure.');
      }
    }
    return { true: [...new Set(T)], false: [...new Set(F)] };
  };
  // An overview names the main trends or the biggest category without numbers.
  I.overviewItem = function (d, r) {
    const f = I.facts(d);
    if (!f.true.length || f.false.length < 1) return null;
    const right = 'Overall, ' + f.true.slice(0, 2).map((x) => x.replace(/\.$/, '').replace(/^In (\d+), /, 'in $1, ')).join(', and ') + '.';
    const s0 = d.series[0];
    const tooDetailed = 'Overall, ' + s0.name + ' was ' + fmt(s0.values[0], d.unit) + ' in ' + d.xs[0] + ' and ' + fmt(s0.values[1], d.unit) + ' in ' + d.xs[1] + '.';
    const wrong = 'Overall, ' + f.false[0].replace(/\.$/, '').replace(/^In /, 'in ') + '.';
    const vague = 'Overall, the chart shows some changes in the figures over the period.';
    return { id: 'ov-' + d.seed, type: 'single', topic: 'Overview', stem: 'Which is the best overview of this chart?', choices: [right, tooDetailed, wrong, vague], answer: 0,
      explanation: 'A good overview sums up the main trends or the largest category with no detailed numbers. The second option is a detail, not an overview; the third is wrong; the fourth says nothing specific.' };
  };
  I.factItems = function (d, r, n) {
    const f = I.facts(d);
    const out = [];
    const pool = SK.shuffle(r, f.true.map((t) => [t, true]).concat(f.false.map((t) => [t, false])));
    for (const [t, ok] of pool.slice(0, n)) out.push({ id: 'fact-' + d.seed + '-' + out.length, type: 'single', fixedOrder: true, noLetters: true, topic: 'Key features', stem: 'True or false, according to the chart?\n' + t, choices: ['True', 'False'], answer: ok ? 0 : 1, explanation: ok ? 'This matches the figures.' : 'The figures show the opposite.' });
    return out;
  };

  // ---------- the language of change and proportion ----------
  // A change from a to b, in the words a careful writer would choose.
  I.describeChange = function (a, b) {
    const rel = (b - a) / Math.max(1e-9, Math.abs(a));
    const size = Math.abs(rel);
    if (size < 0.05) return { verb: 'remained stable', adverb: '', size: 'none' };
    const dir = rel > 0 ? 'rose' : 'fell';
    if (size < 0.15) return { verb: dir, adverb: 'slightly', size: 'small' };
    if (size < 0.4) return { verb: dir, adverb: 'steadily', size: 'moderate' };
    if (size < 1) return { verb: dir, adverb: 'sharply', size: 'large' };
    return { verb: rel > 0 ? 'more than doubled' : dir, adverb: rel > 0 ? '' : 'dramatically', size: 'huge' };
  };
  I.trendItem = function (r) {
    const a = SK.randInt(r, 20, 200);
    const factor = SK.pick(r, [1.02, 0.98, 1.1, 0.9, 1.25, 0.75, 1.6, 0.45, 2.4]);
    const b = Math.max(1, Math.round(a * factor));
    const c = I.describeChange(a, b);
    const say = (c.verb + (c.adverb ? ' ' + c.adverb : ''));
    const all = ['remained stable', 'rose slightly', 'rose steadily', 'rose sharply', 'more than doubled', 'fell slightly', 'fell steadily', 'fell sharply', 'fell dramatically'];
    const wrong = SK.shuffle(r, all.filter((x) => x !== say)).slice(0, 3);
    const thing = SK.pick(r, ['The number of visitors', 'Sales of electric cars', 'The price of bread', 'Membership of the club', 'Car journeys into the city']);
    return { id: 'tr-' + a + '-' + b, type: 'single', topic: c.size === 'none' ? 'Stability' : b > a ? 'Increases' : 'Decreases',
      stem: thing + ' went from ' + a + ' to ' + b + ' over five years. Which description fits best?\n' + thing + ' _____.', choices: [say].concat(wrong), answer: 0,
      explanation: 'A change of ' + Math.round(((b - a) / a) * 100) + ' per cent. Under 5 per cent is stable; under 15 is slight; under 40 is steady; above that is sharp, and a rise to more than twice is "more than doubled". These bands are a writing guide, not a rule.' };
  };
  const FRACTIONS = [[5, 'a twentieth'], [10, 'a tenth'], [20, 'a fifth'], [25, 'a quarter'], [100 / 3, 'a third'], [40, 'two fifths'], [50, 'half'], [60, 'three fifths'], [200 / 3, 'two thirds'], [75, 'three quarters'], [80, 'four fifths'], [90, 'nine tenths']];
  // 26 per cent -> "just over a quarter"; 32 -> "just under a third"; 50 -> "exactly half".
  I.approx = function (p) {
    let best = FRACTIONS[0];
    for (const f of FRACTIONS) if (Math.abs(f[0] - p) < Math.abs(best[0] - p)) best = f;
    const diff = p - best[0];
    if (Math.abs(diff) < 0.5) return (best[1] === 'half' ? 'exactly half' : 'exactly ' + best[1]);
    if (Math.abs(diff) <= 3) return (diff > 0 ? 'just over ' : 'just under ') + (best[1] === 'half' ? 'half' : best[1]);
    return null;
  };
  I.approxItem = function (r) {
    let p, phrase;
    do { p = SK.randInt(r, 4, 93); phrase = I.approx(p); } while (!phrase);
    const others = new Set();
    for (const q of SK.shuffle(r, SK.range(90).map((x) => x + 4))) { const o = I.approx(q); if (o && o !== phrase && !o.endsWith(phrase.replace(/^(just over|just under|exactly) /, ''))) others.add(o); if (others.size >= 3) break; }
    const thing = SK.pick(r, ['of students walked to school', 'of the budget went on housing', 'of visitors came from abroad', 'of households owned a car', 'of the land was used for farming']);
    return { id: 'ap-' + p, type: 'single', topic: 'Proportions', stem: p + '% ' + thing + '. Which phrase is accurate?\n_____ ' + thing + '.', choices: [phrase.replace(/^\w/, (c) => c.toUpperCase())].concat([...others].map((o) => o.replace(/^\w/, (c) => c.toUpperCase()))), answer: 0,
      explanation: p + ' per cent is ' + phrase + '. "Just over" and "just under" suit figures within about three points of a simple fraction.' };
  };

  // ---------- sets made from the banks ----------
  // Turn a listening script from the banks into a set: { title, lines | text, questions }.
  SK.listeningSet = (sc, extra) => Object.assign({ id: sc.id, title: sc.title, instructions: sc.instructions || '', limit: sc.limit || '', audio: { title: sc.title, lines: sc.lines, text: sc.text }, questions: sc.questions.map((q) => Object.assign({ topic: sc.topic || 'Listening' }, q)) }, extra || {});
  SK.readingSet = (p, questions, extra) => Object.assign({ id: p.id, title: p.title, passageTitle: p.title, passage: SK.paragraphText(p), questions }, extra || {});
  // Paragraphs labelled A, B, C ... as IELTS prints them.
  SK.paragraphText = (p) => (p.paragraphs ? p.paragraphs.map((x, i) => '**' + 'ABCDEFGHIJ'[i] + '** ' + x).join('\n\n') : p.text);

  // ---------- Writing Task 1 with a generated chart ----------
  I.TASK1_NOUN = { line: 'graph', bar: 'bar chart', pie: 'pie charts', table: 'table' };
  I.task1Text = (d) => 'The ' + I.TASK1_NOUN[d.kind] + ' below ' + (d.kind === 'pie' ? 'show ' : 'shows ') + d.title.replace(/^\w/, (c) => c.toLowerCase()) + (d.kind === 'pie' ? '' : ' (' + d.unit + ')') + '.\nSummarise the information by choosing and reporting the main features, and make comparisons where relevant.\nWrite at least 150 words.';
  I.TASK1_CHECK = ['I wrote an overview that sums up the main trends or biggest differences.', 'I supported the key features with figures from the chart.', 'I compared items rather than describing each one separately.', 'I did not add opinions or reasons that are not in the chart.', 'I wrote at least 150 words in about 20 minutes.'];
  // Questions about a chart: five true-or-false facts and the best overview.
  I.task1Items = (d, seed) => { const r = SK.rng(seed); const ov = I.overviewItem(d, r); return I.factItems(d, r, 5).concat(ov ? [SK.shuffleItem(r, ov)] : []); };
  // Tabs shared by the four chart apps. They load in Node, and draw only in the page.
  SK.task1Tabs = function (kind) {
    const key = () => SK.APP.name + '.seed';
    const current = () => SK.store.get(key(), SK.daySeed(SK.APP.name));
    const figure = (d) => (d.kind === 'table' ? SK.table(['', ...d.xs], d.series.map((s) => [s.name, ...s.values]), false) : SK.figures[d.kind](d));
    const newChart = (tab) => SK.btn('New chart', () => { SK.store.set(key(), SK.seedNow()); SK.show(tab); }, 'ghost small');
    return [
      { id: 'features', label: 'Key features', render(el) {
        const d = I.chartData(current(), kind);
        el.appendChild(SK.card(d.title, figure(d), newChart('features')));
        const box = SK.h('div', {});
        el.appendChild(box);
        SK.quiz(box, I.task1Items(d, current()), { title: 'Key features of this chart', mode: 'practice' });
      } },
      { id: 'write', label: 'Write', render(el) {
        const d = I.chartData(current(), kind);
        const prompt = SK.h('div', {}, SK.h('p', { style: { whiteSpace: 'pre-line' }, text: I.task1Text(d) }), figure(d), newChart('write'));
        SK.writer(el, { key: kind + '-' + current(), title: 'Task 1 report', prompt, promptText: I.task1Text(d), minutes: 20, target: [150, 200], paragraphs: 3, checklist: I.TASK1_CHECK });
      } },
      { id: 'plan', label: 'Plan', render(el) {
        const d = I.chartData(current(), kind), f = I.facts(d), ov = I.overviewItem(d, SK.rng(1));
        el.appendChild(SK.card('A plan for this chart', figure(d),
          SK.h('h3', { text: '1. Introduction' }), SK.h('p', { text: 'Paraphrase the task: what the ' + I.TASK1_NOUN[d.kind] + ' shows, where and when. Do not copy the task sentence.' }),
          SK.h('h3', { text: '2. Overview' }), SK.h('p', { text: ov ? ov.choices[ov.answer] : 'Sum up the biggest trend or difference.' }),
          SK.h('h3', { text: '3. Details' }), SK.h('ul', {}, f.true.map((t) => SK.h('li', { text: t }))),
          SK.note('These facts were checked against the numbers. Group them into two body paragraphs and add figures.'), newChart('plan')));
      } },
    ];
  };

  // ---------- question groups from a reading passage ----------
  I.ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
  I.LETTERS = 'ABCDEFGHIJ'.split('');
  I.TFNG = ['True', 'False', 'Not Given'];
  I.YNNG = ['Yes', 'No', 'Not Given'];
  // One True/False/Not Given (or Yes/No/Not Given) statement as a question; the short text goes with it.
  I.tfItem = (t, yn) => { const ch = yn ? I.YNNG : I.TFNG; return { id: t.id, type: 'single', fixedOrder: true, noLetters: true, topic: yn ? 'Yes / No / Not Given' : 'True / False / Not Given', stem: t.s, choices: ch.slice(), answer: ch.indexOf(t.a), explanation: t.expl || '' }; };
  // Each maker returns the questions for one IELTS question type, with the group's instruction as a heading.
  // Option lists (headings, endings, summary words) are shuffled once per set, so the key is never in order.
  I.groups = {
    headings(p, r) {
      const order = SK.shuffle(r, SK.range(p.headings.list.length));
      const choices = order.map((j, i) => I.ROMAN[i] + '. ' + p.headings.list[j]);
      return p.paragraphs.map((_, k) => ({ id: p.id + '-h' + k, type: 'single', fixedOrder: true, noLetters: true, topic: 'Matching headings', heading: 'Choose the correct heading for each paragraph. There are more headings than paragraphs.', stem: 'Paragraph ' + I.LETTERS[k], choices, answer: order.indexOf(p.headings.answer[k]), explanation: 'Paragraph ' + I.LETTERS[k] + ': ' + p.headings.list[p.headings.answer[k]] + '.' }));
    },
    info(p) {
      const choices = p.paragraphs.map((_, k) => I.LETTERS[k]);
      return p.info.map((x, k) => ({ id: p.id + '-i' + k, type: 'single', fixedOrder: true, topic: 'Matching information', heading: 'Which paragraph contains the following information?', stem: x.s.replace(/^\w/, (c) => c.toUpperCase()), choices, answer: x.p, explanation: 'Paragraph ' + I.LETTERS[x.p] + ': "' + p.paragraphs[x.p].slice(0, 120) + '..."' }));
    },
    endings(p, r) {
      const order = SK.shuffle(r, SK.range(p.endings.ends.length));
      const choices = order.map((j) => p.endings.ends[j]);
      return p.endings.starts.map((st, k) => ({ id: p.id + '-e' + k, type: 'single', fixedOrder: true, topic: 'Sentence endings', heading: 'Complete each sentence with the correct ending.', stem: st + ' ...', choices, answer: order.indexOf(p.endings.answer[k]), explanation: st + ' ' + p.endings.ends[p.endings.answer[k]] }));
    },
    summary(p, r) {
      const box = SK.shuffle(r, p.summary.box);
      const text = p.summary.text.replace(/\[(\d)\]/g, (m, n) => '(' + n + ') _____');
      return p.summary.answers.map((a, k) => ({ id: p.id + '-s' + k, type: 'single', fixedOrder: true, topic: 'Summary completion', heading: 'Complete the summary using words from the box.\n' + text, stem: 'Gap (' + (k + 1) + ')', choices: box, answer: box.indexOf(a), explanation: 'Gap ' + (k + 1) + ': ' + a + '.' }));
    },
    short(p) {
      return p.short.map((x, k) => ({ id: p.id + '-a' + k, type: 'text', topic: 'Short answers', heading: 'Answer the questions. Write NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage.', stem: x.q + ' ___', answer: x.a, accept: x.accept || [], explanation: 'Answer: ' + x.a + '.' }));
    },
    mcq(p) {
      return p.mcq.map((m, k) => ({ id: p.id + '-m' + k, type: 'single', topic: 'Multiple choice', heading: 'Choose the correct letter.', stem: m.stem, choices: m.choices.slice(), answer: m.answer, explanation: 'Answer: ' + m.choices[m.answer] }));
    },
    tfng(p) {
      return p.tfng.map((t, k) => Object.assign(I.tfItem({ id: p.id + '-t' + k, s: t.s, a: t.a, expl: t.expl || '' }), { heading: 'Do the following statements agree with the information in the passage? Write True, False or Not Given.' }));
    },
  };
  I.GROUP_NAMES = { headings: 'Matching headings', info: 'Matching information', endings: 'Sentence endings', summary: 'Summary completion', short: 'Short answers', mcq: 'Multiple choice', tfng: 'True / False / Not Given' };
  // A whole passage set with some or all question types, in IELTS order. Multiple-choice options are shuffled.
  I.passageSet = function (p, kinds, seed) {
    const r = SK.rng(seed);
    const qs = [];
    for (const k of kinds) for (const q of I.groups[k](p, r)) qs.push(q.type === 'single' && !q.fixedOrder ? SK.shuffleItem(r, q) : q);
    return SK.readingSet(p, qs);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SK; else root.SK = SK;
})(typeof window !== 'undefined' ? window : globalThis);
