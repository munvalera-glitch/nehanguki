const popbill = require('popbill');
require('dotenv').config();

popbill.config({
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: false,
});
const faxService = popbill.FaxService();
const CorpNum = process.env.POPBILL_CORP_NUM;
const SenderNum = process.env.POPBILL_SENDER_NUM;
const ReceiverNum = "050-4466-4550"; 

console.log("Sending test fax in production to", ReceiverNum);
faxService.sendFax(CorpNum, SenderNum, ReceiverNum, "Test Fax", ["/Users/macvalera/Documents/HIkoreaFORMS/package.json"], "", "", "", "", "", "", function(receiptNum) {
    console.log("Success! Receipt:", receiptNum);
    
    // Check status after 3 seconds
    setTimeout(() => {
        faxService.getFaxResult(CorpNum, receiptNum, function(result) {
            console.log("Fax Status:", result[0].state);
        }, function(err) {
            console.error("Error getting status:", err);
        });
    }, 3000);

}, function(err) {
    console.error("Error sending fax:", err);
});
