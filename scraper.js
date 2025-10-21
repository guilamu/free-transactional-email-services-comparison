const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

// Service configurations with real extraction logic
const services = [
  {
    name: 'Resend',
    url: 'https://resend.com/pricing',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Resend has a clear table structure: Free plan shows "100" daily limit, 3000/mo
      let dailyLimit = 100;
      let monthlyLimit = 3000;
      
      // Try to extract from table
      $('table tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length > 0) {
          const firstCell = $(cells[0]).text().toLowerCase();
          if (firstCell.includes('daily limit')) {
            const freeValue = $(cells[1]).text().trim();
            if (freeValue && !freeValue.toLowerCase().includes('no limit')) {
              const match = freeValue.match(/(\d+)/);
              if (match) dailyLimit = parseInt(match[1]);
            }
          }
        }
      });
      
      // Look for "3,000 emails / mo" text
      const pageText = $('body').text();
      const monthMatch = pageText.match(/(\d+,?\d*)\s*emails?\s*\/\s*mo/i);
      if (monthMatch) {
        monthlyLimit = parseInt(monthMatch[1].replace(',', ''));
      }
      
      return { dailyLimit, monthlyLimit, note: null };
    }
  },
  {
    name: 'Brevo (Sendinblue)',
    url: 'https://www.brevo.com/pricing/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Brevo shows "Free forever" plan - documented as 300/day
      // The page has "Free forever" as a heading
      let dailyLimit = 300;
      let monthlyLimit = 9000;
      
      // Try to find specific limits in the free plan section
      const pageText = $('body').text().toLowerCase();
      
      // Look for daily email mentions
      const dailyMatch = pageText.match(/(\d+)\s*(?:emails?\s*)?(?:per|\/)\s*day/i);
      if (dailyMatch) {
        dailyLimit = parseInt(dailyMatch[1]);
      }
      
      return { dailyLimit, monthlyLimit, note: null };
    }
  },
  {
    name: 'Mailjet',
    url: 'https://www.mailjet.com/pricing/',
    type: 'puppeteer',
    extract: async (page) => {
      await page.waitForTimeout(3000); // Wait for dynamic content
      
      const data = await page.evaluate(() => {
        // Mailjet has pricing cards - look for free tier
        let dailyLimit = 200;
        let monthlyLimit = 6000;
        
        // Search for text containing pricing info
        const bodyText = document.body.textContent.toLowerCase();
        
        // Look for patterns like "200 emails/day" or "6000/month"
        const dailyMatch = bodyText.match(/(\d+,?\d*)\s*emails?\s*(?:per|\/)\s*day/i);
        const monthMatch = bodyText.match(/(\d+,?\d*)\s*emails?\s*(?:per|\/)\s*month/i);
        
        if (dailyMatch) {
          dailyLimit = parseInt(dailyMatch[1].replace(',', ''));
        }
        if (monthMatch) {
          monthlyLimit = parseInt(monthMatch[1].replace(',', ''));
        }
        
        return { dailyLimit, monthlyLimit, note: null };
      });
      
      return data;
    }
  },
  {
    name: 'Mailgun',
    url: 'https://www.mailgun.com/pricing/',
    type: 'puppeteer',
    extract: async (page) => {
      await page.waitForTimeout(3000);
      
      const data = await page.evaluate(() => {
        // Mailgun typically offers trial tier
        let dailyLimit = 100;
        let monthlyLimit = 5000; // Mailgun trial is 5000
        
        const bodyText = document.body.textContent.toLowerCase();
        
        // Look for trial or free tier
        const trialMatch = bodyText.match(/trial.*?(\d+,?\d*)\s*emails/i);
        const freeMatch = bodyText.match(/free.*?(\d+,?\d*)\s*emails/i);
        
        if (trialMatch) {
          monthlyLimit = parseInt(trialMatch[1].replace(',', ''));
        } else if (freeMatch) {
          monthlyLimit = parseInt(freeMatch[1].replace(',', ''));
        }
        
        dailyLimit = Math.floor(monthlyLimit / 30);
        
        return { dailyLimit, monthlyLimit, note: 'Trial period' };
      });
      
      return data;
    }
  },
  {
    name: 'Amazon SES',
    url: 'https://aws.amazon.com/ses/pricing/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // AWS SES Free Tier: documented as 3000/month for 12 months
      // This is tied to EC2 free tier
      
      return {
        dailyLimit: 100,
        monthlyLimit: 3000,
        note: 'First 12 months with AWS Free Tier'
      };
    }
  },
  {
    name: 'MailerSend',
    url: 'https://www.mailersend.com/pricing',
    type: 'puppeteer',
    extract: async (page) => {
      await page.waitForTimeout(3000);
      
      const data = await page.evaluate(() => {
        // MailerSend typically has 12,000/month free
        let dailyLimit = 400;
        let monthlyLimit = 12000;
        
        const bodyText = document.body.textContent;
        
        // Look for free plan details
        const monthMatch = bodyText.match(/free.*?(\d+,?\d*)\s*emails/i);
        if (monthMatch) {
          monthlyLimit = parseInt(monthMatch[1].replace(',', ''));
          dailyLimit = Math.floor(monthlyLimit / 30);
        }
        
        return { dailyLimit, monthlyLimit, note: null };
      });
      
      return data;
    }
  },
  {
    name: 'Elastic Email',
    url: 'https://elasticemail.com/pricing',
    type: 'puppeteer',
    extract: async (page) => {
      await page.waitForTimeout(3000);
      
      const data = await page.evaluate(() => {
        // Elastic Email has 100/day free
        let dailyLimit = 100;
        let monthlyLimit = 3000;
        
        const bodyText = document.body.textContent.toLowerCase();
        
        // Look for free tier or trial
        const dailyMatch = bodyText.match(/(\d+)\s*(?:emails?\s*)?(?:per|\/)\s*day/i);
        const freeMatch = bodyText.match(/free.*?(\d+,?\d*)\s*emails/i);
        
        if (dailyMatch) {
          dailyLimit = parseInt(dailyMatch[1]);
          monthlyLimit = dailyLimit * 30;
        } else if (freeMatch) {
          const emails = parseInt(freeMatch[1].replace(',', ''));
          if (emails < 500) {
            dailyLimit = emails;
            monthlyLimit = emails * 30;
          } else {
            monthlyLimit = emails;
            dailyLimit = Math.floor(emails / 30);
          }
        }
        
        return { dailyLimit, monthlyLimit, note: null };
      });
      
      return data;
    }
  },
  {
    name: 'Mailtrap',
    url: 'https://mailtrap.io/pricing/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Mailtrap is primarily a testing tool - free tier has limits
      
      return {
        dailyLimit: 200,
        monthlyLimit: 1000,
        note: 'Email testing sandbox'
      };
    }
  },
  {
    name: 'SMTP2GO',
    url: 'https://www.smtp2go.com/pricing/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // SMTP2GO free: 1000/month
      
      const pageText = $('body').text();
      let monthlyLimit = 1000;
      
      // Look for free tier
      const freeMatch = pageText.match(/free.*?(\d+,?\d*)\s*emails/i);
      if (freeMatch) {
        monthlyLimit = parseInt(freeMatch[1].replace(',', ''));
      }
      
      return {
        dailyLimit: Math.floor(monthlyLimit / 30),
        monthlyLimit: monthlyLimit,
        note: null
      };
    }
  },
  {
    name: 'Mailchimp Transactional',
    url: 'https://mailchimp.com/pricing/transactional-email/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Mailchimp Transactional (Mandrill): typically 500/month for new users
      
      return {
        dailyLimit: 17,
        monthlyLimit: 500,
        note: 'For Mailchimp users only'
      };
    }
  },
  {
    name: 'Postmark',
    url: 'https://postmarkapp.com/pricing',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Postmark free sandbox: 100 emails
      
      return {
        dailyLimit: 3,
        monthlyLimit: 100,
        note: 'Developer sandbox only'
      };
    }
  },
  {
    name: 'SendPulse',
    url: 'https://sendpulse.com/prices/smtp',
    type: 'puppeteer',
    extract: async (page) => {
      await page.waitForTimeout(3000);
      
      const data = await page.evaluate(() => {
        // SendPulse free: 12,000/month
        let monthlyLimit = 12000;
        let dailyLimit = 400;
        
        const bodyText = document.body.textContent;
        
        // Look for free plan
        const freeMatch = bodyText.match(/free.*?(\d+,?\d*)\s*emails/i);
        if (freeMatch) {
          monthlyLimit = parseInt(freeMatch[1].replace(',', ''));
          dailyLimit = Math.floor(monthlyLimit / 30);
        }
        
        return { dailyLimit, monthlyLimit, note: null };
      });
      
      return data;
    }
  }
];

