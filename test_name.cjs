const { execSync } = require('child_process');
const fs = require('fs');
const payload = {
  visaType: "F4",
  action: "password_recovery",
  fullName: "TSOY MORANA",
  idNumber: "810708-6140178",
  phone: "010-1234-5678"
};
fs.writeFileSync('draft.json', JSON.stringify(payload));
try {
  execSync('python3 pdf/pdf_generator.py draft.json test_out.pdf', {stdio: 'inherit'});
  console.log("PDF generated.");
} catch(e) {
  console.error(e);
}
