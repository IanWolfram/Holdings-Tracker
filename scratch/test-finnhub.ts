import { fetchFinnhubNews, fetchQuote } from '../lib/finnhub';

async function test() {
  const ticker = 'AAPL';
  console.log(`Testing Finnhub SDK with ticker: ${ticker}`);
  
  try {
    console.log('\n--- Fetching News ---');
    const news = await fetchFinnhubNews(ticker);
    console.log(`Fetched ${news.length} articles.`);
    if (news.length > 0) {
      console.log('Sample headline:', news[0].headline);
    }
  } catch (err: any) {
    console.error('Error fetching news:', err.message);
  }

  try {
    console.log('\n--- Fetching Quote ---');
    const quote = await fetchQuote(ticker);
    console.log('Quote data:', quote);
  } catch (err: any) {
    console.error('Error fetching quote:', err.message);
  }
}

test();
