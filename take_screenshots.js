import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = 'file://' + path.resolve(__dirname, './dist/index.html');
const outputDir = '/Users/cheosjang/.gemini/antigravity/brain/86f2aa35-952b-4a60-844c-040aef9f6477'; // Artifact Directory Path

const screens = [
  { name: '1_start', hash: '#start' },
  { name: '2_gameplay', hash: '#gameplay' },
  { name: '3_levelup', hash: '#levelup' },
  { name: '4_result', hash: '#result' }
];

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  for (const screen of screens) {
    const url = htmlPath + screen.hash;
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Wait a brief moment for any animations/rendering to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const screenshotPath = path.join(outputDir, `${screen.name}.png`);
    console.log(`Saving screenshot to ${screenshotPath}...`);
    await page.screenshot({ path: screenshotPath });
  }

  await browser.close();
  console.log('Screenshots complete!');
})().catch(err => {
  console.error('Error taking screenshots:', err);
  process.exit(1);
});
