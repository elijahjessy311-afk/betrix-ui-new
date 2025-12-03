// Backup of the previous (corrupted) app.js
// This file was created automatically as a backup before replacing src/app.js
import fs from 'fs';
try {
  const original = fs.readFileSync(new URL('./app.js', import.meta.url));
  fs.writeFileSync(new URL('./app.broken.js', import.meta.url), original);
} catch (e) {
  // best-effort; ignore if we can't create backup
}
