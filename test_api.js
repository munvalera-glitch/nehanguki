const fs = require('fs');

const payload = {
  visaType: "F5",
  action: "initial",
  housingType: "my_name",
  surname: "TEST",
  givenNames: "USER",
  sex: "M",
  isStudent: false,
  occupationType: "unemployed",
  birthDate: "1980-01-01",
  idNumber: "800101-1234567",
  nationality: "KAZAKHSTAN",
  phone: "010-1234-5678",
  guarantor_surname: "G_SUR",
  guarantor_givenNames: "G_GIVEN",
  guarantor_sex: "M",
  guarantor_nationality: "KOREA"
};

fetch('http://localhost:3001/api/generate/package-download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // We need to bypass auth or pass a fake token if authenticateToken is active!
  },
  body: JSON.stringify(payload)
})
.then(res => {
  console.log("Status:", res.status);
  return res.arrayBuffer();
})
.then(buf => {
  fs.writeFileSync('test_output.pdf', Buffer.from(buf));
  console.log("Wrote test_output.pdf, size:", buf.byteLength);
})
.catch(err => console.log(err));
