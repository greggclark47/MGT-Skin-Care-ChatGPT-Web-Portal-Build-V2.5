const assert = require('node:assert/strict');
const { consolidateInquiry } = require('../dist');

const first = consolidateInquiry('How do I simplify my routine?', []);
assert.equal(first.turns, 1);
assert.equal(first.repeated, false);
assert.deepEqual(first.topics, ['routine']);

const followUp = consolidateInquiry('Can I make it simpler?', [{ role: 'user', text: 'How do I simplify my routine?' }]);
assert.equal(followUp.turns, 2);
assert.equal(followUp.repeated, true);
assert.match(followUp.summary, /routine/);
assert.match(followUp.routing_text, /Latest user inquiry/);

const bounded = consolidateInquiry('What should I do next?', Array.from({ length: 20 }, (_, index) => ({ role: 'assistant', text: `ignored ${index}` })));
assert.equal(bounded.turns, 1);
assert.equal(bounded.topics.length, 0);
console.log('inquiry context checks passed');
