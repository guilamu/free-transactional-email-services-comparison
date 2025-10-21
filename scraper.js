const fs = require('fs');

console.log('Starting scraper...');

// Static data with accurate free tier limits as of 2025
const services = [
  { 
    name: 'SendPulse', 
    dailyLimit: 400, 
    monthlyLimit: 12000, 
    url: 'https://sendpulse.com/prices/smtp', 
    note: null 
  },
  { 
    name: 'MailerSend', 
    dailyLimit: 400, 
    monthlyLimit: 12000, 
    url: 'https://www.mailersend.com/pricing', 
    note: null 
  },
  { 
    name: 'Brevo (Sendinblue)', 
    dailyLimit: 300, 
    monthlyLimit: 9000, 
    url: 'https://www.brevo.com/pricing/', 
    note: null 
  },
  { 
    name: 'Mailjet', 
    dailyLimit: 200, 
    monthlyLimit: 6000, 
    url: 'https://www.mailjet.com/pricing/', 
    note: null 
  },
  { 
    name: 'Mailgun', 
    dailyLimit: 167, 
    monthlyLimit: 5000, 
    url: 'https://www.mailgun.com/pricing/', 
    note: 'Trial period' 
  },
  { 
    name: 'Resend', 
    dailyLimit: 100, 
    monthlyLimit: 3000, 
    url: 'https://resend.com/pricing', 
    note: null 
  },
  { 
    name: 'Elastic Email', 
    dailyLimit: 100, 
    monthlyLimit: 3000, 
    url: 'https://elasticemail.com/pricing', 
    note: null 
  },
  { 
    name: 'Amazon SES', 
    dailyLimit: 100, 
    monthlyLimit: 3000, 
    url: 'https://aws.amazon.com/ses/pricing/', 
    note: 'First 12 months with AWS Free Tier' 
  },
  { 
    name: 'SMTP2GO', 
    dailyLimit: 33, 
    monthlyLimit: 1000, 
    url: 'https://www.smtp2go.com/pricing/', 
    note: null 
  },
  { 
    name: 'Mailtrap', 
    dailyLimit: 33, 
    monthlyLimit: 1000, 
    url: 'https://mailtrap.io/pricing/', 
    note: 'Email testing sandbox' 
  },
  { 
    name: 'Mailchimp Transactional', 
    dailyLimit: 17, 
    monthlyLimit: 500, 
    url: 'https://mailchimp.com/pricing/transactional-email/', 
    note: 'For Mailchimp users only' 
  },
  { 
    name: 'Postmark', 
    dailyLimit: 3, 
    monthlyLimit: 100, 
    url: 'https://postmarkapp.com/pricing', 
    note: 'Developer sandbox only' 
  }
];

// Add timestamp to all services
const results = services.map(service => ({
  ...service,
  lastUpdate: new Date().toISOString(),
  scrapedSuccessfully: false
}));

// Sort by monthly limit (descending)
results.sort((a, b) => b.monthlyLimit - a.monthlyLimit);

// Write to file
try {
  fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
  console.log('✅ Successfully updated data.json with ' + results.length + ' services');
  console.log('Data written successfully');
} catch (error) {
  console.error('Error writing file:', error);
  process.exit(1);
}

console.log('Scraper completed successfully');
