const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app.js');
const src = fs.readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);

let bt = 0; // backticks
let par = 0;
let brace = 0;
let bracket = 0;

console.log('Analyzing', file, '(', lines.length, 'lines )');
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  for (let j = 0; j < L.length; j++) {
    const c = L[j];
    if (c === '`') bt++;
    if (c === '(') par++;
    if (c === ')') par--;
    if (c === '{') brace++;
    if (c === '}') brace--;
    if (c === '[') bracket++;
    if (c === ']') bracket--;
  }

  if (L.includes('```')) console.log('[TRIPLE_BACKTICK] line', i+1, ':', L.trim());
  if (bt % 2 !== 0) console.log('[UNPAIRED_BACKTICK] at line', i+1);
  if (par < 0) console.log('[UNMATCHED_PAREN )] at line', i+1);
  if (brace < 0) console.log('[UNMATCHED_BRACE }] at line', i+1);
  if (bracket < 0) console.log('[UNMATCHED_BRACKET ] ] at line', i+1);
}

console.log('\nTotals: backticks=', bt, 'parens delta=', par, 'braces delta=', brace, 'brackets delta=', bracket);

// Print a small vicinity around the first suspicious line if found
const firstBadLine = (function(){
  for (let i=0;i<lines.length;i++){
    if (lines[i].includes('```')) return i+1;
  }
  return null;
})();
if (firstBadLine) {
  console.log('\nContext around first triple-backtick at line', firstBadLine);
  const start = Math.max(0, firstBadLine-4);
  const end = Math.min(lines.length, firstBadLine+3);
  for (let k=start;k<end;k++) console.log((k+1).toString().padStart(4),'|',lines[k]);
}

process.exit(0);
