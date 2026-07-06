/**
 * EnsinoLibre aula — seed worksheet documents (valid schema v2, no audio types).
 * These are the actual materials students work through in deployed classes.
 * Kept lean but real; each has a handful of auto-gradeable activities so the
 * live monitor shows meaningful progress.
 */

export const WS_SOLAR = {
  $schemaVersion: '2.0',
  title: 'The Solar System', subject: 'Science', topic: 'Planets and space', audience: 'A2 learners', language: 'en-GB',
  estimatedMinutes: 12,
  instructions: 'Work through each activity and use the Check button. Your teacher can see your progress.',
  sections: [
    { title: 'Warm-up', activities: [
      { type: 'mcq', question: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Mars', 'Earth'], answer: 1, hint: 'It is also the smallest planet.', explanation: 'Mercury orbits closest to the Sun.' },
      { type: 'true-false', statement: 'The Sun is a planet.', answer: false, hint: 'Think about what the Sun gives out.', explanation: 'The Sun is a star, not a planet.' },
    ] },
    { title: 'Practice', activities: [
      { type: 'gap-fill', text: 'There are {{8|eight}} planets, and they all orbit the {{Sun|sun}}.', hint: 'Pluto is a dwarf planet.', explanation: 'Eight planets orbit the Sun.' },
      { type: 'ordering', prompt: 'Order these planets from the Sun outwards.', items: ['Mercury', 'Earth', 'Jupiter', 'Neptune'], hint: 'Rocky planets are nearer.', explanation: 'Mercury, Earth, Jupiter, Neptune.' },
      { type: 'open-response', prompt: 'Which planet would you like to visit, and why? Write two sentences.', minWords: 15 },
    ] },
  ],
};

export const WS_ROUTINES = {
  $schemaVersion: '2.0',
  title: 'Daily Routines — A2', subject: 'English', topic: 'Present simple & daily life', audience: 'A2 learners', language: 'en-GB',
  estimatedMinutes: 10,
  instructions: 'Practise talking about everyday routines.',
  sections: [
    { title: 'Vocabulary & grammar', activities: [
      { type: 'matching', prompt: 'Match each time expression to a typical activity.', pairs: [
        { left: 'in the morning', right: 'have breakfast' }, { left: 'at noon', right: 'eat lunch' },
        { left: 'in the evening', right: 'watch television' }, { left: 'at night', right: 'go to sleep' } ],
        hint: 'Follow the order of a normal day.', explanation: 'Morning→breakfast, noon→lunch, evening→TV, night→sleep.' },
      { type: 'gap-fill', text: 'She {{gets}} up at seven and {{goes}} to work by bus.', hint: 'Third person singular adds -s.', explanation: 'gets / goes.' },
    ] },
    { title: 'Check yourself', activities: [
      { type: 'question-set', instruction: 'Answer each question.', passMark: 2, questions: [
        { subtype: 'true-false', statement: '"They doesn\'t work on Sundays" is correct English.', answer: false, explanation: 'It should be "They don\'t work".' },
        { subtype: 'mcq', question: 'Choose the correct sentence.', options: ['He go home at five.', 'He goes home at five.', 'He going home at five.'], answer: 1, explanation: 'Present simple he/she/it takes -s: goes.' },
        { subtype: 'gap-fill', text: 'I usually {{have}} dinner at eight o\'clock.', explanation: 'have — present simple, I form.' } ] },
      { type: 'open-response', prompt: 'Describe your morning routine in three sentences.', minWords: 15 },
    ] },
  ],
};

export const WS_SHOPPING = {
  $schemaVersion: '2.0',
  title: 'At the Shops — A2', subject: 'English', topic: 'Shopping & prices', audience: 'A2 learners', language: 'en-GB',
  estimatedMinutes: 10,
  sections: [
    { title: 'Shops & prices', activities: [
      { type: 'matching', prompt: 'Match the shop to what you buy there.', pairs: [
        { left: 'bakery', right: 'bread' }, { left: 'butcher\'s', right: 'meat' },
        { left: 'greengrocer\'s', right: 'vegetables' }, { left: 'chemist\'s', right: 'medicine' } ],
        explanation: 'Each shop sells its own goods.' },
      { type: 'gap-fill', text: '"How {{much}} is this?" "It {{costs}} four euros."', hint: 'Uncountable question word + price verb.', explanation: 'much / costs.' },
      { type: 'mcq', question: 'A polite way to ask for something in a shop:', options: ['Give me bread.', 'I\'d like some bread, please.', 'Bread now.'], answer: 1, explanation: '"I\'d like … please" is polite.' },
    ] },
  ],
};

export const WS_DIRECTIONS = {
  $schemaVersion: '2.0',
  title: 'Giving Directions — A1', subject: 'English', topic: 'Places & directions', audience: 'A1 learners', language: 'en-GB',
  estimatedMinutes: 8,
  sections: [
    { title: 'Find your way', activities: [
      { type: 'mcq', question: 'Which means the opposite of "turn left"?', options: ['turn right', 'go straight', 'stop'], answer: 0, explanation: 'Left ↔ right.' },
      { type: 'gap-fill', text: 'Go {{straight}} on and then turn {{left}} at the bank.', hint: 'Two direction words.', explanation: 'straight / left.' },
      { type: 'true-false', statement: '"It\'s next to the bank" means the two places are close together.', answer: true, explanation: '"Next to" = beside.' },
    ] },
  ],
};

export const WS_PAST_HOLIDAY = {
  $schemaVersion: '2.0',
  title: 'My Last Holiday — B1', subject: 'English', topic: 'Past simple', audience: 'B1 learners', language: 'en-GB',
  estimatedMinutes: 14,
  sections: [
    { title: 'Past simple', activities: [
      { type: 'gap-fill', text: 'Last summer we {{went}} to Spain and {{stayed}} in a small hotel near the beach.', hint: 'Irregular past forms.', explanation: 'went / stayed.' },
      { type: 'question-set', instruction: 'Answer each item.', passMark: 2, questions: [
        { subtype: 'mcq', question: 'Choose the correct past question.', options: ['Where you did go?', 'Where did you go?', 'Where did you went?'], answer: 1, explanation: 'did + base form.' },
        { subtype: 'true-false', statement: 'The past of "buy" is "buyed".', answer: false, explanation: 'It is "bought".' },
        { subtype: 'gap-fill', text: 'They {{didn\'t|did not}} enjoy the flight.', explanation: 'Negative past: did not + base.' } ] },
      { type: 'ordering', prompt: 'Put the holiday story in order.', items: ['We booked the flights.', 'We flew to Lisbon.', 'We explored the city.', 'We flew home.'], explanation: 'Book → fly out → explore → fly home.' },
    ] },
  ],
};

export const WS_COMPARATIVES = {
  $schemaVersion: '2.0',
  title: 'Comparatives — B1', subject: 'English', topic: 'Comparison', audience: 'B1 learners', language: 'en-GB',
  estimatedMinutes: 10,
  sections: [
    { title: 'Bigger, better, more', activities: [
      { type: 'mcq', question: 'Choose the correct comparative.', options: ['This box is more heavy.', 'This box is heavier.', 'This box is heavyer.'], answer: 1, explanation: 'Short adjective + -er (heavy→heavier).' },
      { type: 'gap-fill', text: 'A train is usually {{faster}} than a bus, but a plane is the {{fastest}} of all.', hint: 'Comparative then superlative.', explanation: 'faster / fastest.' },
      { type: 'matching', prompt: 'Match the adjective to its comparative.', pairs: [
        { left: 'good', right: 'better' }, { left: 'bad', right: 'worse' }, { left: 'far', right: 'further' } ],
        explanation: 'Irregular comparatives.' },
    ] },
  ],
};

export const WS_JOBS_EMAIL = {
  $schemaVersion: '2.0',
  title: 'Professional Emails — B2', subject: 'Business English', topic: 'Workplace writing', audience: 'B2 learners', language: 'en-GB',
  estimatedMinutes: 14,
  sections: [
    { title: 'Register & structure', activities: [
      { type: 'mcq', question: 'Which greeting is most appropriate for a first email to a new client?', options: ['Hey,', 'Dear Ms Silva,', 'Hi there!'], answer: 1, explanation: '"Dear + surname" is formal and safe.' },
      { type: 'gap-fill', text: 'I am writing to {{enquire}} about your services. I look {{forward}} to your reply.', hint: 'Formal verb + fixed phrase.', explanation: 'enquire / forward.' },
      { type: 'reading-comp', instruction: 'Read the email, then answer.', passage: 'Dear Mr Costa, Thank you for your order of 12 June. Unfortunately, the item is out of stock and will ship in two weeks. We apologise for the delay and have added a 10% discount to your account.', questions: [
        { type: 'true-false', statement: 'The item will ship immediately.', answer: false, explanation: 'It ships in two weeks.' },
        { type: 'mcq', question: 'What did the company add to the account?', options: ['A refund', 'A 10% discount', 'Free delivery'], answer: 1, explanation: 'A 10% discount.' } ] },
    ] },
  ],
};

export const WS_ANIMALS = {
  $schemaVersion: '2.0',
  title: 'Animals — A1', subject: 'English', topic: 'Animal vocabulary', audience: 'A1 learners', language: 'en-GB',
  estimatedMinutes: 8,
  sections: [
    { title: 'Animal words', activities: [
      { type: 'matching', prompt: 'Match the animal to where it lives.', pairs: [
        { left: 'fish', right: 'in the sea' }, { left: 'bird', right: 'in a tree' },
        { left: 'cow', right: 'on a farm' }, { left: 'lion', right: 'in the wild' } ],
        explanation: 'Each animal has a typical home.' },
      { type: 'mcq', question: 'Which animal can fly?', options: ['dog', 'bird', 'fish'], answer: 1, explanation: 'Birds fly.' },
      { type: 'gap-fill', text: 'A baby dog is a {{puppy}} and a baby cat is a {{kitten}}.', explanation: 'puppy / kitten.' },
    ] },
  ],
};

export const SEED_WORKSHEETS = [
  { id: 'ws_solar', title: WS_SOLAR.title, subject: WS_SOLAR.subject, doc: WS_SOLAR },
  { id: 'ws_routines', title: WS_ROUTINES.title, subject: WS_ROUTINES.subject, doc: WS_ROUTINES },
  { id: 'ws_shopping', title: WS_SHOPPING.title, subject: WS_SHOPPING.subject, doc: WS_SHOPPING },
  { id: 'ws_directions', title: WS_DIRECTIONS.title, subject: WS_DIRECTIONS.subject, doc: WS_DIRECTIONS },
  { id: 'ws_past_holiday', title: WS_PAST_HOLIDAY.title, subject: WS_PAST_HOLIDAY.subject, doc: WS_PAST_HOLIDAY },
  { id: 'ws_comparatives', title: WS_COMPARATIVES.title, subject: WS_COMPARATIVES.subject, doc: WS_COMPARATIVES },
  { id: 'ws_jobs_email', title: WS_JOBS_EMAIL.title, subject: WS_JOBS_EMAIL.subject, doc: WS_JOBS_EMAIL },
  { id: 'ws_animals', title: WS_ANIMALS.title, subject: WS_ANIMALS.subject, doc: WS_ANIMALS },
];
