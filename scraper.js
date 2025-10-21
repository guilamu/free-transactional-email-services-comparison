const fs = require('fs');

console.log('🚀 Starting email service scraper (using native fetch)...\n');

// Fallback data - accurate as of October 2025
const fallbackData = [
  { name: 'SendPulse', dailyLimit: 400, monthlyLimit: 12000, url: 'https://sendpulse.com/prices/smtp', note: null },
  { name: 'Brevo (Sendinblue)', dailyLimit: 300, monthlyLimit: 9000, url: 'https://www.brevo.com/pricing/', note: null },
  { name: 'Mailjet', dailyLimit: 200, monthlyLimit: 6000, url: 'https://www.mailjet.com/pricing/', note: null },
  { name: 'Mailgun', dailyLimit: 167, monthlyLimit: 5000, url: 'https://www.mailgun.com/pricing/', note: 'Trial period' },
  { name: 'Resend', dailyLimit: 100, monthlyLimit: 3000, url: 'https://resend.com/pricing', note: null },
  { name: 'Elastic Email', dailyLimit: 100, monthlyLimit: 3000, url: 'https://elasticemail.com/pricing', note: null },
  { name: 'Amazon SES', dailyLimit: 100, monthlyLimit: 3000, url: 'https://aws.amazon.com/ses/pricing/', note: 'First 12 months with AWS Free Tier' },
  { name: 'SMTP2GO', dailyLimit: 33, monthlyLimit: 1000, url: 'https://www.smtp2go.com/pricing/', note: null },
  { name: 'Mailtrap', dailyLimit: 33, monthlyLimit: 1000, url: 'https://mailtrap.io/pricing/', note: 'Email testing sandbox' },
  { name: 'MailerSend', dailyLimit: 100, monthlyLimit: 500, url: 'https://www.mailersend.com/pricing', note: 'Requires credit card' },
  { name: 'Mailchimp Transactional', dailyLimit: 17, monthlyLimit: 500, url: 'https://mailchimp.com/pricing/transactional-email/', note: 'For Mailchimp users only' },
  { name: 'Postmark', dailyLimit: 3, monthlyLimit: 100, url: 'https://postmarkapp.com/pricing', note: 'Developer sandbox only' }
];

// Simple text extraction function (no HTML parsing needed for basic scraping)
function extractFromText(text, name) {
  const lowerText = text.toLowerCase();
  
  // MailerSend specific
  if (name === 'MailerSend') {
    if (lowerText.includes('500 emails per month') || lowerText.includes('500 emails/month')) {
      return { dailyLimit: 100, monthlyLimit: 500, note: 'Requires credit card' };
    }
  }
  
  // Resend specific
  if (name === 'Resend') {
    const dailyMatch = text.match(/(\d+)\s+emails?\s+per\s+day/i);
    const monthMatch = text.match(/(\d+,\d+)\s+emails?\s+per\s+month/i);
    if (dailyMatch && monthMatch) {
      return {
        dailyLimit: parseInt(dailyMatch[1]),
        monthlyLimit: parseInt(monthMatch[1].replace(',', '')),
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
  
  return null;
}

async function scrapeService(service) {
  try {
    console.log(`📧 ${service.name}`);
    console.log(`   → Fetching ${service.url}...`);
    
    const response = await fetch(service.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
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
    
    console.log(`   ✓ Found: ${data.dailyLimit}/day, ${data.monthlyLimit}/month`);
    
    return {
      ...service,
      ...data,
      lastUpdate: new Date().toISOString(),
      scrapedSuccessfully: true
    };
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
    return null;
  }
}

async function scrapeAll() {
  console.log('═══════════════════════════════════════\n');
  
  const servicesToScrape = [
    { name: 'MailerSend', url: 'https://www.mailersend.com/pricing' },
    { name: 'Resend', url: 'https://resend.com/pricing' },
    { name: 'Brevo (Sendinblue)', url: 'https://www.brevo.com/pricing/' }
  ];
  
  const results = [];
  
  // Try to scrape services
  for (const service of servicesToScrape) {
    const data = await scrapeService(service);
    if (data) {
      results.push(data);
    }
    
    // Polite delay
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n═══════════════════════════════════════\n');
  
  // Add fallback data for all services (override with scraped data where available)
  const scrapedNames = results.map(r => r.name);
  const missingServices = fallbackData.filter(f => !scrapedNames.includes(f.name));
  
  console.log(`✓ Successfully scraped: ${results.length} services`);
  console.log(`✓ Using fallback data: ${missingServices.length} services\n`);
  
  missingServices.forEach(service => {
    results.push({
      ...service,
      lastUpdate: new Date().toISOString(),
      scrapedSuccessfully: false
    });
  });
  
  // Sort by monthly limit
  results.sort((a, b) => b.monthlyLimit - a.monthlyLimit);
  
  // Write to file
  fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
  
  console.log(`✅ Processed ${results.length} services total`);
  console.log('📄 data.json updated successfully\n');
}

scrapeAll().catch(error => {
  console.error('Fatal error:', error);
  // Use complete fallback on failure
  const fallbackWithDates = fallbackData.map(f => ({
    ...f,
    lastUpdate: new Date().toISOString(),
    scrapedSuccessfully: false
  }));
  fallbackWithDates.sort((a, b) => b.monthlyLimit - a.monthlyLimit);
  fs.writeFileSync('data.json', JSON.stringify(fallbackWithDates, null, 2));
  console.log('⚠️  Using complete fallback data');
});
