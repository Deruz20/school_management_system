const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/JIDDAH/Desktop/Design Report Center Interface_by_figma/src/app/components';
const destDir = 'C:/Users/JIDDAH/Desktop/jiddah-smart-report-engine/apps/backend/src/components/figma-ui';

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const files = ['types.ts', 'EmptyState.tsx', 'FloatingControls.tsx', 'SidePanel.tsx', 'TopToolbar.tsx', 'SearchFilterBar.tsx', 'DocumentCanvas.tsx', 'ReportCard.tsx'];

const twReplacements = [
  /blue-50/g, 'emerald-50',
  /blue-100/g, 'emerald-100',
  /blue-200/g, 'emerald-200',
  /blue-300/g, 'emerald-300',
  /blue-400/g, 'emerald-400',
  /blue-500/g, 'emerald-500',
  /blue-600/g, 'emerald-600',
  /blue-700/g, 'emerald-700',
];

const hexReplacements = [
  /#1d4ed8/gi, '#059669', 
  /#1e3a8a/gi, '#065f46', 
  /#dbeafe/gi, '#d1fae5', 
  /#60a5fa/gi, '#34d399', 
  /#93c5fd/gi, '#6ee7b7', 
  /#eff6ff/gi, '#ecfdf5', 
  /#3b82f6/gi, '#10b981', 
];

files.forEach(f => {
  let content = fs.readFileSync(path.join(srcDir, f), 'utf-8');
  
  if (f !== 'types.ts') {
    for (let i = 0; i < twReplacements.length; i += 2) {
      content = content.replace(twReplacements[i], twReplacements[i+1]);
    }
    for (let i = 0; i < hexReplacements.length; i += 2) {
      content = content.replace(hexReplacements[i], hexReplacements[i+1]);
    }
  }

  if (f === 'SearchFilterBar.tsx') {
    content = content.replace("import { mockStudents, mockClasses } from './mock-data';", "import type { Student, ClassInfo } from './types';");
    content = content.replace("interface SearchFilterBarProps {", "interface SearchFilterBarProps {\n  students: Student[];\n  classes: ClassInfo[];");
    content = content.replace("export function SearchFilterBar({ filterState", "export function SearchFilterBar({ students, classes, filterState");
    content = content.replace(/mockStudents/g, "students");
    content = content.replace(/mockClasses/g, "classes");
  }

  if (f === 'DocumentCanvas.tsx' || f === 'SidePanel.tsx') {
    content = content.replace("import { mockStudents, mockClasses } from './mock-data';", "");
  }

  fs.writeFileSync(path.join(destDir, f), content);
});
console.log('Copied and transformed.');
