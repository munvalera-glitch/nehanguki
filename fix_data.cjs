const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'src/articles/data.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

const mapping = [
  { file: 'update_data.cjs', ruSlug: 'id-card-renewal-korea', altSlug: 'arc-renewal-korea' },
  { file: 'update_data2.cjs', ruSlug: 'address-change-korea', altSlug: 'address-change-korea' },
  { file: 'update_data3.cjs', ruSlug: 'lost-id-card-korea', altSlug: 'id-card-reissue-korea' },
  { file: 'update_data4.cjs', ruSlug: 'first-id-card-korea', altSlug: 'first-id-card-korea' },
  { file: 'update_data5.cjs', ruSlug: 'hikorea-password-recovery', altSlug: 'hikorea-password-recovery' },
  { file: 'update_data6.cjs', ruSlug: 'immigration-office-appointment-korea', altSlug: 'immigration-office-appointment-korea' },
];

function parseMarkdown(md, altSlug) {
  const parts = md.split('---');
  if (parts.length < 3) return null;
  
  const frontmatter = parts[1].trim();
  const contentStr = parts.slice(2).join('---').trim();
  
  const meta = {};
  frontmatter.split('\n').forEach(line => {
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
  const lines = contentStr.split('\n');
  
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
    } else if (line.startsWith('- ') || line.match(/^\d+\. /)) {
      let listItems = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().match(/^\d+\. /))) {
        listItems.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: 'text', text: listItems.join('\n') });
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
    alternateSlug: altSlug,
    content: blocks
  };
}

let newArticles = [];

for (const item of mapping) {
  const fileContent = fs.readFileSync(path.join(__dirname, item.file), 'utf8');
  // Extract markdown from fileContent
  const match = fileContent.match(/const markdown = `([\s\S]*?)`;/);
  if (match) {
    const rawMd = match[1];
    // console.log("Extracted MD for", item.file, ":", rawMd.substring(0, 50));
    const article = parseMarkdown(rawMd, item.ruSlug); // altSlug points to Russian version
    newArticles.push(article);
    
    // Update Russian article to add alternateSlug
    const searchRegex = new RegExp(`"slug": "${item.ruSlug}",\\s*"language": "ru",`, 'g');
    dataContent = dataContent.replace(
      searchRegex,
      '"slug": "' + item.ruSlug + '",\n    "language": "ru",\n    "alternateSlug": "' + item.altSlug + '",'
    );
  }
}

const lastIndex = dataContent.lastIndexOf('];');
if (lastIndex !== -1) {
  const insertion = '  ,\n  ' + newArticles.map(a => JSON.stringify(a, null, 2)).join(',\n  ') + '\n';
  dataContent = dataContent.slice(0, lastIndex) + insertion + dataContent.slice(lastIndex);
}

fs.writeFileSync(dataFile, dataContent);
console.log('Successfully completely fixed data.js');
