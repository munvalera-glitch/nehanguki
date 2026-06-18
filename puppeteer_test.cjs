const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // Navigate to app
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  
  // Login
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('button'));
    const loginBtn = navButtons.find(b => b.innerText.includes('Вход') || b.innerText.includes('Login') || b.innerText.includes('로그인'));
    if (loginBtn) loginBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    if (inputs.length >= 2) {
      inputs[0].value = 'munvalera@gmail.com';
      // Dispatch React event
      let event = new Event('input', { bubbles: true });
      inputs[0].dispatchEvent(event);

      inputs[1].value = 'password';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitBtn = buttons.find(b => b.innerText.includes('Войти') || b.innerText.includes('Log in') || b.innerText.includes('로그인'));
      if (submitBtn) submitBtn.click();
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Create a draft package first to ensure there's one in the cart
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const myPageBtn = buttons.find(b => b.innerText.includes('Корзина') || b.innerText.includes('Cart') || b.innerText.includes('My Page'));
    if (myPageBtn) myPageBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'cart.png' });

  // Find "Resume" button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const resumeBtn = buttons.find(b => b.innerText.includes('Продолжить') || b.innerText.includes('Resume') || b.innerText.includes('이어서 작성'));
    if (resumeBtn) {
       console.log("Clicking Resume!");
       resumeBtn.click();
    } else {
       console.log("Resume button not found");
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'after_resume.png' });
  
  await browser.close();
})();
