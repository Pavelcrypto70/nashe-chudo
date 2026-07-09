/* Собирает sync-data.json: основная база + альбом (отдельные blob в MantleDB) */
const fs = require('fs');

function loadBlob(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    return d.value || null;
  } catch {
    return null;
  }
}

const main = JSON.parse(fs.readFileSync('sync-main.json', 'utf8'));
main.keys = main.keys || {};

const ultrasound = loadBlob('blob-ultrasound.json');
const story = loadBlob('blob-story.json');
if (ultrasound) main.keys.nashe_chudo_ultrasound = ultrasound;
if (story) main.keys.nashe_chudo_story_photos = story;

fs.writeFileSync('sync-data.json', JSON.stringify(main));
console.log('sync-data.json keys:', Object.keys(main.keys).length);
