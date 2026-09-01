const fs = require('fs');
const files = [
  'C:/Users/JIDDAH/Desktop/jiddah-smart-report-engine/apps/backend/src/components/reports/PrimaryMOTReport.tsx',
  'C:/Users/JIDDAH/Desktop/jiddah-smart-report-engine/apps/backend/src/components/reports/PrimaryEOTReport.tsx',
  'C:/Users/JIDDAH/Desktop/jiddah-smart-report-engine/apps/backend/src/components/reports/PrimaryBOTReport.tsx',
  'C:/Users/JIDDAH/Desktop/jiddah-smart-report-engine/apps/backend/src/components/reports/P7EOTReport.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Update .line-text
  content = content.replace(/(\.line-text\s*\{[^}]*font-weight:\s*)(600|700)([^}]*\})/g, '$1900; font-size: 15px$3');
  
  // Update .data-indigo
  content = content.replace(/color:\s*var\(--data-indigo\);/g, 'color: var(--data-indigo); font-weight: 900; font-size: 15px;');
  
  // Update .data-navy
  content = content.replace(/(color:\s*var\(--data-navy\);[^}]*)\}/g, '$1 font-weight: 900; font-size: 15px; }');
  
  // Remove duplicates if the script was run multiple times accidentally
  content = content.replace(/font-weight: 900; font-size: 15px; font-weight: 900; font-size: 15px;/g, 'font-weight: 900; font-size: 15px;');
  
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
