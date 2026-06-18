fetch("http://localhost:3001/api/generate/package-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: JSON.stringify({ action: "initial", visaType: "F4" }) })
}).then(res => res.text()).then(console.log).catch(console.error);