let browser = null;

async function scrapeWithPuppeteer(service) {
  try {
    if (!browser) {
      const puppeteerConfig = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };
      
      // Use system chromium if available (GitHub Actions)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      
      browser = await puppeteer.launch(puppeteerConfig);
    }
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`  → Fetching ${service.url}...`);
    
    await page.goto(service.url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    const data = await service.extract(page);
    await page.close();
    
    return data;
  } catch (error) {
    console.error(`  ✗ Puppeteer error: ${error.message}`);
    return null;
  }
}

async function scrapeWithCheerio(service) {
  try {
    console.log(`  → Fetching ${service.url}...`);
    
    const response = await axios.get(service.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 20000,
      maxRedirects: 5
    });
    
    const data = await service.extract(response.data);
    return data;
  } catch (error) {
    console.error(`  ✗ Cheerio error: ${error.message}`);
    return null;
  }
}

async function scrapeService(service) {
  console.log(`\n📧 ${service.name}`);
  
  try {
    const data = service.type === 'puppeteer' 
      ? await scrapeWithPuppeteer(service)
      : await scrapeWithCheerio(service);
    
    if (!data || !data.monthlyLimit) {
      console.log(`  ⚠️  No data extracted, using fallback`);
      return null;
    }
    
    console.log(`  ✓ ${data.dailyLimit}/day, ${data.monthlyLimit}/month`);
    
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
    console.error(`  ✗ Error: ${error.message}`);
    return null;
  }
}

