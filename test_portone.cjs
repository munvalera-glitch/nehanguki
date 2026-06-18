const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://hikoreaforms.com/', { waitUntil: 'networkidle2' });
  
  const result = await page.evaluate(async () => {
    try {
      const response = await window.PortOne.requestPayment({
        storeId: "store-d97486ea-22f9-4ed3-bd29-21ec955cd507",
        channelKey: "channel-key-3dec5c74-6fe8-4452-bb1a-93ac70c56061",
        paymentId: `payment-${Date.now()}`,
        orderName: "Test Document",
        totalAmount: 1000,
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          fullName: "Guest",
          email: "test@example.com",
          phoneNumber: "010-0000-0000",
        }
      });
      return { success: true, response };
    } catch (err) {
      return { success: false, error: err.toString(), message: err.message };
    }
  });
  
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
