const express = require('express');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(express.json());
app.post("/test", upload.fields([{ name: 'passport' }]), (req, res) => {
    let b = req.body;
    let err = "";
    if (req.body.payload) {
        try { b = JSON.parse(req.body.payload); } catch (e) { err = e.message; }
    }
    res.json({ body: req.body, parsed: b, type: typeof b, err });
});
app.listen(3002, () => console.log('started'));
