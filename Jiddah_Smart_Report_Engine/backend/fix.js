const fs = require('fs');
let f = fs.readFileSync('src/components/ReportGeneratorClient.tsx', 'utf8');
f = f.replace(/\\`/g, '`');
f = f.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/ReportGeneratorClient.tsx', f);
