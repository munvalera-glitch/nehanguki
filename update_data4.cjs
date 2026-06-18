const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'src/articles/data.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

const markdown = `---
title: "How to Apply for Your First Korean ID Card (ARC)"
seoTitle: "First Korean ID Card (ARC) Application in Korea | Complete Guide"
metaDescription: "Learn how to apply for your first Korean ID Card (ARC) in South Korea. Required documents, immigration appointments, proof of residence, and application process."
slug: "first-id-card-korea"
---

# How to Apply for Your First Korean ID Card (ARC)

One of the first things most foreign residents must do after arriving in South Korea on a long-term visa is apply for a Korean ID Card.

Officially, this document is called the Alien Registration Card (ARC) or Foreigner Registration Card. However, most foreign residents simply call it their Korean ID Card.

Without an ARC, many everyday activities become difficult, including opening a bank account, obtaining a mobile phone plan, accessing health insurance services, and using certain government systems.

This guide explains who needs an ARC, what documents are required, and how the application process works.

## What Is a Korean ID Card (ARC)?

The Alien Registration Card is the primary identification document for foreign residents in South Korea.

The card contains:

- Full name
- Alien Registration Number
- Date of birth
- Visa type
- Period of stay
- Photo

Once issued, the Korean ID Card becomes your main identification document inside Korea.

## Who Must Apply for an ARC?

Most foreign nationals entering South Korea on a long-term visa must apply for a Korean ID Card.

This generally includes holders of:

- F-4 Visa
- F-6 Visa
- F-1 Visa
- F-3 Visa
- D-Series Visas
- E-Series Visas
- H-2 Visa
- Other long-term visas

Short-term visitors and tourists normally do not need to register.

## When Should You Apply?

Foreign residents should complete alien registration within the legally required period after arrival in Korea.

It is strongly recommended not to wait until the last minute.

Applying early allows you to access banking, telecommunications, healthcare, and government services sooner.

## Documents Required

Requirements vary depending on visa type.

In most cases, you should prepare:

| Document | Required |
|-----------|-----------|
| Passport | Yes |
| Passport Photo | Yes |
| Proof of Residence | Yes |
| Visa Documents | Yes |

Proof of residence may include:

- Lease agreement
- Confirmation of Residence/Accommodation (거주/숙소제공 확인서)

If your housing is provided by another person, additional accommodation documents may be required.

## How to Apply for Your First Korean ID Card

### Step 1. Prepare Your Documents

Gather all required documents before booking an appointment.

### Step 2. Book an Immigration Appointment

Most applicants must reserve a visit through HiKorea.

Appointment availability may vary depending on location.

### Step 3. Visit the Immigration Office

Bring all required documents and attend your appointment.

Immigration staff will review your application and supporting documents.

### Step 4. Wait for Card Issuance

After approval, your Korean ID Card will be produced and issued.

## How Long Does It Take?

Processing times depend on:

- Immigration office workload
- Region
- Visa category
- Seasonal demand

Most applicants receive their card within several weeks.

## Why Is an ARC Important?

Your Korean ID Card is needed for many essential services.

Examples include:

- Opening a bank account
- Registering for mobile phone service
- Health insurance registration
- Government services
- Online immigration services through HiKorea

## Common Mistakes

### Missing Appointment

Many immigration offices require advance reservations.

### Incomplete Documents

Missing documents may delay the application.

### Incorrect Address Information

Your address should match the documents submitted with the application.

### Invalid Photo

Photos that do not meet immigration requirements may be rejected.

## FAQ

### Is a Korean ID Card mandatory?

For most long-term visa holders, yes.

### Can I open a bank account without an ARC?

Many banks require an ARC for full banking services.

### Do I need a HiKorea appointment?

In most cases, yes.

### Can I use a lease agreement as proof of residence?

Yes. A lease agreement is one of the most common residence documents.

### What if the lease is not under my name?

You may need a Confirmation of Residence/Accommodation (거주/숙소제공 확인서).

### Is the ARC the same as a visa?

No. The ARC is your registration card, while the visa is your immigration status.

## Conclusion

Applying for your first Korean ID Card is one of the most important steps after moving to South Korea. Completing the process correctly will make it much easier to access banking, healthcare, telecommunications, and government services.

## Need Help Preparing Your Documents?

HiKorea Forms helps foreign residents prepare immigration forms using passport, visa, Korean ID Card, and residence documents.

Our service helps reduce paperwork and avoid common application mistakes.

**Prepare Documents Automatically**`;

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
    alternateSlug: meta.slug,
    content: blocks
  };
}

const newArticle = parseMarkdown(markdown);

// Also we need to add alternateSlug to the RU version of this article.
dataContent = dataContent.replace(
  /"slug": "first-id-card-korea",\n    "language": "ru",/g,
  '"slug": "first-id-card-korea",\n    "language": "ru",\n    "alternateSlug": "first-id-card-korea",'
);

// Append new article at the end of the array.
const lastIndex = dataContent.lastIndexOf('];');
if (lastIndex !== -1) {
  const insertion = '  ,\n  ' + JSON.stringify(newArticle, null, 2) + '\n';
  dataContent = dataContent.slice(0, lastIndex) + insertion + dataContent.slice(lastIndex);
}

fs.writeFileSync(dataFile, dataContent);
console.log('Successfully updated data.js');
