// Standalone test script for agent-twitter-client
// Run: node test-twitter.mjs

import { readFileSync } from 'fs';

// Manually load .env.local
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
}

const username = process.env.TWITTER_USERNAME;
const password = process.env.TWITTER_PASSWORD;

console.log('=== Twitter Scraper Debug Test ===');
console.log(`Username: ${username || 'NOT SET'}`);
console.log(`Password: ${password ? '***SET***' : 'NOT SET'}`);

if (!username || !password) {
    console.error('❌ TWITTER_USERNAME or TWITTER_PASSWORD not set');
    process.exit(1);
}

try {
    console.log('\n1. Importing agent-twitter-client...');
    const { Scraper } = await import('agent-twitter-client');
    console.log('   ✅ Import successful');

    console.log('\n2. Creating scraper instance...');
    const scraper = new Scraper();
    console.log('   ✅ Instance created');

    console.log('\n3. Attempting login...');
    await scraper.login(username, password);

    const loggedIn = await scraper.isLoggedIn();
    console.log(`   Login result: ${loggedIn}`);

    if (!loggedIn) {
        console.error('   ❌ Login FAILED');
        console.log('\n   Possible reasons:');
        console.log('   - Account may be locked/suspended');
        console.log('   - Twitter may require email/phone verification');
        console.log('   - Password special characters issue');
        console.log('   - Rate limited or IP blocked');
        process.exit(1);
    }

    console.log('   ✅ Logged in successfully!');

    console.log('\n4. Fetching tweets from @akshaybd...');
    const tweets = [];
    const iterator = scraper.getTweets('akshaybd', 3);
    for await (const tweet of iterator) {
        tweets.push(tweet);
        if (tweets.length >= 3) break;
    }

    console.log(`   Got ${tweets.length} tweets:`);
    for (const t of tweets) {
        const text = (t.text || '').slice(0, 100);
        console.log(`   - [${t.id}] (${t.likes || 0} likes): "${text}..."`);
    }

    console.log('\n5. Searching for "solana"...');
    const searchResults = [];
    const searchIterator = scraper.searchTweets('solana', 3, 1);
    for await (const tweet of searchIterator) {
        searchResults.push(tweet);
        if (searchResults.length >= 3) break;
    }

    console.log(`   Got ${searchResults.length} search results:`);
    for (const t of searchResults) {
        const text = (t.text || '').slice(0, 100);
        console.log(`   - [${t.id}] (${t.likes || 0} likes): "${text}..."`);
    }

    console.log('\n=== Test Complete ===');
} catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
}
