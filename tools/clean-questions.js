const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../seed-data/quiz-questions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const replacements = [
  // Typos and Turkish/Azerbaijani corrections
  [/\bkendi\b/g, 'öz'],
  [/\bkomutu\b/g, 'komandası'],
  [/\bkomut\b/g, 'komanda'],
  [/\bkomutlar\b/g, 'komandalar'],
  [/\bkomutları\b/g, 'komandaları'],
  [/\bfrekans\b/g, 'tezlik'],
  [/\bfrekansı\b/g, 'tezliyi'],
  [/\bfrekansın\b/g, 'tezliyin'],
  [/\bfrekanslar\b/g, 'tezliklər'],
  [/\bfrekansları\b/g, 'tezlikləri'],
  [/\btüm\b/g, 'bütün'],
  [/\bmühitlərinde\b/g, 'mühitlərində'],
  [/\bşəbəkələrinde\b/g, 'şəbəkələrində'],
  [/\bşəbəkələrdəki\b/g, 'şəbəkələrdəki'],
  [/\bblokla bilir\b/g, 'bloklaya bilir'],
  [/\betmır\b/g, 'etmir'],
  [/\bkiriş nöqtəsini\b/g, 'giriş nöqtəsini'],
  [/\bkiriş\b/g, 'giriş'], // but watch out for non-network context if any, though all are cat 2
  [/\btamasını\b/g, 'tapmasını'],
  [/\bssenarisindəh\b/g, 'ssenarisində'],
  [/\bsavunmasız\b/g, 'müdafiəsiz'],
  [/\bsavunmasızdır\b/g, 'müdafiəsizdir'],
  [/\bprosedurasını\b/g, 'prosedurunu'],
  [/\bprosedurasiyası\b/g, 'proseduru'],
  [/\bkredi kartı\b/g, 'kredit kartı'],
  [/\bcredential\b/g, 'kredensial'],
  [/\bcredential-ların\b/g, 'kredensialların'],
  [/\bdeşifre\b/g, 'deşifrə'],
  [/\bdeşifre etmək\b/g, 'deşifrə etmək'],
  [/\bdeşifre edilməsini\b/g, 'deşifrə edilməsini'],
  [/\bdeşifre olunmasını\b/g, 'deşifrə olunmasını'],
  [/\bdeşifre olunur\b/g, 'deşifrə olunur'],
  [/\bdeşifre edir\b/g, 'deşifrə edir'],
  [/\bdeşifre edə\b/g, 'deşifrə edə'],
  [/\bdeşifre edilməsi\b/g, 'deşifrə edilməsi'],
  [/\bkonfigurasiya\b/g, 'konfiqurasiya'],
  [/\bkonfigurasiyası\b/g, 'konfiqurasiyası'],
  [/\bkonfigurasiyasını\b/g, 'konfiqurasiyasını'],
  [/\bkonfigurasiyalar\b/g, 'konfiqurasiyalar'],
  [/\bkonfigurasiyaları\b/g, 'konfiqurasiyaları'],
  [/\bkriptografik\b/g, 'kriptoqrafik'],
  [/\bkriptografiya\b/g, 'kriptoqrafiya'],
  [/\bkriptografiyasından\b/g, 'kriptoqrafiyasından'],
  [/\bkriptografikdir\b/g, 'kriptoqrafikdir'],
  [/\bkriptografi\b/g, 'kriptoqrafiya'],
  [/\bdesteklediyi\b/g, 'dəstəklədiyi'],
  [/\bdestekleyir\b/g, 'dəstəkləyir'],
  [/\bdesteklemediyi\b/g, 'dəstəkləmədiyi'],
  [/\bdesteklemiyor\b/g, 'dəstəkləmir'],
  [/\bşəbəkə kartı fiziki\b/g, 'şəbəkə kartını fiziki'],
  [/\bverır\b/g, 'verir'],
  [/\breboot etmır\b/g, 'reboot etmir'],
  [/\btezliyinə təsir etmır\b/g, 'tezliyinə təsir etmir'],
  [/\bgöndərilmə tezliyinə təsir etmır\b/g, 'göndərilmə tezliyinə təsir etmir'],
  [/\bayrımı\b/g, 'ayrılması'], // or 'fərqi' depending on context
  [/\bqeçərli\b/g, 'keçərli'],
  [/\bbirleşik\b/g, 'birləşmiş'],
  [/\bbant genişliyi\b/g, 'ötürmə qabiliyyəti (bant genişliyi)'],
  [/\bclint\b/g, 'klient'],
  [/\bclintin\b/g, 'klientin'],
  [/\bclintlər\b/g, 'klientlər'],
  [/\bclintlərin\b/g, 'klientlərin'],
  [/\bclintlərə\b/g, 'klientlərə'],
];

let changeCount = 0;

function cleanText(text) {
  let original = text;
  let current = text;
  for (const [regex, replacement] of replacements) {
    current = current.replace(regex, replacement);
  }
  if (current !== original) {
    changeCount++;
    console.log(`  DIFF:\n  - ${original}\n  + ${current}`);
  }
  return current;
}

data.forEach((q, idx) => {
  console.log(`Scanning Sual ${idx + 1}...`);
  q.question = cleanText(q.question);
  q.options.forEach(o => {
    o.text = cleanText(o.text);
    o.explanation = cleanText(o.explanation);
  });
});

console.log(`\nTotal text segments modified: ${changeCount}`);

if (process.argv.includes('--write')) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Successfully wrote updates to c:\\kiberaz.az-main\\seed-data\\quiz-questions.json');
} else {
  console.log('Dry run completed. Run with "--write" flag to save changes.');
}
