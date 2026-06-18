const popbill = require('popbill');
require('dotenv').config();

popbill.config({
  LinkID: process.env.POPBILL_LINK_ID,
  SecretKey: process.env.POPBILL_SECRET_KEY,
  IsTest: false, // Force production
});
const faxService = popbill.FaxService();
const corpNum = process.env.POPBILL_CORP_NUM;
const senderNum = process.env.POPBILL_SENDER_NUM;

faxService.getSenderNumberList(corpNum, function(result) {
    console.log("Sender Numbers registered in Production:");
    console.log(result);
    const registered = result.find(n => n.number === senderNum);
    if (registered) {
        console.log(`\nSender number ${senderNum} IS registered and active (${registered.state}).`);
    } else {
        console.log(`\nSender number ${senderNum} is NOT registered in production!`);
    }
    
    // Also check partner points balance
    faxService.getPartnerBalance(corpNum, function(balance) {
        console.log("\nPartner Points Balance in Production: " + balance);
        process.exit(0);
    }, function(err) {
        console.error("\nError getting partner balance:", err);
        process.exit(1);
    });

}, function(err) {
    console.error("Error getting sender number list:", err);
    process.exit(1);
});
