const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().includes('/api/auth/me')) {
      request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 1, email: 'test@test.com', credits: 0 } })
      });
    } else if (request.url().includes('/api/user/packages')) {
      request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          packages: [
            { id: '1', paymentStatus: 'unpaid', payload: { action: 'initial', visaType: 'F4', applicant: {} } },
            { id: '2', paymentStatus: 'paid', payload: { action: 'initial', visaType: 'F1', applicant: {} } }
          ]
        })
      });
    } else {
      request.continue();
    }
  });

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://127.0.0.1:5173/?step=my-page', { waitUntil: 'networkidle2' });
  
  try {
    await page.waitForSelector('vite-error-overlay', { timeout: 3000 });
    const overlay = await page.evaluate(() => {
      const viteOverlay = document.querySelector('vite-error-overlay');
      if (viteOverlay && viteOverlay.shadowRoot) {
        const msg = viteOverlay.shadowRoot.querySelector('.message-body')?.innerText;
        return msg || viteOverlay.shadowRoot.innerHTML;
      }
      return null;
    });
    console.log('VITE ERROR OVERLAY:', overlay);
  } catch (e) {
    console.log('No Vite error overlay found.');
    console.log('HTML:', await page.evaluate(() => document.body.innerHTML));
  }
  
  await browser.close();
})();