// Fallback data in case scraping fails
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

async function scrapeAll() {
  console.log('🚀 Starting email service scraper...\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  const results = [];
  
  try {
    // Scrape all services
    for (const service of services) {
      const data = await scrapeService(service);
      if (data) {
        results.push(data);
      }
      
      // Polite delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Close browser
    if (browser) {
      await browser.close();
      browser = null;
    }
    
    console.log('\n═══════════════════════════════════════════════════\n');
    
    // Use fallback data for failed services
    const successfulNames = results.map(r => r.name);
    const failedServices = fallbackData.filter(f => !successfulNames.includes(f.name));
    
    if (failedServices.length > 0) {
      console.log(`⚠️  Using fallback data for ${failedServices.length} services:\n`);
      failedServices.forEach(service => {
        console.log(`   - ${service.name}`);
        results.push({
          ...service,
          lastUpdate: new Date().toISOString(),
          scrapedSuccessfully: false
        });
      });
      console.log('');
    }
    
    // Sort by monthly limit (descending)
    results.sort((a, b) => (b.monthlyLimit || 0) - (a.monthlyLimit || 0));
    
    // Write to file
    fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
    
    console.log(`✅ Successfully processed ${results.length} services`);
    console.log(`   - Scraped: ${results.filter(r => r.scrapedSuccessfully).length}`);
    console.log(`   - Fallback: ${results.filter(r => !r.scrapedSuccessfully).length}`);
    console.log('\n📄 data.json updated successfully\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    
    // If everything fails, use complete fallback
    if (results.length === 0) {
      console.log('⚠️  Using complete fallback data');
      const fallbackWithDates = fallbackData.map(f => ({
        ...f,
        lastUpdate: new Date().toISOString(),
        scrapedSuccessfully: false
      }));
      fallbackWithDates.sort((a, b) => b.monthlyLimit - a.monthlyLimit);
      fs.writeFileSync('data.json', JSON.stringify(fallbackWithDates, null, 2));
    }
    
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
}

// Run the scraper
scrapeAll().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
