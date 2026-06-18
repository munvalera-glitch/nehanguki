const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  try {
    await page.goto('http://localhost:5173/japan', { waitUntil: 'networkidle2' });
    console.log("Page loaded");
    
    // find the button "Начать заполнение" and click it
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.textContent.includes('Начать заполнение'));
      if (startBtn) startBtn.click();
    });
    
    await new Promise(r => setTimeout(r, 2000));
    console.log("Clicked step 0 button");
    
  } catch (err) {
    console.log("Error:", err);
  }
  
  await browser.close();
})();
