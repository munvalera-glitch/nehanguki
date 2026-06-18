import fs from "fs";
const formData = new FormData();
formData.append("image", new Blob([fs.readFileSync("large_test_image.jpg")]), "crop.jpg");
formData.append("docType", "passport");
fetch("http://localhost:3001/api/document/process-scan-preview", {
  method: "POST",
  body: formData
}).then(res => res.text().then(text => console.log(res.status, text))).catch(console.error);
