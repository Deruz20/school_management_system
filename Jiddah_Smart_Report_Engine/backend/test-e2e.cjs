const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const backendUrl = `http://localhost:3000`;

  // Go to Backend Terms
  try {
    console.log(`Navigating to ${backendUrl}/admin/terms...`);
    await page.goto(`${backendUrl}/admin/terms`);
    await page.waitForLoadState('networkidle');

    const setActiveBtn = await page.locator('button:has-text("Set as Active")').first();
    if (await setActiveBtn.isVisible()) {
      console.log('Found an inactive term, setting as active...');
      await setActiveBtn.click();
      await page.waitForTimeout(2000); // Wait for fetch
    } else {
      console.log('No "Set as Active" button found (maybe one is already active or no terms).');
    }
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    const activeSpans = await page.locator('span:has-text("Active")').count();
    console.log(`Terms persistence check: Found ${activeSpans} Active term(s) after refresh.`);
  } catch (e) {
    console.log('Error in Terms test:', e.message);
  }

  // Go to Circular MOT
  try {
    console.log(`Navigating to ${backendUrl}/admin/circular/mot-entry...`);
    await page.goto(`${backendUrl}/admin/circular/mot-entry`);
    await page.waitForLoadState('networkidle');

    console.log('Filling Circular MOT marks...');
    // Select first subject
    const subjectSelect = await page.locator('.subject-select').first();
    await subjectSelect.selectOption({ index: 1 });

    const botInput = await page.locator('.bot-input').first();
    await botInput.fill('55');
    const motInput = await page.locator('.mot-input').first();
    await motInput.fill('65');

    console.log('Saving Circular MOT...');
    page.on('dialog', async dialog => {
      console.log('Dialog:', dialog.message());
      await dialog.accept();
    });
    
    const saveBtn = await page.locator('button:has-text("Save")').first();
    await saveBtn.click();
    await page.waitForTimeout(2000);

    console.log('Refreshing Circular page...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const botVal = await page.locator('.bot-input').first().inputValue();
    const motVal = await page.locator('.mot-input').first().inputValue();
    console.log(`Persisted Circular Marks -> BOT: ${botVal}, MOT: ${motVal}`);
    if (botVal === '55' && motVal === '65') console.log('PASS: Circular marks persisted.');
    else console.log('FAIL: Circular marks did not persist.');
  } catch (e) {
    console.log('Error in Circular test:', e.message);
  }

  // Go to Theology MOT
  try {
    console.log(`Navigating to ${backendUrl}/admin/theology/mot-entry...`);
    await page.goto(`${backendUrl}/admin/theology/mot-entry`);
    await page.waitForLoadState('networkidle');

    console.log('Filling Theology MOT marks...');
    const theoMotInput = await page.locator('.theology-mot-input').first();
    await theoMotInput.fill('85');

    console.log('Saving Theology MOT...');
    const saveTheoBtn = await page.locator('button:has-text("Save")').first();
    await saveTheoBtn.click();
    await page.waitForTimeout(2000);

    console.log('Refreshing Theology page...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    const savedTheoMot = await page.locator('.theology-mot-input').first().inputValue();
    console.log(`Persisted Theology MOT: ${savedTheoMot}`);
    if (savedTheoMot === '85') console.log('PASS: Theology marks persisted.');
    else console.log('FAIL: Theology marks did not persist.');
  } catch (e) {
    console.log('Error in Theology test:', e.message);
  }

  await browser.close();
})();
