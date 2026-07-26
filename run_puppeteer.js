const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR STACK:', error.stack));
  
  await page.goto('file://' + path.resolve('app/src/main/assets/index.html'));
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Try to click QUICK MATCH
  const quickBtn = await page.$('.btn-play-quick');
  if (quickBtn) {
    console.log("Found quick match button, clicking...");
    await quickBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Clicked quick match. Checking match state...");
    const text = await page.evaluate(() => document.getElementById('timer-display')?.textContent);
    console.log("Timer display:", text);
  } else {
    console.log("Quick match button not found!");
  }
  
  await browser.close();
})();
