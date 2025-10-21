const fs = require('fs');

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
  { name: 'SMTP2GO', dailyLimit: 33, monthlyLimit: 1000, url: 'https://www.smtp2go.com/pricing/', note: null },
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
  } catch (error) {
    console.log('⚠️  Could not load previous data:', error.message);
  }
  return [];
}

// Simple text extraction function
function extractFromText(text, name) {
  const lowerText = text.toLowerCase();

// SendPulse specific
if (name === 'SendPulse') {
  // Look for the free plan - shows "12000 emails" and "Free"
  const monthMatch = text.match(/(\d+,?\d*)\s*emails?\s*Free/i) || 
                     text.match(/Free.*?(\d+,?\d*)\s*emails?/i);
  
  if (monthMatch) {
    const monthly = parseInt(monthMatch[1].replace(',', ''));
    const daily = Math.floor(monthly / 30);
    console.log(`   [DEBUG] Found SendPulse free plan: ${monthly} emails/month`);
    return {
      dailyLimit: daily,
      monthlyLimit: monthly,
      note: null
    };
  }
  
  return null;
}
  
// Mailgun specific - only free plan has "per day" limit
if (name === 'Mailgun') {
  // Debug: log what we're searching
  const lowerText = text.toLowerCase();
  const hasDay = lowerText.includes('day');
  const hasFree = lowerText.includes('free');
  
  console.log(`   [DEBUG] Text contains 'day': ${hasDay}, 'free': ${hasFree}`);
  
  const dailyMatch = text.match(/(\d+,?\d*)\s*emails?\s*(?:per|\/)\s*day/i);
  
  if (dailyMatch) {
    console.log(`   [DEBUG] Found match: "${dailyMatch[0]}" = ${dailyMatch[1]} emails/day`);
    const daily = parseInt(dailyMatch[1].replace(',', ''));
    return { 
      dailyLimit: daily, 
      monthlyLimit: daily * 30,
      note: 'Free plan - no credit card required' 
    };
  } else {
    console.log(`   [DEBUG] No daily limit pattern found in page text`);
  }
  
  return null;
}

  
  // MailerSend specific
  if (name === 'MailerSend') {
    if (lowerText.includes('500 emails per month') || lowerText.includes('500 emails/month')) {
      return { dailyLimit: 100, monthlyLimit: 500, note: 'Requires credit card' };
    }
    // Look for any "X emails per month" for free plan
    const monthMatch = text.match(/free.*?(\d+)\s*emails?\s*(?:per|\/)\s*month/i);
    if (monthMatch) {
      const monthly = parseInt(monthMatch[1]);
      return { dailyLimit: Math.floor(monthly / 30), monthlyLimit: monthly, note: 'Requires credit card' };
    }
  }
  
// Resend specific
if (name === 'Resend') {
  // Strategy: Look for "Daily Limit" followed by any content, then find the first number
  // This captures "Daily Limit|100" pattern from the table
  const dailyMatch = text.match(/Daily\s*Limit[^\d]*?(\d+)/i);
  
  // Look for "X,XXX emails / mo" or "X,XXX emails per month" at bottom
  const monthMatch = text.match(/(\d+,\d+)\s+emails?\s*\/\s*mo/i) ||
                     text.match(/(\d+,\d+)\s+emails?\s*per\s*month/i);
  
  if (dailyMatch && monthMatch) {
    const daily = parseInt(dailyMatch[1]);
    const monthly = parseInt(monthMatch[1].replace(',', ''));
    
    console.log(`   [DEBUG] Found Resend Free plan: ${daily}/day, ${monthly}/month`);
    
    return {
      dailyLimit: daily,
      monthlyLimit: monthly,
      note: null
    };
  }
  
  // If only monthly found (daily parsing failed), calculate daily
  if (monthMatch) {
    const monthly = parseInt(monthMatch[1].replace(',', ''));
    console.log(`   [DEBUG] Only monthly found, calculating daily: ${monthly}/30`);
    return {
      dailyLimit: Math.floor(monthly / 30),
      monthlyLimit: monthly,
      note: null
    };
  }
  
  console.log(`   [DEBUG] Resend: No data found`);
  return null;
}
  
  // Fallback: if we find monthly but not daily, calculate daily
  if (monthMatch) {
    const monthly = parseInt(monthMatch[1].replace(',', ''));
    return {
      dailyLimit: Math.floor(monthly / 30),
      monthlyLimit: monthly,
      note: null
    };
  }
}
  
  // Brevo specific
  if (name === 'Brevo (Sendinblue)') {
    const dailyMatch = text.match(/(\d+)\s+emails?\s+per\s+day/i);
    if (dailyMatch) {
      const daily = parseInt(dailyMatch[1]);
      return {
        dailyLimit: daily,
        monthlyLimit: daily * 30,
        note: null
      };
    }
  }
  
  // Mailjet specific
  if (name === 'Mailjet') {
    const dailyMatch = text.match(/(\d+)\s+emails?\s*(?:per|\/)\s*day/i);
    const monthMatch = text.match(/(\d+,?\d*)\s+emails?\s*(?:per|\/)\s*month/i);
    
    if (dailyMatch) {
      const daily = parseInt(dailyMatch[1]);
      const monthly = monthMatch ? parseInt(monthMatch[1].replace(',', '')) : daily * 30;
      return { dailyLimit: daily, monthlyLimit: monthly, note: null };
    }
  }
  
  return null;
}

async function scrapeService(service) {
  try {
    console.log(`📧 ${service.name}`);
    console.log(`   → Fetching ${service.url}...`);
    
    const response = await fetch(service.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const data = extractFromText(html, service.name);
    
    if (!data) {
      console.log(`   ⚠️  Could not extract data, using fallback`);
      return null;
    }
    
    console.log(`   ✓ Scraped: ${data.dailyLimit}/day, ${data.monthlyLimit}/month`);
    
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
    console.log(`   ✗ Error: ${error.message}`);
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
  { name: 'Mailjet', url: 'https://www.mailjet.com/pricing/' }
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
      scrapedSuccessfully: false
    });
  });
  
  // Check for changes and update lastChanged date
  results.forEach(service => {
    const previous = previousData.find(p => p.name === service.name);
    
    if (previous) {
      // Check if values changed
      const limitsChanged = previous.dailyLimit !== service.dailyLimit || 
                           previous.monthlyLimit !== service.monthlyLimit;
      
      if (limitsChanged) {
        console.log(`🔄 CHANGE DETECTED: ${service.name}`);
        console.log(`   Old: ${previous.dailyLimit}/day, ${previous.monthlyLimit}/month`);
        console.log(`   New: ${service.dailyLimit}/day, ${service.monthlyLimit}/month`);
        service.lastChanged = new Date().toISOString();
      } else {
        // Keep previous lastChanged date
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
  console.log('   - Scraped automatically: ' + results.filter(r => r.scrapedSuccessfully).length);
  console.log('   - Using fallback data: ' + results.filter(r => !r.scrapedSuccessfully).length);
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
  console.log('⚠️  Using complete fallback data');
});
