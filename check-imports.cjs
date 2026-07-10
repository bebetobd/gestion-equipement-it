const fs = require('fs');
const c = fs.readFileSync('src/ITEEquipmentManager.tsx', 'utf8');
const imports = c.match(/from\s+['"][^'"]+['"]/g);
if (imports) imports.forEach(i => console.log(i));
