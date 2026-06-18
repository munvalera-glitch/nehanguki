const fs = require('fs');
fetch('http://localhost:3001/api/generate/package-download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-bypass-auth': 'test'
  },
  body: JSON.stringify({
    visaType: "F5",
    action: "initial",
    housingType: "my_name",
    surname: "TEST",
    givenNames: "USER",
    sex: "M",
    isStudent: false,
    occupationType: "warehouse",
    birthDate: "1980-01-01",
    idNumber: "800101-1234567",
    nationality: "KAZAKHSTAN",
    phone: "010-1234-5678",
    guarantor_surname: "G_SUR",
    guarantor_givenNames: "G_GIVEN",
    guarantor_sex: "M",
    guarantor_nationality: "KOREA"
  })
})
.then(res => res.arrayBuffer())
.then(buf => fs.writeFileSync('test_output_auth_bypass.pdf', Buffer.from(buf)));
