const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Fetching enrollments...');
  const res = await fetch('http://localhost:3000/api/enrollments');
  const enrollments = await res.json();
  
  const termRes = await fetch('http://localhost:3000/api/academic-terms');
  const terms = await termRes.json();
  const termId = terms.find(t => t.is_current)?.id || terms[0]?.id;

  if (!termId) {
    console.error('No term found');
    process.exit(1);
  }

  // Find students by section
  const nursery = enrollments.find(e => e.section === 'nursery');
  const lower = enrollments.find(e => e.section === 'lower_primary');
  const p7 = enrollments.find(e => e.circular_class.toLowerCase() === 'p.7');

  const targets = [
    { name: 'NurseryMOTReport', enrollment_id: nursery?.enrollment_id, score_type: 'mot' },
    { name: 'NurseryEOTReport', enrollment_id: nursery?.enrollment_id, score_type: 'eot' },
    { name: 'NurseryTheologyEOTReport', enrollment_id: nursery?.enrollment_id, score_type: 'eot', theology: true },
    { name: 'PrimaryMOTReport', enrollment_id: lower?.enrollment_id, score_type: 'mot' },
    { name: 'PrimaryEOTReport', enrollment_id: lower?.enrollment_id, score_type: 'eot' },
    { name: 'TheologyMOTReport', enrollment_id: lower?.enrollment_id, score_type: 'mot', theology: true },
    { name: 'P7EOTReport', enrollment_id: p7?.enrollment_id, score_type: 'eot' },
  ];

  for (const t of targets) {
    if (!t.enrollment_id) {
      console.log(`Skipping ${t.name} due to missing enrollment`);
      continue;
    }

    const url = `http://localhost:3000/admin/reports?term_id=${termId}&enrollment_id=${t.enrollment_id}&score_type=${t.score_type}`;
    console.log(`Navigating to ${t.name}...`);
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Select theology if needed
    if (t.theology) {
      await page.locator('button:has-text("Theology Report")').click();
      await page.waitForTimeout(1000);
    }
    
    // Hide controls so they don't appear in PDF
    await page.evaluate(() => {
      const controls = document.querySelector('.preview-controls');
      if (controls) controls.style.display = 'none';
    });

    const pdfPath = `C:\\Users\\JIDDAH\\Desktop\\jiddah-smart-report-engine\\apps\\backend\\pdf_${t.name}.pdf`;
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    console.log(`Saved ${pdfPath}`);
  }

  await browser.close();
})();
