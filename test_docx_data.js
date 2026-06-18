const b = {
  entryDate: "2026-06-20",
  applicant: { surname: "Doe", given_names: "John" },
  travelers: [
    { applicant: { surname: "Doe", given_names: "John" } }
  ]
};

const docxData = {};
if (b.entryDate) {
    const entry = new Date(b.entryDate);
    for (let i = 1; i <= 5; i++) {
        const d = new Date(entry);
        d.setDate(entry.getDate() + (i - 1));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        docxData[`date${i}`] = `${yyyy}.${mm}.${dd}`;
    }
} else {
    for (let i = 1; i <= 5; i++) {
        docxData[`date${i}`] = "";
    }
}

// Current application date
const today = new Date();
const tY = today.getFullYear();
const tM = String(today.getMonth() + 1).padStart(2, '0');
const tD = String(today.getDate()).padStart(2, '0');
docxData.currentDate = `${tY}/${tM}/${tD}`;

// Handle multi-traveler data
const allTravelers = b.travelers && b.travelers.length > 0 ? b.travelers : [{ applicant: b.applicant || {} }];
const mainApp = allTravelers[0].applicant || {};

let appName = "";
const s = mainApp.surname || "";
const g = mainApp.given_names || "";
appName = `${s} ${g}`.trim();
docxData.applicantName = appName;

let companionsList = [];
for (let i = 1; i < allTravelers.length; i++) {
    const comp = allTravelers[i].applicant || {};
    const cs = comp.surname || "";
    const cg = comp.given_names || "";
    const crel = comp.relationship || "";
    companionsList.push({
        index: i,
        name: `${cs} ${cg}`.trim(),
        relationship: crel
    });
}

docxData.companionCount = companionsList.length;
docxData.companions = companionsList;
console.log(JSON.stringify(docxData, null, 2));
