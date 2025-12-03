const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'app.js');
const src = fs.readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('`')) {
    console.log('LINE', i + 1);
    const start = Math.max(0, i - 2);
    const end = Math.min(lines.length, i + 3);
    for (let k = start; k < end; k++) {
      console.log((k + 1).toString().padStart(4), '|', lines[k]);
    }
    console.log('---');
  }
}
console.log('Done');
