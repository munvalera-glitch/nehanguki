const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Navigating to local app...");
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  
  // Login
  console.log("Logging in...");
  await page.evaluate(() => {
    const loginBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Вход'));
    if (loginBtn) loginBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    if (inputs.length >= 2) {
      inputs[0].value = 'user@example.com';
      inputs[1].value = 'password';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    }
    const buttons = Array.from(document.querySelectorAll('button'));
    const submitBtn = buttons.find(b => b.innerText === 'Войти' || b.innerText === 'Login');
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  
  // Fill out the application form just enough to click Generate
  console.log("Filling out form to generate PDF...");
  await page.evaluate(() => {
    // Fill required fields for self
    const inputs = document.querySelectorAll('input');
    // First input is surname, second is given names, then dob
    if (inputs.length > 5) {
      inputs[0].value = 'TEST'; // surname
      inputs[1].value = 'USER'; // given names
      inputs[2].value = '1990-01-01'; // dob
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Set address
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const genBtn = buttons.find(b => b.innerText.includes('Сгенерировать') || b.innerText.includes('Generate PDF'));
    if (genBtn) genBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // The application might fail to generate if we don't have enough data, but assuming it goes to cart prompt
  await page.screenshot({ path: 'cart_prompt.png' });
  console.log("Saved cart_prompt.png");

  // Click Add to Cart
  console.log("Clicking Add to Cart...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b => b.innerText.includes('Cart') || b.innerText.includes('корзину') || b.innerText.includes('Add to Cart'));
    if (addBtn) addBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Should see Success modal
  await page.screenshot({ path: 'cart_success.png' });
  console.log("Saved cart_success.png");

  // Click Go to Cart
  console.log("Clicking Go to Cart...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const goCartBtn = buttons.find(b => b.innerText.includes('Перейти') || b.innerText.includes('Go'));
    if (goCartBtn) goCartBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Should be on My Page (Cart)
  await page.screenshot({ path: 'my_page.png' });
  console.log("Saved my_page.png");

  await browser.close();
  console.log("Done!");
})();
