const fs = require('fs');

const filePath = 'C:\\kiberaz.az\\seed-data\\quiz-questions.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Sonda parentez içindəki terminləri aşkar et
// Nümunə: "... üçün (SNAT)", "... (DNAT)", "... (PAT)", "... (protocol layering)" etc.
const hintPattern = /\s*\([A-Z][A-Za-zƏəÜüÖöĞğŞşÇçİı\/\-\s]+\)\s*$/;

let found = 0;
for (const q of data) {
  for (const opt of q.options) {
    if (hintPattern.test(opt.text)) {
      console.log(`ID: ${JSON.stringify(q.question).substring(0,60)}...`);
      console.log(`  [${opt.key}] "${opt.text.substring(opt.text.length - 50)}"`);
      found++;
    }
  }
}
console.log(`\nCəmi ${found} ipucu tapıldı.`);
