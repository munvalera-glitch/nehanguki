const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'src/articles/data.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

// The markdown provided by the user
const markdown = `---
title: "How to Renew Your Korean ID Card (ARC) in Korea"
seoTitle: "ARC Renewal in Korea 2026 | How to Extend Your Korean ID Card"
metaDescription: "Learn how to renew your Korean ID Card (ARC) in South Korea. Required documents, renewal process, HiKorea application, immigration office visits, and common mistakes."
slug: "arc-renewal-korea"
---

# How to Renew Your Korean ID Card (ARC) in Korea

If your Korean ID Card is approaching its expiration date, it is important to renew it before your authorized period of stay ends.

Foreign residents in Korea often refer to the Alien Registration Card (ARC) simply as their Korean ID Card. It is one of the most important documents for everyday life in Korea.

Every year thousands of foreigners apply for ARC renewal through HiKorea or by visiting an immigration office.

In this guide, we explain when to renew your Korean ID Card, what documents may be required, and how to avoid common mistakes during the process.

## What Is a Korean ID Card (ARC)?

The Alien Registration Card (ARC), also called a Korean ID Card by many foreigners, is the primary identification document for foreign residents in South Korea.

The card contains:

- Your full name
- Alien Registration Number
- Visa type
- Period of stay
- Photo and personal information

Your Korean ID Card is commonly used for:

- Banking
- Mobile phone contracts
- Health insurance
- Government services
- Immigration procedures

## When Should You Renew Your Korean ID Card?

You should renew your ARC before your current period of stay expires.

Waiting until the last minute may create unnecessary stress, especially if additional documents are requested or immigration appointments become unavailable.

You can check your expiration date on:

- Your Korean ID Card
- HiKorea
- Immigration approval documents

## Who Needs ARC Renewal?

ARC renewal is required for most long-term visa holders, including:

- F-4 Overseas Korean Visa
- F-6 Marriage Visa
- F-1 Visa
- F-3 Dependent Visa
- D-Series Visas
- E-Series Work Visas
- H-2 Visa
- Other long-term visas

Document requirements may vary depending on your visa category.

## Documents Required for ARC Renewal

The exact document list depends on your visa type.

In most situations, you will need:

| Document | Required |
|-----------|-----------|
| Passport | Yes |
| Current Korean ID Card (ARC) | Yes |
| Proof of Residence | Yes |
| Visa-related Documents | Yes |

Additional documents may include:

- Employment documents
- Income statements
- Family documents
- School enrollment documents
- Lease agreement

## How to Renew Your ARC Through HiKorea

Many foreign residents can submit their renewal application online through HiKorea.

Benefits include:

- Less paperwork
- No waiting in line
- Online document submission
- Easy status tracking

Before submitting your application, make sure all uploaded documents are clear and readable.

## Do You Need to Visit Immigration After Online Approval?

This is one of the most common questions.

Even if your extension is approved online through HiKorea, you may still need to visit an immigration office so your Korean ID Card can be updated with the new period of stay.

Requirements may differ depending on your visa type and local immigration office.

## Applying Through an Immigration Office

If online renewal is unavailable, you will need to book an appointment and visit the immigration office in person.

Bring:

- Passport
- Korean ID Card
- Supporting documents
- Appointment confirmation

Always use the immigration office responsible for your residential area.

## Common ARC Renewal Mistakes

### Applying Too Late

The most common mistake.

Late applications can lead to immigration complications and penalties.

### Missing Documents

Even one missing document can delay approval.

### Incorrect Address Information

Your registered address should always be up to date.

### Poor Quality Scans

Unreadable uploads frequently cause delays.

## How Long Does ARC Renewal Take?

Processing time depends on:

- Visa category
- Immigration office workload
- Completeness of documents
- Additional verification requests

If immigration requests extra documents, processing may take longer.

## What Should You Do After Applying?

After submitting your application:

1. Save your confirmation receipt.
2. Monitor your application status.
3. Check HiKorea notifications regularly.
4. Respond quickly to any document requests.

## FAQ

### Can I renew my ARC completely online?

Many visa holders can complete most of the process online, although some may still need to visit immigration afterward.

### What happens if my ARC expires?

You may face penalties and complications with future immigration procedures.

### Do I need a lease agreement?

It depends on your visa category and situation, but proof of residence is commonly required.

### Do I need an immigration appointment?

If you are applying in person, an appointment is usually required.

### Can I visit any immigration office?

No. You should normally use the office responsible for your residential area.

## Conclusion

Renewing your Korean ID Card (ARC) on time is one of the most important responsibilities for foreign residents in South Korea. Preparing your documents early and following the correct process can help you avoid delays and unnecessary complications.
`;

