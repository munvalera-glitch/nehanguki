const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'src/articles/data.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

const markdown = `---
title: "How to Recover Your HiKorea Password"
seoTitle: "How to Recover Your HiKorea Password | HiKorea Account Recovery Guide"
metaDescription: "Forgot your HiKorea password? Learn how to reset your password, recover access to your account, and what to do if you no longer have access to your registered email address."
slug: "hikorea-password-recovery"
---

# How to Recover Your HiKorea Password

HiKorea is the primary immigration portal used by foreign residents in South Korea. Through HiKorea, users can book immigration appointments, extend their stay, report address changes, and access many immigration-related services.

One of the most common problems foreign residents face is losing access to their HiKorea account.

In most situations, the issue is not the login ID itself, but the inability to reset the password.

This guide explains how HiKorea password recovery works and what to do if you no longer have access to your registered email address.

## The Most Common HiKorea Problem

Many users still know their HiKorea login ID or can easily recover it through the account lookup function.

The real problem usually involves password recovery.

To reset a HiKorea password, access to the email address used during registration is normally required.

If you no longer have access to that email account, the standard password reset process may not work.

## How to Reset Your HiKorea Password

If you know your login ID and still have access to your registered email address, the process is usually straightforward.

### Step 1. Go to the HiKorea Login Page

Select the password recovery option.

### Step 2. Verify Your Information

You may be asked to provide:

- Login ID
- Name
- Date of birth
- Other account information

### Step 3. Receive a Reset Email

If your information matches the account records, HiKorea will send password reset instructions to the registered email address.

### Step 4. Create a New Password

Follow the instructions and choose a new secure password.

## What If You Forgot Your Login ID?

HiKorea also provides a login ID recovery function.

In most cases, users can recover their ID by providing:

- Name
- Date of birth
- Registration information

Recovering the login ID is usually much easier than recovering a password.

## The Biggest Problem: No Access to the Registered Email

This is the situation that causes the most difficulties.

Many foreign residents:

- Created their account years ago
- Changed email providers
- Lost access to an old email account
- Cannot remember which email address was used during registration

Without access to the registered email address, online password recovery may not be possible.

## What Can You Do If You Cannot Access Your Email?

If you no longer have access to the registered email account, additional identity verification may be required.

This process may involve:

- Completing a recovery request
- Providing a passport copy
- Providing a Korean ID Card (ARC) copy
- Sending supporting documents by fax

After verification, immigration authorities may assist with account recovery or updating registration information.

## Documents Commonly Required

Requirements vary depending on the situation.

In many cases, the following documents are used:

| Document | Required |
|-----------|-----------|
| Passport | Yes |
| Korean ID Card (ARC) | Yes |
| Recovery Request Form | Yes |

Additional documents may sometimes be requested.

## Should You Create a New HiKorea Account?

Some users consider creating a new account instead of recovering the existing one.

However, this is not always recommended.

If your current account has already been linked to your immigration information, it is usually better to recover the existing account whenever possible.

## Common Mistakes

### Entering a Different Name

The information must match the details originally used during registration.

### Incorrect Date of Birth

Even a small error may prevent successful verification.

### No Access to Registered Email

This is the most common reason users cannot reset their password online.

### Creating Multiple Accounts

Multiple accounts can sometimes create additional complications later.

## FAQ

### What do most users forget?

Most users either forget their password or lose access to the email address linked to their account.

### Can I reset my password myself?

Yes, if you still have access to the registered email address.

### Can I recover my login ID?

Yes. HiKorea provides a separate account ID recovery function.

### What if I do not remember my email address?

You may need to complete an identity verification process with immigration authorities.

### Do I need my passport?

Yes. A passport is often required when verifying your identity.

### Do I need my Korean ID Card (ARC)?

In many cases, yes.

### Can I create a new account instead?

Technically yes, but recovering your existing account is usually the better option.

## Conclusion

Most HiKorea account problems are related to password recovery and loss of access to the registered email address. If you still have access to your email, password recovery is usually quick and straightforward. If not, additional verification may be required before access can be restored.

## Need Help Recovering Your HiKorea Account?

HiKorea Forms helps foreign residents prepare account recovery documents, including forms commonly required for identity verification and fax submissions.

Our service helps reduce mistakes and simplifies the recovery process.

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
  /"slug": "hikorea-password-recovery",\n    "language": "ru",/g,
  '"slug": "hikorea-password-recovery",\n    "language": "ru",\n    "alternateSlug": "hikorea-password-recovery",'
);

const lastIndex = dataContent.lastIndexOf('];');
if (lastIndex !== -1) {
  const insertion = '  ,\n  ' + JSON.stringify(newArticle, null, 2) + '\n';
  dataContent = dataContent.slice(0, lastIndex) + insertion + dataContent.slice(lastIndex);
}

fs.writeFileSync(dataFile, dataContent);
console.log('Successfully updated data.js');
