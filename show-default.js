const fs = require('fs');
const p = require('path').join(__dirname, 'src', 'ITEEquipmentManager.tsx');
console.log('exists:', fs.existsSync(p));
const c = fs.readFileSync(p, 'utf8');
const lines = c.split('\n');
for (let i = 233; i < 265; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
