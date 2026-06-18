const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'src/articles/data.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

const markdown = `---
title: "How to Replace a Lost or Damaged Korean ID Card (ARC)"
seoTitle: "Lost or Damaged ARC in Korea | Korean ID Card Replacement Guide"
metaDescription: "Learn how to replace a lost, stolen, damaged, or worn-out Korean ID Card (ARC) in South Korea. Required documents, immigration procedures, and common mistakes."
slug: "id-card-reissue-korea"
---

# How to Replace a Lost or Damaged Korean ID Card (ARC)

Your Korean ID Card, officially known as the Alien Registration Card (ARC), is the primary identification document for foreign residents in South Korea.

If your card has been lost, stolen, damaged, or is no longer readable, you should apply for a replacement as soon as possible.

In this guide, we explain when a replacement is required, what documents you may need, and how the process works.

## When Do You Need a Replacement ARC?

There are several situations where a replacement Korean ID Card may be required.

### Lost Korean ID Card

This is the most common reason.

If your ARC has been lost or stolen, you should begin the replacement process as soon as possible.

Until you receive a new card, it is recommended to carry your passport when necessary.

### Damaged Korean ID Card

A replacement may be required if:

- The card is cracked
- The card is broken
- The card has separated or peeled apart
- The chip is damaged
- The photo is damaged
- Information can no longer be read
- The card cannot be scanned properly

### Worn-Out Korean ID Card

Sometimes the card remains technically valid but becomes difficult to use.

Examples include:

- Registration number is difficult to read
- Personal information has faded
- Surface damage prevents identification
- Immigration officers cannot easily verify the card

In these situations, replacing the card is strongly recommended.

## Should You Replace the Card Immediately?

Yes.

Your Korean ID Card is one of the most important documents you carry as a foreign resident.

A missing or unusable card can create problems when:

- Visiting banks
- Using government services
- Completing immigration procedures
- Verifying your identity

The sooner you begin the replacement process, the easier it will be to avoid complications.

## Documents Required for ARC Replacement

Requirements may vary depending on the reason for replacement.

In most situations, you should prepare:

| Document | Required |
|-----------|-----------|
| Passport | Yes |
| Damaged ARC (if available) | Yes |
| Passport Photo | May be required |
| Replacement Application | Yes |

If the card is damaged, bring it with you even if it is no longer usable.

If the card was lost, the replacement application will be based on the loss of the document.

## Where Can You Apply for a Replacement?

Replacement applications are normally processed through an immigration office.

For most applicants, an appointment should be booked through HiKorea before visiting.

Before your appointment, check the latest requirements for your local immigration office.

## How Does the Replacement Process Work?

### Step 1. Prepare Your Documents

Gather all required documents before making an appointment.

### Step 2. Book an Immigration Appointment

Use HiKorea to select an available date and time.

### Step 3. Visit the Immigration Office

Submit your application and supporting documents.

Immigration staff will review your information and process the request.

### Step 4. Wait for the New Card

Once approved, a new Korean ID Card will be issued.

## How Long Does It Take?

Processing times vary depending on:

- Immigration office workload
- Region
- Time of year
- Additional verification requirements

Most applicants receive their replacement card within a few weeks.

## What Should You Do While Waiting?

While waiting for the replacement card:

- Keep your passport available
- Save your application receipt
- Monitor any notifications from immigration

In most situations, your passport can be used to verify your identity until the new card is issued.

## Common Mistakes

### Waiting Too Long

Many foreign residents delay replacing a lost or damaged card.

Starting the process early helps avoid unnecessary problems.

### Throwing Away the Damaged Card

If the card still exists, bring it with you.

### Missing Your Appointment

Many immigration offices require advance reservations through HiKorea.

### Bringing Incomplete Documents

Always review document requirements before visiting immigration.

## FAQ

### What should I do if I lose my ARC?

Apply for a replacement Korean ID Card as soon as possible.

### Can I replace a broken ARC?

Yes. Physical damage is one of the most common reasons for replacement.

### Should I bring the damaged card?

Yes. If you still have the card, bring it to your immigration appointment.

### Can I use my passport instead?

While waiting for a replacement, your passport can usually be used for identification purposes.

### Do I need an immigration appointment?

In most cases, yes. A HiKorea reservation is recommended or required.

### Can I replace a card because it is worn out?

Yes. If important information is difficult to read, immigration may issue a replacement card.

## Conclusion

Replacing a lost, stolen, damaged, or worn-out Korean ID Card is an important procedure for foreign residents in South Korea. Acting quickly and preparing the correct documents can help prevent delays and unnecessary complications.

## Need Help Preparing Your Documents?

HiKorea Forms helps foreign residents prepare immigration forms for ARC replacement using passport and supporting document photos.

The service helps reduce paperwork and avoid common application mistakes.

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
    alternateSlug: "lost-id-card-korea", // RU equivalent slug
    content: blocks
  };
}

const newArticle = parseMarkdown(markdown);

// Also we need to add alternateSlug to the RU version of this article.
// The RU equivalent is "lost-id-card-korea".
dataContent = dataContent.replace(
  /"slug": "lost-id-card-korea",\n    "language": "ru",/g,
  '"slug": "lost-id-card-korea",\n    "language": "ru",\n    "alternateSlug": "id-card-reissue-korea",'
);

// Append new article at the end of the array.
const lastIndex = dataContent.lastIndexOf('];');
if (lastIndex !== -1) {
  const insertion = '  ,\n  ' + JSON.stringify(newArticle, null, 2) + '\n';
  dataContent = dataContent.slice(0, lastIndex) + insertion + dataContent.slice(lastIndex);
}

fs.writeFileSync(dataFile, dataContent);
console.log('Successfully updated data.js');
