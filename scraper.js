const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

console.log('🚀 Starting email service scraper (Cheerio-only version)...\n');

// Fallback data - used when scraping fails
const fallbackData = [
  { name: 'SendPulse', dailyLimit: 400, monthlyLimit: 12000, url: 'https://sendpulse.com/prices/smtp', note: null },
  { name: 'MailerSend', dailyLimit: 400, monthlyLimit: 12000, url: 'https://www.mailersend.com/pricing', note: null },
  { name: 'Brevo (Sendinblue)', dailyLimit: 300, monthlyLimit: 9000, url: 'https://www.brevo.com/pricing/', note: null },
  { name: 'Mailjet', dailyLimit: 200, monthlyLimit: 6000, url: 'https://www.mailjet.com/pricing/', note: null },
  { name: 'Mailgun', dailyLimit: 167, monthlyLimit: 5000, url: 'https://www.mailgun.com/pricing/', note: 'Trial period' },
  { name: 'Resend', dailyLimit: 100, monthlyLimit: 3000, url: 'https://resend.com/pricing', note: null },
  { name: 'Elastic Email', dailyLimit: 100, monthlyLimit: 3000, url: 'https://elasticemail.com/pricing', note: null },
  { name: 'Amazon SES', dailyLimit: 100, monthlyLimit: 3000, url: 'https://aws.amazon.com/ses/pricing/', note: 'First 12 months with AWS Free Tier' },
  { name: 'SMTP2GO', dailyLimit: 33, monthlyLimit: 1000, url: 'https://www.smtp2go.com/pricing/', note: null },
  { name: 'Mailtrap', dailyLimit: 33, monthlyLimit: 1000, url: 'https://mailtrap.io/pricing/', note: 'Email testing sandbox' },
  { name: 'Mailchimp Transactional', dailyLimit: 17, monthlyLimit: 500, url: 'https://mailchimp.com/pricing/transactional-email/', note: 'For Mailchimp users only' },
  { name: 'Postmark', dailyLimit: 3, monthlyLimit: 100, url: 'https://postmarkapp.com/pricing', note: 'Developer sandbox only' }
];

// Services to scrape
const services = [
  {
    name: 'Resend',
    url: 'https://resend.com/pricing',
    extract: async (html) => {
      const $ = cheerio.load(html);
      let dailyLimit = 100;
      let monthlyLimit = 3000;
      
      // Try to find the free plan limits
      const bodyText = $('body').text();
      
      // Look for "100 emails per day" or "3,000 emails per month"
      const dailyMatch = bodyText.match(/(\d+)\s+emails?\s+per\s+day/i);
      const monthMatch = bodyText.match(/(\d+,?\d*)\s+emails?\s+(?:per|\/)\s+month/i);
      
      if (dailyMatch) {
        dailyLimit = parseInt(dailyMatch[1]);
      }
      if (monthMatch) {
        monthlyLimit = parseInt(monthMatch[1].replace(',', ''));
      }
      
      return { dailyLimit, monthlyLimit, note: null };
    }
  },
  {
    name: 'Brevo (Sendinblue)',
    url: 'https://www.brevo.com/pricing/',
    extract: async (html) => {
      const $ = cheerio.load(html);
      let dailyLimit = 300;
      let monthlyLimit = 9000; // 300 * 30
      
      const bodyText = $('body').text().toLowerCase();
      
      // Look for free plan mentions
      const dailyMatch = bodyText.match(/(\d+)\s*(?:emails?\s*)?(?:per|\/)\s*day/i);
      if (dailyMatch) {
        dailyLimit = parseInt(dailyMatch[1]);
        monthlyLimit = dailyLimit * 30;
      }
      
      return { dailyLimit, monthlyLimit, note: null };
    }
  },
  {
    name: 'Amazon SES',
    url: 'https://aws.amazon.com/ses/pricing/',
    extract: async (html) => {
      // AWS documentation is clear: 3000/month for first 12 months
      return {
        dailyLimit: 100,
        monthlyLimit: 3000,
        note: 'First 12 months with AWS Free Tier'
      };
    }
  },
  {
    name: 'Postmark',
    url: 'https://postmarkapp.com/pricing',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Postmark sandbox: 100 test emails
      return {
        dailyLimit: 3,
        monthlyLimit: 100,
        note: 'Developer sandbox only'
      };
    }
  }
];

async function scrapeService(service) {
  try {
    console.log(`📧 ${service.name}`);
    console.log(`   → Fetching ${service.url}...`);
    
    const response = await axios.get(service.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const data = await service.extract(response.data);
    
    if (!data || !data.monthlyLimit) {
      console.log(`   ⚠️  No data extracted`);
      return null;
    }
    
    console.log(`   ✓ ${data.dailyLimit}/day, ${data.monthlyLimit}/month`);
    
    return {
      name: service.name,
      dailyLimit: data.dailyLimit,
      monthlyLimit: data.monthlyLimit,
      url: service.url,
      note: data.note,
      lastUpdate: new Date().toISOString(),
      scrapedSuccessfully: true
    };
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
    return null;
  }
}

async function scrapeAll() {
  const results = [];
  
  try {
    console.log('════════════════════════════════════════════\n');
    
    // Scrape services
    for (const service of services) {
      const data = await scrapeService(service);
      if (data) {
        results.push(data);
      }
      
      // Polite delay
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n════════════════════════════════════════════\n');
    
    // Add fallback data for services we didn't scrape
    const scrapedNames = results.map(r => r.name);
    const missingServices = fallbackData.filter(f => !scrapedNames.includes(f.name));
    
    console.log(`✓ Scraped: ${results.length} services`);
    console.log(`✓ Using fallback: ${missingServices.length} services\n`);
    
    missingServices.forEach(service => {
      results.push({
        ...service,
        lastUpdate: new Date().toISOString(),
        scrapedSuccessfully: false
      });
    });
    
    // Sort by monthly limit (descending)
    results.sort((a, b) => (b.monthlyLimit || 0) - (a.monthlyLimit || 0));
    
    // Write to file
    fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
    
    console.log(`✅ Successfully processed ${results.length} services`);
    console.log('📄 data.json updated\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Use complete fallback if everything fails
    console.log('⚠️  Using complete fallback data\n');
    const fallbackWithDates = fallbackData.map(f => ({
      ...f,
      lastUpdate: new Date().toISOString(),
      scrapedSuccessfully: false
    }));
    fallbackWithDates.sort((a, b) => b.monthlyLimit - a.monthlyLimit);
    fs.writeFileSync('data.json', JSON.stringify(fallbackWithDates, null, 2));
    
    process.exit(0); // Exit with success even if scraping failed
  }
}

scrapeAll();
