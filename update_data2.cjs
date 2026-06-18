const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'src/articles/data.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

const markdown = `---
title: "How to Update the Address on Your Korean ID Card (ARC)"
seoTitle: "Address Change in Korea | How to Update Your Korean ID Card (ARC)"
metaDescription: "Learn how to report an address change in South Korea as a foreign resident. Required documents, 14-day rule, HiKorea, community center visit, and proof of residence."
slug: "address-change-korea"
---

# How to Update the Address on Your Korean ID Card (ARC)

If you move to a new address in South Korea, you must report your new residential address to the authorities. For foreign residents, this is an important immigration procedure connected to your Korean ID Card, officially known as the Alien Registration Card (ARC) or Foreigner Registration Card.

Many foreign residents think that signing a new lease is enough after moving. However, your registered address must also be updated in the official system. If your address is not updated, you may face problems when renewing your stay, using government services, or visiting immigration.

In this guide, we explain when you must report an address change, what documents are required, and how to update your address through HiKorea or a local community center.

## Who Needs to Report an Address Change?

Most foreign residents registered in South Korea must report a change of address after moving.

This usually applies to holders of long-term visas, including:

- F-4 Visa
- F-6 Visa
- F-1 Visa
- F-3 Visa
- D-Series Visas
- E-Series Visas
- H-2 Visa
- Other long-term visas

If you move to a new residence, your address information should be officially updated.

## Why Updating Your Address Matters

Your registered address is used by government offices and immigration authorities for:

- Official notices
- Residence verification
- Visa and stay extension procedures
- Immigration applications
- Government services
- Mail from public institutions

If your address is outdated, you may experience delays or complications with future immigration procedures.

## When Should You Report Your New Address?

Foreign residents must report their new residential address within 14 days after moving.

This rule applies to most foreign residents who are registered in South Korea.

Failing to report an address change on time may cause administrative issues and may affect future immigration procedures.

It is best to update your address as soon as possible after moving instead of waiting until the last day.

## Documents Required for Address Change

To update your address, you need to prove your new place of residence.

In most cases, you should prepare:

| Document | Required |
|-----------|-----------|
| Passport | Yes |
| Korean ID Card (ARC) | Yes |
| Proof of Residence | Yes |

Proof of residence is usually one of the following:

- A lease agreement under your name
- Confirmation of Residence/Accommodation (거주/숙소제공 확인서)

If the lease agreement is under your own name, additional residence documents are usually not required.

If the housing is provided by another person, you will usually need a Confirmation of Residence/Accommodation from the person providing the place to stay.

That person may be:

- The tenant named on the lease
- The property owner
- Your spouse
- A family member
- A friend
- Your employer
- Another person legally able to provide accommodation

In this case, the person providing the accommodation should complete and sign the 거주/숙소제공 확인서 form.

## How to Update Your Address Through HiKorea

Many foreign residents can report an address change online through HiKorea.

The process usually works as follows.

### Step 1. Log in to HiKorea

Use your HiKorea login ID and password.

### Step 2. Select the Address Change Service

Find the service related to reporting or updating your residential address.

### Step 3. Enter Your New Address

Enter your new residential address carefully.

Make sure the address is written correctly and matches your supporting documents.

### Step 4. Upload Documents

Upload documents that prove your new residence.

The uploaded files should be clear and readable.

### Step 5. Submit the Application

Review your information and submit the application.

## Do You Need to Visit an Office After Applying Online?

This is one of the most common questions.

In many cases, even after submitting the address change online, you may still need to visit:

- A local community center (주민센터)
- Or an immigration office

This may be required to add the address change stamp or update information on your Korean ID Card.

Requirements can differ depending on your visa type, region, and local office.

## Updating Your Address at a Community Center

Many foreign residents update their address directly at the local community center, called 주민센터 in Korean.

Advantages include:

- Faster processing
- Help from staff
- Possibility to update the card immediately
- Easier handling of document questions

Before visiting, prepare all required documents in advance.

## Common Mistakes

### Incorrect Address Format

Even a small error in the address can create a mismatch in the system.

### Using an Old Lease Agreement

Your proof of residence should reflect your current address.

### Unreadable Documents

If uploaded documents are blurry or unreadable, your application may be delayed or returned.

### Reporting Too Late

You must report your new address within 14 days after moving.

### Missing Confirmation of Accommodation

If the lease is not under your name, you may need a Confirmation of Residence/Accommodation form.

## What Happens After the Address Is Updated?

After processing, your new address will be reflected in the official system.

This means:

- Government notices will be sent to your new address
- Immigration records will be updated
- Future applications can be processed more smoothly

## FAQ

### How soon should I update my address after moving?

Foreign residents must report their new address within 14 days after moving.

### Can I update my address completely online?

In many cases, yes. However, you may still need to visit a community center or immigration office to update your Korean ID Card.

### What if the lease is not under my name?

If the housing is provided by another person, you will usually need a Confirmation of Residence/Accommodation (거주/숙소제공 확인서).

### Who can provide the accommodation confirmation?

It may be provided by the tenant, property owner, spouse, family member, friend, employer, or another person who has the right to provide the place of residence.

### Can I update my address without a lease agreement?

Yes, if you have a valid Confirmation of Residence/Accommodation. In most cases, you need either a lease agreement or a residence confirmation document.

### Can I visit any community center?

Usually, you should visit the community center responsible for your actual place of residence.

## Conclusion

Updating your address on your Korean ID Card (ARC) is an important obligation for foreign residents in South Korea. The address change must usually be reported within 14 days after moving. Preparing the correct documents in advance can help you avoid delays and future immigration problems.
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
    alternateSlug: meta.slug, // same slug for RU and EN
    content: blocks
  };
}

const newArticle = parseMarkdown(markdown);

// Also we need to add alternateSlug to the RU version of this article.
// Let's replace the RU version to include alternateSlug.
dataContent = dataContent.replace(
  /"slug": "address-change-korea",\n    "language": "ru",/g,
  '"slug": "address-change-korea",\n    "language": "ru",\n    "alternateSlug": "address-change-korea",'
);

// Append new article at the end of the array.
const lastIndex = dataContent.lastIndexOf('];');
if (lastIndex !== -1) {
  const insertion = '  ,\n  ' + JSON.stringify(newArticle, null, 2) + '\n';
  dataContent = dataContent.slice(0, lastIndex) + insertion + dataContent.slice(lastIndex);
}

fs.writeFileSync(dataFile, dataContent);
console.log('Successfully updated data.js');
