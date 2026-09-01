const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/login...');
  try {
    await page.goto('http://localhost:3000/login');
  } catch (e) {
    console.log('Failed to reach port 3000, trying 3001...');
    await page.goto('http://localhost:3001/login');
  }

  // Log in
  console.log('Logging in...');
  await page.fill('input[type="email"]', 'hassanhatima20@gmail.com');
  await page.fill('input[type="password"]', 'Jiddah_eyzrtuzbjt');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/admin**');
  console.log('Logged in successfully.');

  // Set active term
  console.log('Navigating to /admin/terms...');
  await page.goto(page.url().replace('/admin', '/admin/terms'));
  await page.waitForLoadState('networkidle');

  const setActiveBtn = await page.locator('button:has-text("Set as Active")').first();
  if (await setActiveBtn.isVisible()) {
    console.log('Setting term as active...');
    await setActiveBtn.click();
    await page.waitForTimeout(2000); // Wait for fetch to complete
  } else {
    console.log('No inactive terms to activate or no terms present.');
  }

  // Test Circular MOT Entry
  console.log('Navigating to /admin/circular/mot-entry...');
  await page.goto(page.url().replace('/admin/terms', '/admin/circular/mot-entry'));
  await page.waitForLoadState('networkidle');

  console.log('Filling Circular MOT marks...');
  // Select first subject
  const subjectSelect = await page.locator('.subject-select').first();
  await subjectSelect.selectOption({ index: 1 }); // Mathematics or first option

  // Fill BOT and MOT
  const botInput = await page.locator('.bot-input').first();
  await botInput.fill('65');

  const motInput = await page.locator('.mot-input').first();
  await motInput.fill('75');

  // Save
  console.log('Saving Circular MOT...');
  const saveBtn = await page.locator('button:has-text("Save")').first();
  
  page.on('dialog', async dialog => {
    console.log('Dialog message:', dialog.message());
    await dialog.accept();
  });
  
  await saveBtn.click();
  await page.waitForTimeout(1000);

  // Test Theology MOT Entry
  console.log('Navigating to /admin/theology/mot-entry...');
  await page.goto(page.url().replace('/admin/circular/mot-entry', '/admin/theology/mot-entry'));
  await page.waitForLoadState('networkidle');

  console.log('Filling Theology MOT marks...');
  const theoMotInput = await page.locator('.theology-mot-input').first();
  await theoMotInput.fill('80');

  console.log('Saving Theology MOT...');
  const saveTheoBtn = await page.locator('button:has-text("Save")').first();
  await saveTheoBtn.click();
  await page.waitForTimeout(1000);

  console.log('Refreshing theology to confirm persistence...');
  await page.reload();
  await page.waitForLoadState('networkidle');

  const savedTheoMot = await page.locator('.theology-mot-input').first().inputValue();
  console.log('Persisted Theology MOT:', savedTheoMot);
  if (savedTheoMot === '80') {
    console.log('SUCCESS: Theology MOT persisted correctly.');
  } else {
    console.log('FAIL: Theology MOT did not persist correctly.');
  }

  await browser.close();
  console.log('E2E TEST COMPLETED');
})();
