const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });
  
  await page.goto('https://hikoreaforms.com/?step=my-page', { waitUntil: 'networkidle0' });
  
  // Wait for React to mount
  await new Promise(r => setTimeout(r, 2000));
  
  // Try to execute the PortOne call directly
  try {
    const result = await page.evaluate(async () => {
      if (!window.PortOne) return "No PortOne";
      try {
        const response = await window.PortOne.requestPayment({
          storeId: "store-15173ba3-9e77-4429-a0b6-b9268b15ae94",
          channelKey: "channel-key-cf156daf-276b-4854-b84d-0c00ec27b48c", 
          paymentId: `payment${new Date().getTime()}`,
          orderName: "Document Generation",
          totalAmount: 3000,
          currency: "KRW",
          payMethod: "CARD",
          customer: {
            fullName: "Guest",
            email: "test@test.com",
            phoneNumber: "010-0000-0000",
          },
        });
        return response;
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    });
    console.log("PortOne result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Puppeteer evaluation error:", err);
  }
  
  await browser.close();
})();
