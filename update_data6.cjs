const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'src/articles/data.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

const markdown = `---
title: "How to Book an Immigration Office Appointment Through HiKorea"
seoTitle: "How to Book an Immigration Appointment in Korea Through HiKorea"
metaDescription: "Learn how to book an immigration office appointment through HiKorea. Step-by-step guide for foreign residents in South Korea, including appointment changes, office selection, and common mistakes."
slug: "immigration-office-appointment-korea"
---

# How to Book an Immigration Office Appointment Through HiKorea

Many immigration services in South Korea require an appointment before visiting an immigration office. Without a reservation, it may be impossible to receive service or you may face long waiting times.

HiKorea is the official online immigration portal used by foreign residents to book appointments, manage immigration applications, and access various immigration services.

This guide explains how to make an immigration appointment through HiKorea, choose the correct office, and avoid common booking mistakes.

## When Do You Need an Immigration Appointment?

Appointments are commonly required for:

- First Korean ID Card (ARC) application
- Korean ID Card (ARC) replacement
- Extension of stay
- Change of visa status
- Immigration consultations
- Other immigration-related services

Requirements may vary depending on the immigration office and the service requested.

## What Do You Need Before Booking?

Before making an appointment, you should have:

| Requirement | Required |
|------------|------------|
| HiKorea account | Yes |
| Login ID and password | Yes |
| Internet access | Yes |
| Personal information | Yes |

If you cannot access your HiKorea account, you may need to recover your password before making a reservation.

## How to Book an Appointment Through HiKorea

### Step 1. Log In to HiKorea

Sign in using your HiKorea account credentials.

### Step 2. Select the Required Service

Choose the immigration service you need.

Examples include:

- ARC application
- ARC replacement
- Extension of stay
- Address change
- Visa-related services

### Step 3. Select an Immigration Office

In most situations, you must choose the immigration office responsible for your residential area.

The system may automatically limit available offices based on your address.

### Step 4. Choose a Date and Time

Available appointment slots may fill quickly, especially in larger cities.

If no suitable date is available, continue checking the system regularly because cancelled appointments frequently become available.

### Step 5. Confirm the Reservation

Review your information carefully and complete the booking.

Save the confirmation page or take a screenshot for future reference.

## How to Choose the Correct Immigration Office

This is one of the most common questions.

Most immigration procedures must be completed at the office responsible for your current residential address.

Choosing the wrong office may result in delays or refusal of service.

## What If No Appointments Are Available?

Appointment availability changes frequently.

New slots may appear because:

- Other applicants cancel appointments
- Additional schedules are released
- Office capacity changes

Checking regularly often helps you find an earlier appointment.

## Can You Change or Cancel an Appointment?

Yes.

HiKorea generally allows users to:

- Cancel an appointment
- Reschedule an appointment
- Select a different date or time

It is best to make changes as early as possible.

## What Should You Bring to the Appointment?

The required documents depend on your purpose of visit.

In most cases, you should bring:

- Passport
- Korean ID Card (ARC), if available
- Appointment confirmation
- Supporting documents related to your application

Always verify the exact requirements before visiting immigration.

## Common Mistakes

### Choosing the Wrong Immigration Office

This is the most common mistake made by foreign residents.

### Arriving Without Required Documents

Even with a valid appointment, your application may not be accepted.

### Arriving Late

Try to arrive before your scheduled appointment time.

### Not Saving the Confirmation

Always keep a copy of your appointment confirmation.

## FAQ

### Is a HiKorea appointment required?

For many immigration services, yes.

### Can I visit immigration without an appointment?

Some offices may accept walk-in visitors in limited situations, but appointments are generally recommended or required.

### Can I change my appointment date?

Yes. HiKorea usually allows appointment modifications.

### What should I do if there are no available appointments?

Continue checking regularly because cancelled reservations often become available.

### Can I choose any immigration office?

Normally, you should use the office responsible for your residential area.

### Do I need to print the appointment confirmation?

Not necessarily, but keeping a digital or printed copy is recommended.

## Conclusion

Booking an immigration appointment through HiKorea is an important part of many immigration procedures in South Korea. Choosing the correct office, preparing the required documents, and booking early can help avoid unnecessary delays and complications.

## Need Help Preparing Immigration Documents?

HiKorea Forms helps foreign residents prepare immigration forms automatically using passport, Korean ID Card, and supporting document photos.

The service helps reduce paperwork and avoid common application mistakes before visiting immigration.

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
      blocks.push({ type: 'h2', text: line.replace('### ', '').trim() });
    } else if (line.startsWith('|')) {
      const headers = line.split('|').map(s => s.trim()).filter(Boolean);
      i++;
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

dataContent = dataContent.replace(
  /"slug": "immigration-office-appointment-korea",\n    "language": "ru",/g,
  '"slug": "immigration-office-appointment-korea",\n    "language": "ru",\n    "alternateSlug": "immigration-office-appointment-korea",'
);

const lastIndex = dataContent.lastIndexOf('];');
if (lastIndex !== -1) {
  const insertion = '  ,\n  ' + JSON.stringify(newArticle, null, 2) + '\n';
  dataContent = dataContent.slice(0, lastIndex) + insertion + dataContent.slice(lastIndex);
}

fs.writeFileSync(dataFile, dataContent);
console.log('Successfully updated data.js');
