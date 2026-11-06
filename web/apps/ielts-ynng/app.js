/* Yes, No or Not Given: decide whether statements match the writer's views or claims. */
(function () {
  'use strict';
  const items = (bank) => bank.map((t) => Object.assign(SK.ielts.tfItem(t, true), { stem: '**Writer:** ' + t.text + '\n\n**Statement:** ' + t.s, topic: 'Answer: ' + t.a }));
  const SIGNS = [['Strong opinion', 'undoubtedly, clearly, I would abolish, is a mistake'], ['Partial agreement', 'not entirely wrong, to some extent, some deserve it'], ['Rejecting a view', 'is often dismissed as..., yet; critics claim..., but'], ['Evaluation words', 'naive, worthwhile, vital, tiresome, moving']];
  const App = {
    about: 'Yes, No or Not Given asks about the writer\'s opinions and claims, not facts. You need to separate what the writer believes from the views they report and then reject. Practise with 32 short opinion texts, each with an explanation.',
    how: ['Find the writer\'s own view: watch for "critics claim" or "is often said", which introduce other people\'s views.', 'Choose Yes if the statement matches the writer\'s view, No if it contradicts it, Not Given if the writer does not say.', 'Learn the words that show opinion in **Opinion signals**.'],
    tabs: [
      SK.bankTab('practice', 'Practice', (ctx) => items(ctx.data.ynng), { sizes: [8, 16, 32], seconds: (n) => n * 45 }),
      { id: 'signals', label: 'Opinion signals', render(el) { el.appendChild(SK.card('Words that show the writer\'s view', SK.table(['Kind', 'Examples'], SIGNS, false))); } },
    ],
    items,
    checks: { 'items are valid and use Yes / No / Not Given': (data, assert) => { for (const x of items(data.ynng)) { assert.deepEqual(SK.validateItem(x), []); assert.deepEqual(x.choices, ['Yes', 'No', 'Not Given']); } } },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = App; else SK.start(App);
})();
