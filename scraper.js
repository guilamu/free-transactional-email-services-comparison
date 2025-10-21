'use strict';

const fs = require('fs');

// Entry banner
console.log('🚀 Starting email service scraper with change tracking...\n');

// Fallback data - accurate as of October 2025
const fallbackData = [
  { name: 'SendPulse', dailyLimit: 400, monthlyLimit: 12000, url: 'https://sendpulse.com/prices/smtp', note: null },
  { name: 'Brevo (Sendinblue)', dailyLimit: 300, monthlyLimit: 9000, url: 'https://www.brevo.com/pricing/', note: null },
  { name: 'Mailjet', dailyLimit: 200, monthlyLimit: 6000, url: 'https://www.mailjet.com/pricing/', note: null },
  { name: 'Mailgun', dailyLimit: 100, monthlyLimit: 3000, url: 'https://www.mailgun.com/pricing/', note: 'Free plan - no credit card required' },
  { name: 'Resend', dailyLimit: 100, monthlyLimit: 3000, url: 'https://resend.com/pricing', note: null },
  { name: 'Elastic Email', dailyLimit: 100, monthlyLimit: 3000, url: 'https://elasticemail.com/pricing', note: null },
  { name: 'Amazon SES', dailyLimit: 100, monthlyLimit: 3000, url: 'https://aws.amazon.com/ses/pricing/', note: 'First 12 months with AWS Free Tier' },
  { name: 'SMTP2GO', dailyLimit: 200, monthlyLimit: 1000, url: 'https://www.smtp2go.com/pricing/', note: null },
  { name: 'Mailtrap', dailyLimit: 33, monthlyLimit: 1000, url: 'https://mailtrap.io/pricing/', note: 'Email testing sandbox' },
  { name: 'MailerSend', dailyLimit: 100, monthlyLimit: 500, url: 'https://www.mailersend.com/pricing', note: 'Requires credit card' },
  { name: 'Mailchimp Transactional', dailyLimit: 17, monthlyLimit: 500, url: 'https://mailchimp.com/pricing/transactional-email/', note: 'For Mailchimp users only' },
  { name: 'Postmark', dailyLimit: 3, monthlyLimit: 100, url: 'https://postmarkapp.com/pricing', note: 'Developer sandbox only' }
];

