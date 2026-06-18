const popbill = require('popbill');
require('dotenv').config();

popbill.config({
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: process.env.POPBILL_IS_TEST === 'true' || false,
});
const faxService = popbill.FaxService();

const CorpNum = process.env.POPBILL_CORP_NUM;

faxService.search(
    CorpNum,
    '20260601', // Look from yesterday
    '20260602', // To today
    ['1', '2', '3', '4'], // state? let's pass empty array or string
    false, // ReserveYN
    false, // SenderOnly
    'D', // Order
    1, // Page
    100, // PerPage
    '', // QString
    function(result) {
        console.log("Success! Found", result.total, "faxes.");
        if (result.list && result.list.length > 0) {
            console.log(JSON.stringify(result.list.slice(0, 5), null, 2));
        }
    },
    function(err) {
        console.error("Error!", err);
    }
);
