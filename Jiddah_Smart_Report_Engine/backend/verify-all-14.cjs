const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });

  const termId = '0b615b81-d1f5-46c5-8f6a-6869a8b163a3'; // Fallback term ID, let's just fetch it
  
  const termRes = await fetch('http://localhost:3000/api/academic-terms');
  let realTermId = termId;
  try {
      const terms = await termRes.json();
      realTermId = terms.find(t => t.is_current)?.id || terms[0]?.id || termId;
  } catch (e) {
      console.log('Using fallback term ID');
  }

  const shortNurseryId = "61daa288-c658-41b3-a6bc-cfcb380bdd3c";
  const longNurseryId = "61daa288-c658-41b3-a6bc-cfcb380bdd3c"; // Nursery only has one in mock, but whatever

  const shortPrimaryId = "68609058-aea3-4dbb-8824-979eb0c4802f"; // BIRUNGI HANIFAH
  const longPrimaryId = "bda113c0-9731-4500-963c-48bf9050fca8"; // NAKAZZI FAHIMAH

  const shortP7Id = "a6cef584-6ce6-4bfb-8b98-a2e3b2f771c6"; // Hatima Hassan
  const longP7Id = "1d994c82-784b-48d8-ac37-f5b53cf49eff"; // Katogo Ali

  const targets = [
    { name: 'NurseryMOTReport_short', enrollment_id: shortNurseryId, score_type: 'mot' },
    { name: 'NurseryMOTReport_long', enrollment_id: longNurseryId, score_type: 'mot' },
    { name: 'NurseryEOTReport_short', enrollment_id: shortNurseryId, score_type: 'eot' },
    { name: 'NurseryEOTReport_long', enrollment_id: longNurseryId, score_type: 'eot' },
    { name: 'NurseryTheologyEOTReport_short', enrollment_id: shortNurseryId, score_type: 'eot', theology: true },
    { name: 'NurseryTheologyEOTReport_long', enrollment_id: longNurseryId, score_type: 'eot', theology: true },
    
    { name: 'PrimaryMOTReport_short', enrollment_id: shortPrimaryId, score_type: 'mot' },
    { name: 'PrimaryMOTReport_long', enrollment_id: longPrimaryId, score_type: 'mot' },
    { name: 'PrimaryEOTReport_short', enrollment_id: shortPrimaryId, score_type: 'eot' },
    { name: 'PrimaryEOTReport_long', enrollment_id: longPrimaryId, score_type: 'eot' },
    
    { name: 'TheologyMOTReport_short', enrollment_id: shortPrimaryId, score_type: 'mot', theology: true },
    { name: 'TheologyMOTReport_long', enrollment_id: longPrimaryId, score_type: 'mot', theology: true },
    
    { name: 'P7EOTReport_short', enrollment_id: shortP7Id, score_type: 'eot' },
    { name: 'P7EOTReport_long', enrollment_id: longPrimaryId, score_type: 'eot' }, // Use Nakazzi for P7 long as requested
  ];

  for (const t of targets) {
    const context = await browser.newContext();
    const page = await context.newPage();

    const url = `http://localhost:3000/admin/reports?term_id=${realTermId}&enrollment_id=${t.enrollment_id}&score_type=${t.score_type}`;
    console.log(`Navigating to ${t.name}...`);
    await page.goto(url, { waitUntil: 'networkidle' });
    
    if (t.theology) {
      try {
        await page.waitForSelector('button:has-text("Theology Report")', { timeout: 10000 });
        await page.locator('button:has-text("Theology Report")').click();
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`Warning: Theology Report button not found for ${t.name}`);
      }
    }
    
    await page.evaluate(() => {
      const controls = document.querySelector('.preview-controls');
      if (controls) controls.style.display = 'none';
    });

    const pdfPath = `C:\\Users\\JIDDAH\\Desktop\\jiddah-smart-report-engine\\apps\\backend\\verify_${t.name}.pdf`;
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    console.log(`Saved ${pdfPath}`);
    await context.close();
  }

  await browser.close();
})();
