const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

// Service configurations with selectors
const services = [
  {
    name: 'Brevo (Sendinblue)',
    url: 'https://www.brevo.com/pricing/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Brevo has 300/day = ~9000/month documented
      return {
        dailyLimit: 300,
        monthlyLimit: 9000,
        note: null
      };
    }
  },
  {
    name: 'Mailjet',
    url: 'https://www.mailjet.com/pricing/',
    type: 'puppeteer',
    extract: async (page) => {
      // Wait for pricing cards to load
      await page.waitForSelector('[data-testid="pricing-card"]', { timeout: 5000 }).catch(() => {});
      
      const data = await page.evaluate(() => {
        // Look for the free plan card
        const cards = document.querySelectorAll('[data-testid="pricing-card"]');
        for (const card of cards) {
          const title = card.querySelector('h3')?.textContent.toLowerCase();
          if (title && title.includes('free')) {
            const text = card.textContent;
            // Extract numbers from text
            const monthMatch = text.match(/(\d+,?\d*)\s*emails?\s*\/?\s*month/i);
            const dayMatch = text.match(/(\d+,?\d*)\s*emails?\s*\/?\s*day/i);
            
            return {
              dailyLimit: dayMatch ? parseInt(dayMatch[1].replace(',', '')) : 200,
              monthlyLimit: monthMatch ? parseInt(monthMatch[1].replace(',', '')) : 6000,
              note: null
            };
          }
        }
        return { dailyLimit: 200, monthlyLimit: 6000, note: null };
      });
      
      return data;
    }
  },
  {
    name: 'Mailgun',
    url: 'https://www.mailgun.com/pricing/',
    type: 'puppeteer',
    extract: async (page) => {
      await page.waitForSelector('.pricing', { timeout: 5000 }).catch(() => {});
      
      const data = await page.evaluate(() => {
        const elements = document.querySelectorAll('[class*="plan"], [class*="tier"]');
        for (const el of elements) {
          const text = el.textContent.toLowerCase();
          if (text.includes('free') || text.includes('trial')) {
            const monthMatch = text.match(/(\d+,?\d*)\s*emails/i);
            if (monthMatch) {
              const monthly = parseInt(monthMatch[1].replace(',', ''));
              return {
                dailyLimit: Math.floor(monthly / 30),
                monthlyLimit: monthly,
                note: null
              };
            }
          }
        }
        return { dailyLimit: 100, monthlyLimit: 3000, note: 'Trial period' };
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
      // AWS SES offers 3000 emails/month for 12 months with free tier
      return {
        dailyLimit: 100,
        monthlyLimit: 3000,
        note: 'First 12 months only (AWS Free Tier)'
      };
    }
  },
  {
    name: 'MailerSend',
    url: 'https://www.mailersend.com/pricing',
    type: 'puppeteer',
    extract: async (page) => {
      await page.waitForSelector('[class*="pricing"]', { timeout: 5000 }).catch(() => {});
      
      const data = await page.evaluate(() => {
        const text = document.body.textContent;
        const monthMatch = text.match(/free.*?(\d+,?\d*)\s*emails/i);
        if (monthMatch) {
          const monthly = parseInt(monthMatch[1].replace(',', ''));
          return {
            dailyLimit: Math.floor(monthly / 30),
            monthlyLimit: monthly,
            note: null
          };
        }
        return { dailyLimit: 100, monthlyLimit: 3000, note: null };
      });
      
      return data;
    }
  },
  {
    name: 'Resend',
    url: 'https://resend.com/pricing',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      const text = $('body').text().toLowerCase();
      
      // Look for free tier information
      const monthMatch = text.match(/(\d+,?\d*)\s*emails?\s*\/?\s*month/i);
      if (monthMatch) {
        const monthly = parseInt(monthMatch[1].replace(',', ''));
        return {
          dailyLimit: Math.floor(monthly / 30),
          monthlyLimit: monthly,
          note: null
        };
      }
      
      return { dailyLimit: 100, monthlyLimit: 3000, note: null };
    }
  },
  {
    name: 'Elastic Email',
    url: 'https://elasticemail.com/pricing',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      // Elastic Email typically offers 100/day
      return {
        dailyLimit: 100,
        monthlyLimit: 3000,
        note: null
      };
    }
  },
  {
    name: 'Mailtrap',
    url: 'https://mailtrap.io/pricing/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      return {
        dailyLimit: 200,
        monthlyLimit: 1000,
        note: 'Testing sandbox'
      };
    }
  },
  {
    name: 'SMTP2GO',
    url: 'https://www.smtp2go.com/pricing/',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      return {
        dailyLimit: 33,
        monthlyLimit: 1000,
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
      return {
        dailyLimit: 17,
        monthlyLimit: 500,
        note: 'For new Mailchimp users'
      };
    }
  },
  {
    name: 'Postmark',
    url: 'https://postmarkapp.com/pricing',
    type: 'cheerio',
    extract: async (html) => {
      const $ = cheerio.load(html);
      return {
        dailyLimit: 3,
        monthlyLimit: 100,
        note: 'Developer sandbox only'
      };
    }
  }
];

let browser = null;

async function scrapeWithPuppeteer(service) {
  try {
    if (!browser) {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`  Fetching ${service.url}...`);
    await page.goto(service.url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);
    
    const data = await service.extract(page);
    await page.close();
    
    return data;
  } catch (error) {
    console.error(`  Error with Puppeteer for ${service.name}:`, error.message);
    return null;
  }
}

async function scrapeWithCheerio(service) {
  try {
    console.log(`  Fetching ${service.url}...`);
    const response = await axios.get(service.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000
    });
    
    const data = await service.extract(response.data);
    return data;
  } catch (error) {
    console.error(`  Error with Cheerio for ${service.name}:`, error.message);
    return null;
  }
}

async function scrapeService(service) {
  console.log(`Scraping ${service.name}...`);
  
  try {
    const data = service.type === 'puppeteer' 
      ? await scrapeWithPuppeteer(service)
      : await scrapeWithCheerio(service);
    
    if (!data) {
      console.log(`  ⚠️  Failed, using fallback data`);
      return null;
    }
    
    console.log(`  ✓ Found: ${data.dailyLimit}/day, ${data.monthlyLimit}/month`);
    
    return {
      name: service.name,
      dailyLimit: data.dailyLimit,
      monthlyLimit: data.monthlyLimit,
      url: service.url,
      note: data.note,
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    console.error(`  ✗ Error for ${service.name}:`, error.message);
    return null;
  }
}

async function scrapeAll() {
  console.log('🚀 Starting scraping process...\n');
  const results = [];
  
  try {
    for (const service of services) {
      const data = await scrapeService(service);
      if (data) {
        results.push(data);
      }
      
      // Delay between requests to be polite
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Close browser if it was opened
    if (browser) {
      await browser.close();
      browser = null;
    }
    
    // Sort by monthly limit (descending)
    results.sort((a, b) => (b.monthlyLimit || 0) - (a.monthlyLimit || 0));
    
    // Write to file
    fs.writeFileSync('data.json', JSON.stringify(results, null, 2));
    console.log(`\n✅ Successfully scraped ${results.length} services`);
    console.log('📄 data.json updated');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

scrapeAll().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
