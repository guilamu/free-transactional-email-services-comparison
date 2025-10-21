const fs = require('fs');

const services = [
  { name: 'SendPulse', dailyLimit: 400, monthlyLimit: 12000, url: 'https://sendpulse.com/prices/smtp' },
  { name: 'Brevo (Sendinblue)', dailyLimit: 300, monthlyLimit: 9000, url: 'https://www.brevo.com/pricing/' },
  { name: 'Mailjet', dailyLimit: 200, monthlyLimit: 6000, url: 'https://www.mailjet.com/pricing/' },
  { name: 'SendGrid', dailyLimit: 100, monthlyLimit: 3000, url: 'https://sendgrid.com/pricing/' },
  { name: 'Mailgun', dailyLimit: 100, monthlyLimit: 3000, url: 'https://www.mailgun.com/pricing/' },
  { name: 'Amazon SES', dailyLimit: 100, monthlyLimit: 3000, url: 'https://aws.amazon.com/ses/pricing/', note: 'First 12 months only' },
  { name: 'MailerSend', dailyLimit: 100, monthlyLimit: 3000, url: 'https://www.mailersend.com/pricing' },
  { name: 'Resend', dailyLimit: 100, monthlyLimit: 3000, url: 'https://resend.com/pricing' },
  { name: 'Elastic Email', dailyLimit: 100, monthlyLimit: 3000, url: 'https://elasticemail.com/pricing' },
  { name: 'Mailtrap', dailyLimit: 200, monthlyLimit: 1000, url: 'https://mailtrap.io/pricing/' },
  { name: 'SMTP2GO', dailyLimit: 33, monthlyLimit: 1000, url: 'https://www.smtp2go.com/pricing/' },
  { name: 'Mailchimp Transactional', dailyLimit: 17, monthlyLimit: 500, url: 'https://mailchimp.com/pricing/transactional-email/' },
  { name: 'Postmark', dailyLimit: 3, monthlyLimit: 100, url: 'https://postmarkapp.com/pricing', note: 'Test mode only' }
];

const results = services.map(s => ({
  ...s,
  lastUpdate: new Date().toISOString()
}));

results.sort((a, b) => b.monthlyLimit - a.monthlyLimit);

fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
console.log(`Successfully updated ${results.length} services`);
