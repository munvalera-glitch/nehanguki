const popbill = require('popbill');
require('dotenv').config();

popbill.config({
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: true,
});
const faxService = popbill.FaxService();

const CorpNum = process.env.POPBILL_CORP_NUM;

faxService.getFaxResult(CorpNum, "026060123212100001", function(result) {
    console.log(JSON.stringify(result, null, 2));
}, function(err) {
    console.error("Error!", err);
});
