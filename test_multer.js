import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(express.json());

app.post("/test", upload.fields([{ name: 'passport' }]), (req, res) => {
    let b = req.body;
    let payload = req.body.payload;
    if (payload) {
        try { b = JSON.parse(payload); } catch {}
    }
    console.log("Req body:", req.body, "Parsed:", b, "typeof:", typeof b);
    res.json({ ok: typeof b === "object" });
});

app.listen(3003, async () => {
    try {
        const form = new FormData();
        form.append('payload', JSON.stringify({test:1}));
        const res = await fetch("http://localhost:3003/test", { method: "POST", body: form });
        console.log(await res.text());
    } finally {
        process.exit(0);
    }
});
