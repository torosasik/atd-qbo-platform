import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const SCREENSHOT_DIR = join(process.cwd(), 'DO NOT UPLOAD - SCREENSHOOTS');
const BASE_URL = 'https://atd-qbo-platform.web.app';

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Capture API response bodies
  const apiData = {};
  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('/api/') && resp.status() === 200) {
      try {
        const body = await resp.text();
        apiData[url] = body.substring(0, 2000);
      } catch {}
    }
  });

  console.log('1. Navigating to app and PO Create New...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const poNavLink = await page.$('a:has-text("Purchase Orders")');
  if (poNavLink) await poNavLink.click();
  await page.waitForTimeout(2000);

  const createBtn = await page.$('button:has-text("Create New")');
  if (createBtn) await createBtn.click();
  await page.waitForTimeout(10000); // Wait for all data to load

  // Take all required screenshots
  console.log('2. Taking screenshots...');

  // Full form
  await page.screenshot({ path: join(SCREENSHOT_DIR, 'po-create-new-full.png'), fullPage: true });

  // Vendor area - find the vendor section
  const vendorSection = await page.$('text=Vendor *') || await page.$('text=Vendor');
  if (vendorSection) {
    const box = await vendorSection.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'po-vendor-area.png'),
        clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 10), width: 600, height: 250 }
      });
    }
  }

  // Click vendor search input and screenshot
  const vendorInput = await page.$('input[placeholder="Search vendors..."]');
  if (vendorInput) {
    await vendorInput.click({ force: true });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'po-vendor-dropdown-open.png'), fullPage: true });
  }

  // Item search area
  const itemInput = await page.$('input[placeholder="Loading items..."]') || 
                    await page.$('input[placeholder*="item" i]') ||
                    await page.$('input[placeholder*="search" i]');
  if (itemInput) {
    const box = await itemInput.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'po-item-search-area.png'),
        clip: { x: Math.max(0, box.x - 50), y: Math.max(0, box.y - 50), width: box.width + 100, height: box.height + 100 }
      });
    }

    // Try to click and open item search
    await itemInput.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'po-item-search-open.png'), fullPage: true });
  }

  // Print API response data
  console.log('\n=== API Response Data ===');
  for (const [url, body] of Object.entries(apiData)) {
    const shortUrl = url.replace(BASE_URL, '');
    console.log(`\n--- ${shortUrl} ---`);
    console.log(body.substring(0, 500));
  }

  // Get detailed form state
  const formState = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    return Array.from(inputs).map(el => ({
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      disabled: el.disabled,
      value: el.value?.substring(0, 50),
      className: el.className?.substring(0, 80)
    }));
  });
  console.log('\n=== Form State ===');
  console.log(JSON.stringify(formState, null, 2));

  // Check for any error messages on page
  const errors = await page.$$eval('[class*="error"], [class*="Error"], [role="alert"], .text-red-500, .text-red-600', 
    els => els.map(e => e.textContent.trim()).filter(t => t)
  );
  console.log('\n=== Error Messages ===');
  console.log(errors.length ? errors.join('\n') : 'No error messages found');

  // Get the vendor dropdown HTML structure
  const vendorDropdownHtml = await page.evaluate(() => {
    const el = document.querySelector('input[placeholder="Search vendors..."]');
    if (!el) return 'No vendor input found';
    // Go up to find the container
    let container = el.parentElement;
    for (let i = 0; i < 5; i++) {
      if (container) container = container.parentElement;
    }
    return container?.innerHTML?.substring(0, 3000) || 'No container found';
  });
  console.log('\n=== Vendor Dropdown HTML ===');
  console.log(vendorDropdownHtml.substring(0, 1500));

  await browser.close();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
