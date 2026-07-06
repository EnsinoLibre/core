/**
 * EnsinoLibre aula — seed worksheet documents (valid schema v2, no audio types).
 * These are the actual materials students work through in a deployed class.
 */

export const WS_SOLAR = {
  $schemaVersion: '2.0',
  title: 'The Solar System',
  subject: 'Science', topic: 'Planets and space', audience: 'A2 learners', language: 'en-GB',
  estimatedMinutes: 12,
  instructions: 'Work through each activity and use the Check button. Your teacher can see your progress.',
  sections: [
    { title: 'Warm-up', activities: [
      { type: 'mcq', question: 'Which planet is closest to the Sun?',
        options: ['Venus', 'Mercury', 'Mars', 'Earth'], answer: 1,
        hint: 'It is also the smallest planet.', explanation: 'Mercury orbits closest to the Sun.' },
      { type: 'true-false', statement: 'The Sun is a planet.', answer: false,
        hint: 'Think about what the Sun gives out.', explanation: 'The Sun is a star, not a planet.' },
    ] },
    { title: 'Practice', activities: [
      { type: 'gap-fill', text: 'There are {{8|eight}} planets, and they all orbit the {{Sun|sun}}.',
        hint: 'Pluto is a dwarf planet.', explanation: 'Eight planets orbit the Sun.' },
      { type: 'ordering', prompt: 'Order these planets from the Sun outwards.',
        items: ['Mercury', 'Earth', 'Jupiter', 'Neptune'],
        hint: 'Rocky planets are nearer than gas giants.', explanation: 'Mercury, Earth, Jupiter, Neptune.' },
      { type: 'open-response', prompt: 'Which planet would you like to visit, and why? Write two sentences.',
        minWords: 15 },
    ] },
  ],
};

export const WS_ROUTINES = {
  $schemaVersion: '2.0',
  title: 'Daily Routines — A2',
  subject: 'English', topic: 'Present simple & daily life', audience: 'A2 learners', language: 'en-GB',
  estimatedMinutes: 10,
  instructions: 'Practise talking about everyday routines.',
  sections: [
    { title: 'Vocabulary & grammar', activities: [
      { type: 'matching', prompt: 'Match each time expression to a typical activity.',
        pairs: [
          { left: 'in the morning', right: 'have breakfast' },
          { left: 'at noon', right: 'eat lunch' },
          { left: 'in the evening', right: 'watch television' },
          { left: 'at night', right: 'go to sleep' },
        ],
        hint: 'Follow the order of a normal day.', explanation: 'Morning→breakfast, noon→lunch, evening→TV, night→sleep.' },
      { type: 'gap-fill', text: 'She {{gets}} up at seven and {{goes}} to work by bus.',
        hint: 'Third person singular adds -s.', explanation: 'gets / goes — present simple, he/she/it.' },
    ] },
    { title: 'Check yourself', activities: [
      { type: 'question-set', instruction: 'Answer each question.', passMark: 2, questions: [
        { subtype: 'true-false', statement: '"They doesn\'t work on Sundays" is correct English.', answer: false,
          explanation: 'It should be "They don\'t work".' },
        { subtype: 'mcq', question: 'Choose the correct sentence.',
          options: ['He go home at five.', 'He goes home at five.', 'He going home at five.'], answer: 1,
          explanation: 'Present simple he/she/it takes -s: goes.' },
        { subtype: 'gap-fill', text: 'I usually {{have}} dinner at eight o\'clock.',
          explanation: 'have — present simple, I form.' },
      ] },
      { type: 'open-response', prompt: 'Describe your morning routine in three sentences.', minWords: 15 },
    ] },
  ],
};

export const SEED_WORKSHEETS = [
  { id: 'ws_solar', title: WS_SOLAR.title, subject: WS_SOLAR.subject, doc: WS_SOLAR },
  { id: 'ws_routines', title: WS_ROUTINES.title, subject: WS_ROUTINES.subject, doc: WS_ROUTINES },
];
