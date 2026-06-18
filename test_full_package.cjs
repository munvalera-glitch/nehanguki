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
  },
  body: JSON.stringify(payload)
})
.then(res => res.arrayBuffer())
.then(buf => {
  fs.writeFileSync('test_output_full.pdf', Buffer.from(buf));
  console.log("Wrote test_output_full.pdf, size:", buf.byteLength);
})
.catch(err => console.log(err));
