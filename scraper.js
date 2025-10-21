const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

// Configuration for each service
const services = [
  {
    name: 'SendPulse',
    dailyLimit: 400,
    monthlyLimit: 12000,
    url: 'https://sendpulse.com/prices/smtp',
    isStatic: true  // Update when scraping is implemented
  },
  {
    name: 'Brevo (Sendinblue)',
    dailyLimit: 300,
    monthlyLimit: 9000,
    url: 'https://www.brevo.com/pricing/',
    isStatic: true
  },
  {
    name: 'Mailjet',
    dailyLimit: 200,
    monthlyLimit: 6000,
    url: 'https://www.mailjet.com/pricing/',
    isStatic: true
  },
  {
    name: 'SendGrid',
    dailyLimit: 100,
    monthlyLimit: 3000,
    url: 'https://sendgrid.com/pricing/',
    isStatic: true
  },
  {
    name: 'Mailgun',
    dailyLimit: 100,
    monthlyLimit: 3000,
    url: 'https://www.mailgun.com/pricing/',
    isStatic: true
  },
  {
    name: 'Amazon SES',
    dailyLimit: 100,
    monthlyLimit: 3000,
    url: 'https://aws.amazon.com/ses/pricing/',
    isStatic: true,
    note: 'First 12 months only'
  },
  {
    name: 'MailerSend',
    dailyLimit: 100,
    monthlyLimit: 3000,
    url: 'https://www.mailersend.com/pricing',
    isStatic: true
  },
  {
    name: 'Resend',
    dailyLimit: 100,
    monthlyLimit: 3000,
    url: 'https://resend.com/pricing',
    isStatic: true
  },
  {
    name: 'Elastic Email',
    dailyLimit: 100,
    monthlyLimit: 3000,
    url: 'https://elasticemail.com/pricing',
    isStatic: true
  },
  {
    name: 'Mailtrap',
    dailyLimit: 200,
    monthlyLimit: 1000,
    url: 'https://mailtrap.io/pricing/',
    isStatic: true
  },
  {
    name: 'SMTP2GO',
    dailyLimit: 33,
    monthlyLimit: 1000,
    url: 'https://www.smtp2go.com/pricing/',
    isStatic: true
  },
  {
    name: 'Mailchimp Transactional',
    dailyLimit: 17,
    monthlyLimit: 500,
    url: 'https://mailchimp.com/pricing/transactional-email/',
    isStatic: true
  },
  {
    name: 'Postmark',
    dailyLimit: 3,
    monthlyLimit: 100,
    url: 'https://postmarkapp.com/pricing',
    isStatic: true,
    note: 'Test mode only'
  }
];

async function scrapeService(service) {
  try {
    // For now, return static data
    // TODO: Implement actual scraping logic per service
    return {
      name: service.name,
      dailyLimit: service.dailyLimit,
      monthlyLimit: service.monthlyLimit,
      url: service.url,
      note: service.note || null,
      lastUpdate: new Date().toISOString()
    };
    
    /* Future scraping implementation example:
    const response = await axios.get(service.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    
    // Extract data based on service-specific selectors
    const dailyLimit = parseInt($('.free-plan .daily-limit').text()) || null;
    const monthlyLimit = parseInt($('.free-plan .monthly-limit').text()) || null;
    
    return {
      name: service.name,
      dailyLimit,
      monthlyLimit,
      url: service.url,
      lastUpdate: new Date().toISOString()
    };
    */
  } catch (error) {
    console.error(`Error scraping ${service.name}:`, error.message);
    return null;
  }
}

async function scrapeAll() {
  console.log('Starting scraping process...');
  const results = [];
  
  for (const service of services) {
    const data = await scrapeService(service);
    if (data) {
      results.push(data);
    }
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Sort by monthly limit (descending)
  results.sort((a, b) => (b.monthlyLimit || 0) - (a.monthlyLimit || 0));
  
  // Write to data.json
  fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
  console.log(`Successfully scraped ${results.length} services`);
}

scrapeAll().catch(console.error);
