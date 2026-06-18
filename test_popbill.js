const popbill = require('popbill');
const faxService = popbill.FaxService();
console.log("Methods in faxService:");
console.log(Object.keys(faxService).filter(k => k.toLowerCase().includes('fax')));
