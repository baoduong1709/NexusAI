const fs = require('fs');
const content = fs.readFileSync('logs/ai-requests.log', 'utf8');
const entries = content.split('----------------------------------------------------------------------');
console.log("Total entries:", entries.length);
entries.forEach((entry, idx) => {
  if (entry.includes('GLAPP-2')) {
    console.log(`=== Entry #${idx} matches ===`);
    console.log(entry.substring(0, 1000) + "...\n");
  }
});
