const fs = require('fs');

// Read data.json
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

// Extract provider names
const providers = data.map(s => s.name).sort();

// Group them for better formatting (1 per line)
const grouped = [];
for (let i = 0; i < providers.length; i += 1) {
  grouped.push(providers.slice(i, i + 1).join(', '));
}

// Build markdown list
const providerList = grouped.map(line => `- ${line}`).join('\n');

// Read current README
let readme = fs.readFileSync('README.md', 'utf8');

// Replace the "Currently tracking:" section
const marker = '## 📊 What\'s included?';
const endMarker = '## 🛠️ How it works';

const start = readme.indexOf(marker);
const end = readme.indexOf(endMarker);

if (start !== -1 && end !== -1) {
  const newSection = `${marker}

Only services with **renewable free tiers** are listed—no one-time trials or credit-only promos. Currently tracking **${providers.length} providers**:

${providerList}

`;
  
  readme = readme.substring(0, start) + newSection + readme.substring(end);
  fs.writeFileSync('README.md', readme);
  console.log(`✅ Updated README with ${providers.length} providers`);
}
