# 📧 Free Transactional Email Services Comparison

> Live comparison of free tier limits across transactional email providers, updated daily

**[View Live Site →](https://guilamu.github.io/free-transactional-email-services-comparison/)**

[![Data Update](https://github.com/guilamu/free-transactional-email-services-comparison/actions/workflows/update-data.yml/badge.svg)](https://github.com/guilamu/free-transactional-email-services-comparison/actions)

## 🎯 What is this and why?

A simple, transparent comparison of **renewable free tier limits** built to save time for developers choosing transactional email providers. Inspired by frustration with outdated comparison posts and affiliate-heavy "reviews.". Perfect for indie hackers, startups, and developers choosing an email provider without wading through marketing pages. 


### Key features
- ✅ **Live scraped data** — Daily updates from official pricing pages
- ✅ **Transparent fallbacks** — Clear labels when scraping fails
- ✅ **No affiliate links** — Direct links to official pricing only
- ✅ **Open source** — Contribute parsers, suggest providers, or audit the data

## 📊 What's included?

Only services with **renewable free tiers** are listed—no one-time trials or credit-only promos. Currently tracking **12 providers**:

- Brevo (Sendinblue)
- EmailLabs
- MailerSend
- Maileroo
- Mailgun
- Mailjet
- Mailtrap
- Postmark
- Resend
- SMTP2GO
- SendPulse
- Sweego

## 🛠️ How it works

1. **Scraper** (`scraper.js`) fetches pricing pages daily via GitHub Actions
2. **Parser** extracts daily/monthly limits using provider-specific regex patterns
3. **Fallback** uses curated data when scraping fails (labeled "Static")
4. **Frontend** (`index.html`) displays the comparison table with live/static badges

### Data flow
Pricing pages → Node scraper → data.json → GitHub Pages → You


## 🚀 Running locally

- Clone the repo
- git clone https://github.com/guilamu/free-transactional-email-services-comparison.git
- cd free-transactional-email-services-comparison
- Install dependencies
- npm install
- Run the scraper
- node scraper.js
- Serve locally
- npx http-server
- Open http://localhost:8080

## 🤝 Contributing

Contributions are welcome! Here's how to help:

### Add a new provider

1. Check if it offers a **renewable free tier** (not trial-only)
2. [Open an issue with:](https://github.com/guilamu/free-transactional-email-services-comparison/issues/new?template=bug_report.md)
   - Provider name
   - Pricing page URL
   - Free tier details (daily/monthly limits)
3. Or submit a PR with:
   - Parser code in `scraper.js` (see existing examples)
   - Fallback entry in `fallbackData`
   - Note (≤100 chars) in `notes.js`

### Fix incorrect data

1. [Open an issue with:](https://github.com/guilamu/free-transactional-email-services-comparison/issues/new?template=feature_request.md)
   - Provider name
   - Current vs. correct limits
   - Link to official source
2. Or submit a PR updating the parser regex

### Improve parsers

- Make parsers more resilient to page changes
- Add support for JS-rendered pages (headless browser)

## 📂 Project structure
<pre>
├── scraper.js # Main scraper with provider-specific parsers
├── notes.js # Human-curated provider notes
├── index.html # Frontend comparison table
├── data.json # Generated daily data (committed to repo)
├── .github/
│ └── workflows/
│ └── update-data.yml # Daily cron job
└── README.md
</pre>

## 🧩 Parser anatomy

Each provider has a custom parser in `extractFromText()`:
```// Example: Maileroo parser
if (name === 'Maileroo') {
const page = text.replace(/\s+/g, ' ');
// Target "up to 3,000 outbound emails per month"
const monthlyOutbound = page.match(/up\sto\s(\d{1,3}(?:,\d{3}))\soutbound\semails?\s(?:per|/)\s*month/i);
if (monthlyOutbound) {
const monthly = parseInt(monthlyOutbound.replace(/,/g, ''), 10);
return {
dailyLimit: Math.floor(monthly / 30),
monthlyLimit: monthly,
note: null
};
}
return null; // Falls back to curated data
}
```
## ⚙️ Automation

GitHub Actions runs `scraper.js` daily at 2 AM UTC: - name: Update Pricing Data on: schedule: - cron: '0 2 * * *' # Daily at 2 AM UTC workflow_dispatch: # Manual trigger Results are committed back to the repo and deployed via GitHub Pages.

## 🔍 Data format

`data.json` structure:
```
[
{
"name": "Mailgun",
"dailyLimit": 100,
"monthlyLimit": 5000,
"url": "https://www.mailgun.com/pricing/",
"scrapedSuccessfully": true,
"lastScraped": "2025-10-25T02:00:00.000Z",
"lastChanged": "2025-10-20T02:00:00.000Z"
}
]
```

## ⚖️ License & Disclaimer

- **Code**: MIT License
- **Data**: Compiled from publicly available pricing pages
- **Accuracy**: Always verify limits on official provider sites before committing
- **Affiliation**: No affiliate relationships with any provider
