import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target index.html path in build folder
const htmlPath = 'file://' + path.resolve(__dirname, './dist/index.html');

(async () => {
  console.log('Launching Puppeteer to audit runtime console...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    console.log(`[BROWSER CONSOLE] [${msg.type()}]: ${text}`);
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.error(`[BROWSER UNCAUGHT ERROR]: ${err.toString()}`);
  });

  const screens = ['#start', '#gameplay', '#levelup', '#result'];

  for (const hash of screens) {
    const targetUrl = htmlPath + hash;
    console.log(`Auditing screen: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await browser.close();

  console.log('\n--- AUDIT RESULTS ---');
  console.log(`Total Console Messages: ${consoleMessages.length}`);
  console.log(`Total Uncaught Exceptions: ${pageErrors.length}`);
  if (pageErrors.length > 0) {
    console.error('FAIL: Uncaught exceptions found!');
    process.exit(1);
  } else {
    console.log('PASS: No uncaught exceptions detected!');
    process.exit(0);
  }
})().catch(err => {
  console.error('Audit runner error:', err);
  process.exit(1);
});
