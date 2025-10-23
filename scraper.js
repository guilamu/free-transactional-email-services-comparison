'use strict';

const fs = require('fs');

// Entry banner
console.log('🚀 Starting email service scraper with change tracking...\n');

// Fallback data - accurate as of October 2025
const fallbackData = [
  { name: 'SendPulse', dailyLimit: 400, monthlyLimit: 12000, url: 'https://sendpulse.com/prices/smtp' },
  { name: 'Brevo (Sendinblue)', dailyLimit: 300, monthlyLimit: 9000, url: 'https://www.brevo.com/pricing/' },
  { name: 'Mailjet', dailyLimit: 200, monthlyLimit: 6000, url: 'https://www.mailjet.com/pricing/' },
  { name: 'Mailgun', dailyLimit: 100, monthlyLimit: 3000, url: 'https://www.mailgun.com/pricing/' },
  { name: 'Resend', dailyLimit: 100, monthlyLimit: 3000, url: 'https://resend.com/pricing' },
  { name: 'SMTP2GO', dailyLimit: 200, monthlyLimit: 1000, url: 'https://www.smtp2go.com/pricing/' },
  { name: 'Mailtrap', dailyLimit: 33, monthlyLimit: 1000, url: 'https://mailtrap.io/pricing/' },
  { name: 'MailerSend', dailyLimit: 100, monthlyLimit: 500, url: 'https://www.mailersend.com/pricing' },  
  { name: 'Postmark', dailyLimit: 100, monthlyLimit: 100, url: 'https://postmarkapp.com/pricing' },
  { name: 'Maileroo', dailyLimit: 3000, monthlyLimit: 3000, url: 'https://maileroo.com/pricing' },
  { name: 'Sweego', dailyLimit: 100, monthlyLimit: 3000, url: 'https://api.sweego.io/billing/plans' }
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

// --- Sweego (JSON API) ---
if (name === 'Sweego') {
  let jsonData;
  try {
    jsonData = JSON.parse(text);
  } catch (err) {
    return null;
  }

  if (Array.isArray(jsonData)) {
    // Find the plan where plan.range_name = "Free"
    const freePlanEntry = jsonData.find(entry => 
      entry.plan && 
      entry.plan.range_name && 
      entry.plan.range_name.toLowerCase() === 'free'
    );
    
    if (freePlanEntry && freePlanEntry.features) {
      // Find the nb_emails feature with period = "day"
      const emailFeature = freePlanEntry.features.find(f => 
        f.name === 'nb_emails' && f.period === 'day'
      );
      
      if (emailFeature && emailFeature.value) {
        const daily = parseInt(emailFeature.value, 10);
        if (daily > 0) {
          return {
            dailyLimit: daily,
            monthlyLimit: daily * 30,
            note: null
          };
        }
      }
    }
  }
  
  return null;
}

// --- Maileroo ---
if (name === 'Maileroo') {
  // Normalize whitespace for robust matching
  const page = text.replace(/\s+/g, ' ');

  // Prefer the "outbound emails per month" phrasing from the help page
  // Examples on page: "up to 3,000 outbound emails per month + 1,000 inbound emails"
  const monthlyOutbound =
    page.match(/up\s*to\s*(\d{1,3}(?:,\d{3})*)\s*outbound\s*emails?\s*(?:per|\/)\s*month/i) ||
    page.match(/(\d{1,3}(?:,\d{3})*)\s*outbound\s*emails?\s*(?:per|\/)\s*month/i);

  if (monthlyOutbound) {
    const monthly = parseInt(monthlyOutbound[1].replace(/,/g, ''), 10);
    // Daily = floor(monthly/30)
    return {
      dailyLimit: Math.floor(monthly / 30),
      monthlyLimit: monthly,
      note: null
    };
  }

  // Fallback: generic monthly, but avoid matching the inbound figure by requiring "outbound" nearby
  const nearbyOutbound = page.match(/(\d{1,3}(?:,\d{3})*)\s*emails?\s*(?:per|\/)\s*month[^\.]{0,80}?outbound/i);
  if (nearbyOutbound) {
    const monthly = parseInt(nearbyOutbound[1].replace(/,/g, ''), 10);
    return {
      dailyLimit: Math.floor(monthly / 30),
      monthlyLimit: monthly,
      note: null
    };
  }

  // As a last resort, pick the smallest 4- or 3-digit monthly number that is not labeled inbound
  const allMonthly = [...page.matchAll(/(\d{3,4})\s*emails?\s*(?:per|\/)\s*month/ig)]
    .map(m => ({ n: parseInt(m[1], 10), raw: m[0] }))
    .filter(x => Number.isFinite(x.n) && !/inbound/i.test(x.raw));
  if (allMonthly.length) {
    const monthly = Math.min(...allMonthly.map(x => x.n));
    return {
      dailyLimit: Math.floor(monthly / 30),
      monthlyLimit: monthly,
      note: null
    };
  }

  return null;
}
  
// Mailtrap specific (Email API/SMTP Free plan)
if (name === 'Mailtrap') {
  // Normalize whitespace for reliable regex
  const page = text.replace(/\s+/g, ' ');

  // Look for the Free card: "3,500 emails" and "- 150 emails/day"
  // Monthly limit
  const monthMatch =
    page.match(/Free[^]*?(\d{1,3}(?:,\d{3})*)\s*emails\b/i) ||  // "Free ... 3,500 emails"
    page.match(/Email\s*sending\s*limit\s*per\s*month\.*\s*(\d{1,3}(?:,\d{3})*)\b/i); // table: "3,500"

  // Daily limit
  const dayMatch =
    page.match(/-?\s*150\s*emails\s*\/?\s*day/i) || // "- 150 emails/day"
    page.match(/Email\s*sending\s*limit\s*per\s*day\.*\s*(\d{1,3})\b/i); // table: "150"

  if (monthMatch || dayMatch) {
    const monthly = monthMatch ? parseInt(monthMatch[1].replace(/,/g, ''), 10) : 3500;
    const daily = dayMatch
      ? (dayMatch[1] ? parseInt(dayMatch[1], 10) : 150) // handle the case where the whole match is used
      : Math.floor(monthly / 30);

    return {
      dailyLimit: daily,              // 150
      monthlyLimit: monthly,          // 3,500
      note: 'Email API/SMTP'
    };
  }

  return null;
}

// --- Postmark ---
if (name === 'Postmark') {
  const page = text.replace(/\s+/g, ' '); // robustifier les regex
  // 1) Ancrage explicite sur le palier gratuit
  const anchored =
    page.match(/free\s+developer\s+(?:plan|tier)[^]{0,200}?(\d{1,3})(?:\s*emails?)?\s*(?:per|a)\s*month/i);
  // 2) Motif direct "100 emails per month"
  const direct = page.match(/\b(100)\s*emails?\s*(?:per|a)\s*month\b/i);

  let monthly = null;
  if (anchored) monthly = parseInt(anchored[1], 10);
  else if (direct) monthly = parseInt(direct[1], 10);

  // 3) Garde-fou: ignorer des gros volumes payants
  if (!monthly) {
    const loose = page.match(/\b(\d{1,3}(?:,\d{3})?)\s*emails?\s*(?:per|a)\s*month\b/i);
    if (loose) {
      const n = parseInt(loose[1].replace(/,/g, ''), 10);
      if (n > 0 && n <= 1000) monthly = n; // n=100 attendu pour Postmark
    }
  }

  if (monthly && monthly > 0) {
    return {
      dailyLimit: monthly,           // consigne: daily = monthly pour Postmark
      monthlyLimit: monthly,
      note: 'Free Developer plan'
    };
  }
  return null;
}


  
  // Amazon SES specific
if (name === 'Amazon SES') {
  // Normalize whitespace to make regex more reliable
  const page = text.replace(/\s+/g, ' ');

  // Match phrases like: "3,000 message charges free each month" or "up to 3,000 ... free each month"
  const freeTierMatch =
    page.match(/(\d{1,3}(?:,\d{3})*)\s*(?:message|messages|email|emails)\s*(?:charges\s*)?(?:free|included)[^\.]{0,120}?(?:per|each)\s*(?:month|mo)/i) ||
    page.match(/up\s*to\s*(\d{1,3}(?:,\d{3})*)\s*(?:message|messages)\s*(?:charges\s*)?free[^\.]{0,120}?(?:per|each)\s*(?:month|mo)/i);

  if (freeTierMatch) {
    const monthly = parseInt(freeTierMatch[1].replace(/,/g, ''), 10);
    const daily = Math.floor(monthly / 30);
    return {
      dailyLimit: daily,                // 3,000 ⇒ 100/day
      monthlyLimit: monthly,            // 3,000
      note: 'First 12 months'
    };
  }

  // Optional: legacy EC2-only free allowance safeguard if ever present verbatim
  const ec2Match = page.match(/(\d{1,3}(?:,\d{3})*)\s*emails?\s*per\s*month\s*free[^\.]{0,80}?Amazon\s*EC2/i);
  if (ec2Match) {
    const monthly = parseInt(ec2Match[1].replace(/,/g, ''), 10);
    return {
      dailyLimit: Math.floor(monthly / 30),
      monthlyLimit: monthly,
      note: 'EC2 context'
    };
  }

  return null;
}

  
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
  // Normaliser les espaces pour fiabiliser les regex
  const page = text.replace(/\s+/g, ' ');

  // 1) Mensuel: ancrer sur "Free" puis capter "X,XXX emails / mo" ou "per month"
  const freeMonthlyMatch =
    page.match(/Free[^]{0,300}?(\d{1,3}(?:,\d{3})*)\s*emails?\s*(?:\/\s*mo|\/\s*month|per\s*(?:month|mo))\b/i);

  // 2) Quotidien: ligne "Daily Limit" => premier nombre qui suit (colonne Free)
  const dailyMatch =
    page.match(/Daily\s*Limit[^0-9]{0,50}(\d{2,3})\b/i);

  if (dailyMatch && freeMonthlyMatch) {
    const daily = parseInt(dailyMatch[1], 10);
    const monthly = parseInt(freeMonthlyMatch[1].replace(/,/g, ''), 10);
    if (daily > 0 && monthly > 0) {
      return { dailyLimit: daily, monthlyLimit: monthly, note: null };
    }
  }

  // 3) Secours: si le quotidien manque, calculer 100 = 3000/30 quand le mensuel est trouvé
  if (freeMonthlyMatch) {
    const monthly = parseInt(freeMonthlyMatch[1].replace(/,/g, ''), 10);
    if (monthly > 0) {
      return { dailyLimit: Math.floor(monthly / 30), monthlyLimit: monthly, note: null };
    }
  }

  // 4) Secours large: accepter "X,XXX emails / mo" sans ancrage Free et choisir la plus petite valeur raisonnable
  const allMonthly = [...page.matchAll(/(\d{1,3}(?:,\d{3})*)\s*emails?\s*(?:\/\s*mo|\/\s*month|per\s*(?:month|mo))\b/ig)]
    .map(m => parseInt(m[1].replace(/,/g, ''), 10))
    .filter(n => Number.isFinite(n));
  if (allMonthly.length) {
    const monthly = Math.min(...allMonthly);
    if (monthly > 0 && monthly <= 5000) {
      return { dailyLimit: Math.floor(monthly / 30), monthlyLimit: monthly, note: null };
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
    { name: 'SMTP2GO', url: 'https://www.smtp2go.com/pricing/' },
    { name: 'Mailtrap', url: 'https://mailtrap.io/pricing/' },
    { name: 'Postmark', url: 'https://postmarkapp.com/pricing' },
    { name: 'Maileroo', url: 'https://maileroo.com/help/what-are-the-difference-between-free-paid-plans/' },
    { name: 'Sweego', url: 'https://api.sweego.io/billing/plans' }
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
  console.log(' - Scraped automatically daily: ' + results.filter(r => r.scrapedSuccessfully).length);
  console.log(' - Using hardcoded fallback data: ' + results.filter(r => !r.scrapedSuccessfully).length);
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
