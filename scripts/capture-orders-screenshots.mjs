import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.resolve(__dirname, '..', 'DO NOT UPLOAD - SCREENSHOTS');

const URL = 'https://atd-qbo-platform.web.app/orders';

async function captureScreenshots() {
  console.log(`Launching browser...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Capture console errors
  const jsErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      jsErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    jsErrors.push(`PageError: ${err.message}`);
  });

  console.log(`Navigating to ${URL}...`);
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (err) {
    console.log(`Navigation warning (may still have loaded): ${err.message}`);
  }

  // Wait a bit for any dynamic content to render
  await page.waitForTimeout(3000);

  // Check for error states in the DOM
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasCrashText = bodyText.includes('Cannot access') || 
                       bodyText.includes('Something went wrong') ||
                       bodyText.includes('ReferenceError');
  const hasOrdersContent = bodyText.toLowerCase().includes('orders') ||
                           bodyText.toLowerCase().includes('search') ||
                           bodyText.toLowerCase().includes('synced');

  console.log(`\n--- Page Content Analysis ---`);
  console.log(`Has crash text (Cannot access / Something went wrong / ReferenceError): ${hasCrashText}`);
  console.log(`Has orders-related content: ${hasOrdersContent}`);
  console.log(`JS Errors captured: ${jsErrors.length}`);
  if (jsErrors.length > 0) {
    jsErrors.forEach(e => console.log(`  - ${e}`));
  }

  // Screenshot 1: Full page
  const fullPagePath = path.join(screenshotDir, 'orders-v3-full-page.png');
  await page.screenshot({ path: fullPagePath, fullPage: true });
  console.log(`\n✓ Full page screenshot saved: ${fullPagePath}`);

  // Screenshot 2: Viewport (table area close-up)
  const viewportPath = path.join(screenshotDir, 'orders-v3-table-closeup.png');
  await page.screenshot({ path: viewportPath, fullPage: false });
  console.log(`✓ Table close-up screenshot saved: ${viewportPath}`);

  // Get page title and URL for verification
  const title = await page.title();
  const finalUrl = page.url();
  console.log(`\n--- Page Info ---`);
  console.log(`Title: ${title}`);
  console.log(`URL: ${finalUrl}`);

  await browser.close();
  
  // Exit with error if crash detected
  if (hasCrashText || jsErrors.some(e => e.includes('Cannot access') || e.includes('TDZ') || e.includes('before initialization'))) {
    console.log(`\n❌ CRASH DETECTED - TDZ error may still be present!`);
    process.exit(1);
  } else {
    console.log(`\n✅ No TDZ/crash detected - page appears healthy!`);
    process.exit(0);
  }
}

captureScreenshots().catch(err => {
  console.error(`Screenshot script failed: ${err.message}`);
  process.exit(2);
});