// Load previous data if exists
function loadPreviousData() {
  try {
    if (fs.existsSync('data.json')) {
      const content = fs.readFileSync('data.json', 'utf8');
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    console.log('⚠️ Could not load previous data:', error.message);
    return [];
  }
}

// Simple text extraction function
function extractFromText(rawText, name) {
  if (!rawText) return null;

  // Normalize common whitespace quirks
  const text = rawText.replace(/\u00A0/g, ' ');
  const lowerText = text.toLowerCase();

  // --- SendPulse ---
  if (name === 'SendPulse') {
    // Look for "Free" and a monthly number near it
    const monthMatch =
      text.match(/(\d{1,3}(?:,\d{3})*)\s*emails?\s*Free/i) ||
      text.match(/Free[^]*?(\d{1,3}(?:,\d{3})*)\s*emails?/i);
    if (monthMatch) {
      const monthly = parseInt(monthMatch[1].replace(/,/g, ''), 10);
      if (monthly > 0) {
        const daily = Math.floor(monthly / 30);
        return { dailyLimit: daily, monthlyLimit: monthly, note: null };
      }
    }
    return null;
  }

  // --- Mailgun ---
  if (name === 'Mailgun') {
    const dailyMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*emails?\s*(?:per|\/)\s*day\b/i);
    if (dailyMatch) {
      const daily = parseInt(dailyMatch[1].replace(/,/g, ''), 10);
      if (daily > 0) {
        return { dailyLimit: daily, monthlyLimit: daily * 30, note: 'Free plan - no credit card required' };
      }
    }
    return null;
  }

  // --- MailerSend ---
  if (name === 'MailerSend') {
    if (lowerText.includes('500 emails per month') || lowerText.includes('500 emails/month')) {
      return { dailyLimit: 100, monthlyLimit: 500, note: 'Requires credit card' };
    }
    const monthMatch = text.match(/free[^]*?(\d{1,3}(?:,\d{3})*)\s*emails?\s*(?:per|\/)\s*month\b/i);
    if (monthMatch) {
      const monthly = parseInt(monthMatch[1].replace(/,/g, ''), 10);
      if (monthly > 0) {
        return { dailyLimit: Math.floor(monthly / 30), monthlyLimit: monthly, note: 'Requires credit card' };
      }
    }
    return null;
  }

  // --- Resend ---
  if (name === 'Resend') {
    // Try to locate the free daily limit and monthly number
    const dailyPattern = /Daily\s*Limit[^]*?(\b\d{1,3}\b)/i;
    const dailyMatch = text.match(dailyPattern);
    const monthMatch =
      text.match(/(\d{1,3}(?:,\d{3})*)\s+emails?\s*\/\s*mo\b/i) ||
      text.match(/(\d{1,3}(?:,\d{3})*)\s+emails?\s*per\s*month\b/i);
    if (dailyMatch && monthMatch) {
      const daily = parseInt(dailyMatch[1].replace(/,/g, ''), 10);
      const monthly = parseInt(monthMatch[1].replace(/,/g, ''), 10);
      if (daily > 0 && monthly > 0) {
        if (daily === 100 || Math.abs(daily - monthly / 30) < 10) {
          return { dailyLimit: daily, monthlyLimit: monthly, note: null };
        }
      }
    } else if (monthMatch) {
      const monthly = parseInt(monthMatch[1].replace(/,/g, ''), 10);
      if (monthly > 0) {
        return { dailyLimit: 100, monthlyLimit: monthly, note: null };
      }
    }
    return null;
  }

  // --- SMTP2GO (FIXED) ---
  if (name === 'SMTP2GO') {
    // Accept both "/ mo" and "per month", and capture daily if present
    const monthMatch =
      text.match(/(\d{1,3}(?:,\d{3})*)\s*emails?\s*(?:\/|\bper\b)\s*(?:month|mo)\b/i);
    const dayMatch =
      text.match(/(\d{1,3}(?:,\d{3})*)\s*emails?\s*(?:\/|\bper\b)\s*day\b/i);

    if (monthMatch && dayMatch) {
      const monthly = parseInt(monthMatch[1].replace(/,/g, ''), 10);
      const daily = parseInt(dayMatch[1].replace(/,/g, ''), 10);
      // Sanity: free plan neighborhood
      if (monthly >= 900 && monthly <= 1100 && daily >= 150 && daily <= 250) {
        return { dailyLimit: daily, monthlyLimit: monthly, note: null };
      }
    }

    if (monthMatch) {
      const monthly = parseInt(monthMatch[1].replace(/,/g, ''), 10);
      if (monthly >= 900 && monthly <= 1100) {
        // If daily wasn't found, default to known free-plan daily cap (200)
        return { dailyLimit: 200, monthlyLimit: monthly, note: null };
      }
    }

    // Explicit "Free Plan ... 1,000 ... per month" variant
    const freePlanMonthly =
      text.match(/free\s+plan[^]*?(\d{1,3}(?:,\d{3})*)\s*emails?[^]*?(?:month|mo)\b/i);
    if (freePlanMonthly) {
      const monthly = parseInt(freePlanMonthly[1].replace(/,/g, ''), 10);
      if (monthly >= 900 && monthly <= 1100) {
        return { dailyLimit: 200, monthlyLimit: monthly, note: null };
      }
    }

    if (dayMatch) {
      const daily = parseInt(dayMatch[1].replace(/,/g, ''), 10);
      if (daily >= 150 && daily <= 250) {
        return { dailyLimit: daily, monthlyLimit: 1000, note: null };
      }
    }

    return null;
  }

  // --- Brevo (Sendinblue) ---
  if (name === 'Brevo (Sendinblue)') {
    const dailyMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s+emails?\s+per\s+day\b/i);
    if (dailyMatch) {
      const daily = parseInt(dailyMatch[1].replace(/,/g, ''), 10);
      if (daily > 0) {
        return { dailyLimit: daily, monthlyLimit: daily * 30, note: null };
      }
    }
    return null;
  }

  // --- Mailjet ---
  if (name === 'Mailjet') {
    const dailyMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s+emails?\s*(?:per|\/)\s*day\b/i);
    const monthMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s+emails?\s*(?:per|\/)\s*month\b/i);
    if (dailyMatch) {
      const daily = parseInt(dailyMatch[1].replace(/,/g, ''), 10);
      const monthly = monthMatch ? parseInt(monthMatch[1].replace(/,/g, ''), 10) : daily * 30;
      if (daily > 0 && monthly > 0) {
        return { dailyLimit: daily, monthlyLimit: monthly, note: null };
      }
    }
    return null;
  }

  // Default: no extraction
  return null;
}

