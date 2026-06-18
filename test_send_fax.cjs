const popbill = require('popbill');
require('dotenv').config();

popbill.config({
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: process.env.POPBILL_IS_TEST === 'true',
});
const faxService = popbill.FaxService();

const CorpNum = process.env.POPBILL_CORP_NUM;
const SenderNum = process.env.POPBILL_SENDER_NUM;

faxService.sendFax(CorpNum, SenderNum, "050-4466-4550", "Test", ["/Users/macvalera/Documents/HIkoreaFORMS/package.json"], "", "", "", "", "", "", function(receiptNum) {
    console.log("Success! Receipt:", receiptNum);
}, function(err) {
    console.error("Error!", err);
});
