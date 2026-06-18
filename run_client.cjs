const fs = require('fs');

async function testAPI() {
  const FormData = (await import('formdata-node')).FormData;
  const fileFromPath = (await import('formdata-node/fileFromPath')).fileFromPath;
  const fetch = (await import('node-fetch')).default;

  const dummyPath = './dummy.jpg';
  fs.writeFileSync(dummyPath, 'fake image data');

  console.log("Testing Standard Application...");
  let form = new FormData();
  form.append('payload', JSON.stringify({
    action: "initial",
    visaType: "F4",
    givenNames: "TEST",
    surname: "USER"
  }));
  form.append('passport', await fileFromPath(dummyPath));
  form.append('idCard', await fileFromPath(dummyPath));
  form.append('signature', await fileFromPath(dummyPath));

  let res = await fetch('http://localhost:3002/api/generate/package-draft', {
    method: 'POST',
    body: form
  });
  let data = await res.json();
  let pkgId = data.id || (data.package && data.package.id);
  console.log("Draft created with ID:", pkgId);

  // Trigger download (which generates the PDF and copies the files)
  res = await fetch('http://localhost:3002/api/generate/package-download', {
    method: 'POST',
    body: form
  });
  
  console.log("Download response status:", res.status);
  
  // Verify folder
  const uploadDir = './data/uploads/' + pkgId;
  if (fs.existsSync(uploadDir)) {
    console.log("Standard Application Upload Dir Files:", fs.readdirSync(uploadDir));
  } else {
    console.log("Upload dir not found!");
  }

  console.log("\\nTesting Password Recovery...");
  form = new FormData();
  form.append('payload', JSON.stringify({
    action: "password_recovery",
    givenNames: "TEST",
    surname: "USER"
  }));
  form.append('idCard', await fileFromPath(dummyPath));
  form.append('idCardBack', await fileFromPath(dummyPath));
  form.append('signature', await fileFromPath(dummyPath));

  res = await fetch('http://localhost:3002/api/generate/package-draft', {
    method: 'POST',
    body: form
  });
  data = await res.json();
  pkgId = data.id || (data.package && data.package.id);
  console.log("Draft created with ID:", pkgId);
  
  res = await fetch('http://localhost:3002/api/generate/package-download', {
    method: 'POST',
    body: form
  });
  console.log("Download response status:", res.status);
  
  const uploadDir2 = './data/uploads/' + pkgId;
  if (fs.existsSync(uploadDir2)) {
    console.log("Password Recovery Upload Dir Files:", fs.readdirSync(uploadDir2));
  } else {
    console.log("Upload dir not found!");
  }
}

testAPI().catch(console.error);