function parseMarkdown(md) {
  const parts = md.split('---');
  if (parts.length < 3) return null;
  
  const frontmatter = parts[1].trim();
  const contentStr = parts.slice(2).join('---').trim();
  
  const meta = {};
  frontmatter.split('\\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon > -1) {
      const key = line.slice(0, colon).trim();
      let val = line.slice(colon + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
  });
  
  const blocks = [];
  const lines = contentStr.split('\\n');
  let currentTable = null;
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    
    if (line.startsWith('# ')) {
      // Title is handled
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.replace('## ', '').trim() });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h2', text: line.replace('### ', '').trim() }); // map h3 to h2 for TOC and layout
    } else if (line.startsWith('|')) {
      // Table
      const headers = line.split('|').map(s => s.trim()).filter(Boolean);
      i++;
      // separator
      i++;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').map(s => s.trim()).filter(Boolean));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    } else if (line.startsWith('- ') || line.match(/^\\d+\\. /)) {
      let listItems = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().match(/^\\d+\\. /))) {
        listItems.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: 'text', text: listItems.join('\\n') });
      continue;
    } else {
      if (blocks.length === 0) {
        blocks.push({ type: 'intro', text: line });
      } else {
        blocks.push({ type: 'text', text: line });
      }
    }
    i++;
  }
  
  const desc = meta.metaDescription || meta.description || "";
  
  return {
    slug: meta.slug,
    title: meta.title,
    excerpt: desc.substring(0, 150) + "...",
    date: new Date().toISOString().split('T')[0],
    seo: {
      title: meta.seoTitle,
      description: desc,
      canonical: "https://seo.hikoreaforms.com/en/articles/" + meta.slug,
      ogTitle: meta.title,
      ogDescription: desc
    },
    language: "en",
    alternateSlug: "id-card-renewal-korea",
    content: blocks
  };
}

const newArticle = parseMarkdown(markdown);

// Transform data.js
let newContent = dataContent;

// We need to inject language: "ru" to existing items, and alternateSlug for id-card-renewal-korea.
// Since data.js is a module, it's easier to do string replacements on existing objects.
newContent = newContent.replace(/"slug": "id-card-renewal-korea",/g, '"slug": "id-card-renewal-korea",\n    "language": "ru",\n    "alternateSlug": "arc-renewal-korea",');
newContent = newContent.replace(/"slug": "address-change-korea",/g, '"slug": "address-change-korea",\n    "language": "ru",');
newContent = newContent.replace(/"slug": "first-id-card-korea",/g, '"slug": "first-id-card-korea",\n    "language": "ru",');
newContent = newContent.replace(/"slug": "hikorea-password-recovery",/g, '"slug": "hikorea-password-recovery",\n    "language": "ru",');
newContent = newContent.replace(/"slug": "immigration-office-appointment-korea",/g, '"slug": "immigration-office-appointment-korea",\n    "language": "ru",');
newContent = newContent.replace(/"slug": "lost-id-card-korea",/g, '"slug": "lost-id-card-korea",\n    "language": "ru",');

// Append new article at the end of the array.
// Find the last "];"
const lastIndex = newContent.lastIndexOf('];');
if (lastIndex !== -1) {
  const insertion = '  ,\n  ' + JSON.stringify(newArticle, null, 2) + '\n';
  newContent = newContent.slice(0, lastIndex) + insertion + newContent.slice(lastIndex);
}

fs.writeFileSync(dataFile, newContent);
console.log('Successfully updated data.js');