async function fetchWithHeaders(url, opts = {}) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    ...(opts.headers || {})
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = opts.timeoutMs ?? 15000;
  let timeoutId = null;
  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: controller ? controller.signal : undefined,
      redirect: 'follow'
    });
    return res;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function scrapeService(service) {
  try {
    console.log(`📧 ${service.name}`);
    console.log(` → Fetching ${service.url}...`);
    const response = await fetchWithHeaders(service.url, { timeoutMs: 15000 });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    let data = extractFromText(html, service.name);

    // FIX: If SMTP2GO pricing page fails, try the Support Free Plan article
    if (!data && service.name === 'SMTP2GO') {
      console.log(' → Primary failed, trying support article...');
      const supportUrl = 'https://support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan';
      const alt = await fetchWithHeaders(supportUrl, { timeoutMs: 15000 });
      if (alt.ok) {
        const altHtml = await alt.text();
        const altData = extractFromText(altHtml, service.name);
        if (altData) {
          console.log(` ✓ Scraped from support: ${altData.dailyLimit}/day, ${altData.monthlyLimit}/month`);
          return {
            name: service.name,
            url: service.url,
            dailyLimit: altData.dailyLimit,
            monthlyLimit: altData.monthlyLimit,
            note: altData.note,
            lastScraped: new Date().toISOString(),
            scrapedSuccessfully: true
          };
        }
      }
    }

    if (!data) {
      console.log(` ⚠️ Could not extract data, using fallback`);
      return null;
    }

    console.log(` ✓ Scraped: ${data.dailyLimit}/day, ${data.monthlyLimit}/month`);
    return {
      name: service.name,
      url: service.url,
      dailyLimit: data.dailyLimit,
      monthlyLimit: data.monthlyLimit,
      note: data.note,
      lastScraped: new Date().toISOString(),
      scrapedSuccessfully: true
    };
  } catch (error) {
    console.log(` ✗ Error: ${error.message}`);
    return null;
  }
}

async function scrapeAll() {
  console.log('═══════════════════════════════════════\n');

  // Load previous data to track changes
  const previousData = loadPreviousData();

  const servicesToScrape = [
    { name: 'SendPulse', url: 'https://sendpulse.com/prices/smtp' },
    { name: 'Mailgun', url: 'https://www.mailgun.com/pricing/' },
    { name: 'MailerSend', url: 'https://www.mailersend.com/pricing' },
    { name: 'Resend', url: 'https://resend.com/pricing' },
    { name: 'Brevo (Sendinblue)', url: 'https://www.brevo.com/pricing/' },
    { name: 'Mailjet', url: 'https://www.mailjet.com/pricing/' },
    { name: 'SMTP2GO', url: 'https://www.smtp2go.com/pricing/' }
  ];

  const results = [];

  // Try to scrape services
  for (const service of servicesToScrape) {
    const data = await scrapeService(service);
    if (data) {
      results.push(data);
    }
    // Polite delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n═══════════════════════════════════════\n');

  // Add fallback data for services not scraped
  const scrapedNames = results.map(r => r.name);
  const missingServices = fallbackData.filter(f => !scrapedNames.includes(f.name));

  console.log(`✓ Successfully scraped: ${results.length} services`);
  console.log(`✓ Using fallback data: ${missingServices.length} services\n`);

  missingServices.forEach(service => {
    // Find previous data for this service
    const previous = previousData.find(p => p.name === service.name);
    results.push({
      ...service,
      lastScraped: previous?.lastScraped || new Date().toISOString(),
      scrapedSuccessfully: false,
      // Preserve lastChanged if no new scrape
      lastChanged: previous?.lastChanged || null
    });
  });

  // Check for changes and update lastChanged date
  results.forEach(service => {
    const previous = previousData.find(p => p.name === service.name);
    if (previous) {
      const limitsChanged =
        previous.dailyLimit !== service.dailyLimit ||
        previous.monthlyLimit !== service.monthlyLimit;
      if (limitsChanged) {
        console.log(`🔄 CHANGE DETECTED: ${service.name}`);
        console.log(` Old: ${previous.dailyLimit}/day, ${previous.monthlyLimit}/month`);
        console.log(` New: ${service.dailyLimit}/day, ${service.monthlyLimit}/month`);
        service.lastChanged = new Date().toISOString();
      } else {
        service.lastChanged = previous.lastChanged || null;
      }
    } else {
      // New service - set lastChanged to now
      service.lastChanged = new Date().toISOString();
    }
  });

  // Sort by monthly limit (descending)
  results.sort((a, b) => b.monthlyLimit - a.monthlyLimit);

  // Write to file
  fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Processed ${results.length} services total`);
  console.log(' - Scraped automatically: ' + results.filter(r => r.scrapedSuccessfully).length);
  console.log(' - Using fallback data: ' + results.filter(r => !r.scrapedSuccessfully).length);
  console.log('\n📄 data.json updated successfully\n');
}

scrapeAll().catch(error => {
  console.error('Fatal error:', error);
  // Use complete fallback on failure
  const previousData = loadPreviousData();
  const fallbackWithDates = fallbackData.map(f => {
    const previous = previousData.find(p => p.name === f.name);
    return {
      ...f,
      lastScraped: previous?.lastScraped || new Date().toISOString(),
      lastChanged: previous?.lastChanged || null,
      scrapedSuccessfully: false
    };
  });
  fallbackWithDates.sort((a, b) => b.monthlyLimit - a.monthlyLimit);
  fs.writeFileSync('data.json', JSON.stringify(fallbackWithDates, null, 2));
  console.log('⚠️ Using complete fallback data');
});
