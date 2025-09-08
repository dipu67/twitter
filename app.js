import puppeteer from "puppeteer";
import express from "express";


const app = express();
const port = 3000;

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function userProfile(userName) {
  const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
  try {
    await page.goto(`https://nitter.net/${userName}`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    // Wait for profile elements to load
    await page.waitForSelector('.profile-card', { timeout: 8000 });
    
    // Scrape user profile information
    const userInfo = await page.evaluate(() => {
      const profileData = {};
      
      // Get username
      const usernameElement = document.querySelector('.profile-card-username');
      profileData.username = usernameElement ? usernameElement.textContent.trim() : null;
      
      // Get display name (full name)
      const displayNameElement = document.querySelector('.profile-card-fullname');
      profileData.displayName = displayNameElement ? displayNameElement.textContent.trim() : null;
      
      // Get bio
      const bioElement = document.querySelector('.profile-bio p');
      profileData.bio = bioElement ? bioElement.textContent.trim() : null;
      console.log('Bio element found:', !!bioElement);
      if (bioElement) console.log('Bio content:', bioElement.textContent.trim());
      
      // Get website
      const websiteElement = document.querySelector('.profile-website span a');
      profileData.website = websiteElement ? websiteElement.href : null;
      profileData.websiteDisplay = websiteElement ? websiteElement.textContent.trim() : null;
      console.log('Website element found:', !!websiteElement);
      if (websiteElement) console.log('Website URL:', websiteElement.href);
      
      // Get join date
      const joinDateElement = document.querySelector('.profile-joindate span');
      profileData.joinDate = joinDateElement ? joinDateElement.getAttribute('title') : null;
      profileData.joinDateDisplay = joinDateElement ? joinDateElement.textContent.trim() : null;
      
      // Get profile avatar
      const avatarElement = document.querySelector('.profile-card-avatar img');
      profileData.avatar = avatarElement ? avatarElement.src : null;
      
      // Get banner image
      const bannerElement = document.querySelector('.profile-banner img');
      profileData.banner = bannerElement ? bannerElement.src : null;
      
      // Get verification status
      const verifiedElement = document.querySelector('.profile-card-fullname .verified-icon');
      profileData.isVerified = verifiedElement ? true : false;
      profileData.verificationType = verifiedElement ? 
        (verifiedElement.classList.contains('blue') ? 'blue' : 
         verifiedElement.classList.contains('gold') ? 'gold' : 'verified') : null;
      
      // Get stats from profile-statlist
      const stats = {};
      const statElements = document.querySelectorAll('.profile-statlist li');
      
      statElements.forEach(stat => {
        const header = stat.querySelector('.profile-stat-header');
        const num = stat.querySelector('.profile-stat-num');
        
        if (header && num) {
          const statName = header.textContent.trim().toLowerCase();
          const statValue = num.textContent.trim();
          stats[statName] = statValue;
        }
      });
      
      profileData.stats = stats;
      
      // Extract individual stats for easier access
      profileData.tweets = stats.tweets || null;
      profileData.following = stats.following || null;
      profileData.followers = stats.followers || null;
      profileData.likes = stats.likes || null;
      
      // Get photos and videos count
      const photoRailElement = document.querySelector('.photo-rail-header a');
      if (photoRailElement) {
        const photoText = photoRailElement.textContent;
        const photoMatch = photoText.match(/(\d+[\d,]*)\s*Photos and videos/);
        profileData.photosAndVideos = photoMatch ? photoMatch[1] : null;
      }
      
      return profileData;
    });

    await browser.close();
    console.log('Profile data extracted successfully:');
    return userInfo;
    
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    await browser.close();
    return { error: error.message };
  }
}

async function userTweets(userName, maxTweets = 5) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    console.log(`Navigating to: https://nitter.net/${userName}`);
    await page.goto(`https://nitter.net/${userName}`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    // Wait for timeline to load
    await page.waitForSelector('.timeline', { timeout: 8000 });
    
    // Scrape tweet information
    const tweets = await page.evaluate((maxTweets) => {
      const tweetElements = document.querySelectorAll('.timeline-item');
      const tweets = [];
      
      for (let i = 0; i < Math.min(tweetElements.length, maxTweets); i++) {
        const tweetElement = tweetElements[i];
        const tweetData = {};
        
        // Get tweet link/ID
        const tweetLinkElement = tweetElement.querySelector('.tweet-link');
        if (tweetLinkElement) {
          tweetData.tweetUrl = tweetLinkElement.href;
          const urlParts = tweetLinkElement.href.split('/');
          const statusIndex = urlParts.findIndex(part => part === 'status');
          if (statusIndex !== -1 && urlParts[statusIndex + 1]) {
            tweetData.tweetId = urlParts[statusIndex + 1].split('#')[0];
          }
        }
        
        // Get user info from tweet header
        const fullnameElement = tweetElement.querySelector('.fullname');
        tweetData.userDisplayName = fullnameElement ? fullnameElement.textContent.trim() : null;
        
        const usernameElement = tweetElement.querySelector('.username');
        tweetData.username = usernameElement ? usernameElement.textContent.trim() : null;
        
        // Get user avatar
        const avatarElement = tweetElement.querySelector('.tweet-avatar img');
        tweetData.userAvatar = avatarElement ? avatarElement.src : null;
        
        // Get verification status
        const verifiedElement = tweetElement.querySelector('.verified-icon');
        tweetData.isVerified = verifiedElement ? true : false;
        tweetData.verificationType = verifiedElement ? 
          (verifiedElement.classList.contains('blue') ? 'blue' : 
           verifiedElement.classList.contains('gold') ? 'gold' : 'verified') : null;
        
        // Get tweet date
        const dateElement = tweetElement.querySelector('.tweet-date a');
        if (dateElement) {
          tweetData.dateDisplay = dateElement.textContent.trim();
          tweetData.dateTitle = dateElement.getAttribute('title');
        }
        
        // Get tweet content
        const contentElement = tweetElement.querySelector('.tweet-content');
        tweetData.content = contentElement ? contentElement.textContent.trim() : null;
        
        // Get tweet stats
        const stats = {};
        const commentElement = tweetElement.querySelector('.tweet-stat .icon-comment');
        if (commentElement && commentElement.parentElement) {
          const commentText = commentElement.parentElement.textContent.trim();
          stats.comments = commentText || '0';
        }
        
        const retweetElement = tweetElement.querySelector('.tweet-stat .icon-retweet');
        if (retweetElement && retweetElement.parentElement) {
          const retweetText = retweetElement.parentElement.textContent.trim();
          stats.retweets = retweetText || '0';
        }
        
        const quoteElement = tweetElement.querySelector('.tweet-stat .icon-quote');
        if (quoteElement && quoteElement.parentElement) {
          const quoteText = quoteElement.parentElement.textContent.trim();
          stats.quotes = quoteText || '0';
        }
        
        const heartElement = tweetElement.querySelector('.tweet-stat .icon-heart');
        if (heartElement && heartElement.parentElement) {
          const heartText = heartElement.parentElement.textContent.trim();
          stats.likes = heartText || '0';
        }
        
        tweetData.stats = stats;
        
        // Get attachments/media
        const attachments = [];
        const imageElements = tweetElement.querySelectorAll('.attachments .attachment img');
        imageElements.forEach(img => {
          attachments.push({
            type: 'image',
            url: img.src,
            alt: img.alt || ''
          });
        });
        
        tweetData.attachments = attachments;
        tweetData.hasMedia = attachments.length > 0;
        
        tweets.push(tweetData);
      }
      
      return tweets;
    }, maxTweets);

    await browser.close();
    console.log(`Extracted ${tweets.length} tweets successfully`);
    return tweets;
    
  } catch (error) {
    console.error('Error fetching tweets:', error.message);
    await browser.close();
    return { error: error.message };
  }
}

async function searchTweets(keyword, maxTweets = 10, maxAgeDays = 30) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    console.log(`Searching for: ${keyword}`);
    await page.goto(`https://nitter.net/search?f=tweets&q=${encodeURIComponent(keyword)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    // Wait for timeline to load
    await page.waitForSelector('.timeline', { timeout: 8000 });
    
    let allTweets = [];
    let processedTweetIds = new Set(); // To avoid duplicates
    let currentDate = new Date();
    let oldestAllowedDate = new Date();
    oldestAllowedDate.setDate(currentDate.getDate() - maxAgeDays);
    
    // Function to scroll and load more tweets if needed
    const loadMoreTweets = async () => {
      try {
        // Wait a bit before checking for show-more button
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const showMoreButton = await page.$('.show-more a');
        if (showMoreButton) {
          console.log('Loading more tweets...');
          await showMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, 4000)); // Increased wait time
          return true;
        }
        return false;
      } catch (error) {
        console.log('Error clicking show more button:', error.message);
        return false;
      }
    };
    
    // Extract tweets with pagination support
    let attempts = 0;
    const maxAttempts = 15; // Increased max attempts
    let consecutiveEmptyAttempts = 0;
    
    while (allTweets.length < maxTweets && attempts < maxAttempts && consecutiveEmptyAttempts < 3) {
      attempts++;
      console.log(`Attempt ${attempts}: Currently have ${allTweets.length} tweets, need ${maxTweets}`);
      
      const tweets = await page.evaluate((maxTweets, allTweetsLength, processedIds) => {
        const tweetElements = document.querySelectorAll('.timeline-item');
        const tweets = [];
        
        // Process all available tweets, not just from where we left off
        for (let i = 0; i < tweetElements.length; i++) {
          const tweetElement = tweetElements[i];
          const tweetData = {};
          
          // Get tweet link/ID first for duplicate checking
          const tweetLinkElement = tweetElement.querySelector('.tweet-link');
          if (tweetLinkElement) {
            tweetData.tweetUrl = tweetLinkElement.href;
            const urlParts = tweetLinkElement.href.split('/');
            const statusIndex = urlParts.findIndex(part => part === 'status');
            if (statusIndex !== -1 && urlParts[statusIndex + 1]) {
              tweetData.tweetId = urlParts[statusIndex + 1].split('#')[0];
            }
          }
          
          // Skip if we've already processed this tweet
          if (tweetData.tweetId && processedIds.includes(tweetData.tweetId)) {
            continue;
          }
          
          // Check if it's a retweet
          const retweetHeader = tweetElement.querySelector('.retweet-header');
          tweetData.isRetweet = retweetHeader ? true : false;
          if (retweetHeader) {
            tweetData.retweetedBy = retweetHeader.textContent.trim();
          }
          
          // Get user info from tweet header
          const fullnameElement = tweetElement.querySelector('.fullname');
          tweetData.userDisplayName = fullnameElement ? fullnameElement.textContent.trim() : null;
          
          const usernameElement = tweetElement.querySelector('.username');
          tweetData.username = usernameElement ? usernameElement.textContent.trim() : null;
          
          // Get user avatar
          const avatarElement = tweetElement.querySelector('.tweet-avatar img');
          tweetData.userAvatar = avatarElement ? avatarElement.src : null;
          
          // Get verification status
          const verifiedElement = tweetElement.querySelector('.verified-icon');
          tweetData.isVerified = verifiedElement ? true : false;
          tweetData.verificationType = verifiedElement ? 
            (verifiedElement.classList.contains('blue') ? 'blue' : 
             verifiedElement.classList.contains('business') ? 'business' :
             verifiedElement.classList.contains('gold') ? 'gold' : 'verified') : null;
          
          // Get tweet date
          const dateElement = tweetElement.querySelector('.tweet-date a');
          if (dateElement) {
            tweetData.dateDisplay = dateElement.textContent.trim();
            tweetData.dateTitle = dateElement.getAttribute('title');
          }
          
          // Get tweet content
          const contentElement = tweetElement.querySelector('.tweet-content');
          tweetData.content = contentElement ? contentElement.textContent.trim() : null;
          
          // Check for reply indicator
          const replyingToElement = tweetElement.querySelector('.replying-to');
          if (replyingToElement) {
            tweetData.isReply = true;
            tweetData.replyingTo = replyingToElement.textContent.trim();
          }
          
          // Get tweet stats
          const stats = {};
          const commentElement = tweetElement.querySelector('.tweet-stat .icon-comment');
          if (commentElement && commentElement.parentElement) {
            const commentText = commentElement.parentElement.textContent.trim();
            stats.comments = commentText || '0';
          }
          
          const retweetElement = tweetElement.querySelector('.tweet-stat .icon-retweet');
          if (retweetElement && retweetElement.parentElement) {
            const retweetText = retweetElement.parentElement.textContent.trim();
            stats.retweets = retweetText || '0';
          }
          
          const quoteElement = tweetElement.querySelector('.tweet-stat .icon-quote');
          if (quoteElement && quoteElement.parentElement) {
            const quoteText = quoteElement.parentElement.textContent.trim();
            stats.quotes = quoteText || '0';
          }
          
          const heartElement = tweetElement.querySelector('.tweet-stat .icon-heart');
          if (heartElement && heartElement.parentElement) {
            const heartText = heartElement.parentElement.textContent.trim();
            stats.likes = heartText || '0';
          }
          
          tweetData.stats = stats;
          
          // Get attachments/media
          const attachments = [];
          const imageElements = tweetElement.querySelectorAll('.attachments .attachment img');
          imageElements.forEach(img => {
            attachments.push({
              type: 'image',
              url: img.src,
              alt: img.alt || ''
            });
          });
          
          // Check for video attachments
          const videoElements = tweetElement.querySelectorAll('.attachments .attachment video');
          videoElements.forEach(video => {
            attachments.push({
              type: 'video',
              url: video.getAttribute('data-url') || video.src,
              poster: video.poster || ''
            });
          });
          
          tweetData.attachments = attachments;
          tweetData.hasMedia = attachments.length > 0;
          
          tweets.push(tweetData);
          
          // Stop if we have enough tweets
          if (tweets.length >= (maxTweets - allTweetsLength)) {
            break;
          }
        }
        
        return tweets;
      }, maxTweets, allTweets.length, Array.from(processedTweetIds));
      
      // Add new tweets to our collection and track IDs
      const previousCount = allTweets.length;
      tweets.forEach(tweet => {
        if (tweet.tweetId && !processedTweetIds.has(tweet.tweetId)) {
          allTweets.push(tweet);
          processedTweetIds.add(tweet.tweetId);
        }
      });
      const newCount = allTweets.length;
      
      console.log(`Extracted ${newCount - previousCount} new tweets. Total: ${newCount}/${maxTweets}`);
      
      // Track consecutive empty attempts
      if (newCount === previousCount) {
        consecutiveEmptyAttempts++;
        console.log(`No new tweets found (${consecutiveEmptyAttempts}/3 empty attempts)`);
      } else {
        consecutiveEmptyAttempts = 0; // Reset if we found tweets
      }
      
      // If we have enough tweets, break
      if (allTweets.length >= maxTweets) {
        console.log(`Reached target of ${maxTweets} tweets`);
        break;
      }
      
      // If no new tweets were found, try to load more
      if (newCount === previousCount) {
        console.log('Trying to load more tweets...');
        const hasMore = await loadMoreTweets();
        if (!hasMore) {
          console.log('No show-more button found');
          break;
        }
      }
      
      // Small delay between extractions
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Truncate to requested number of tweets (in case we got more)
    allTweets = allTweets.slice(0, maxTweets);
    
    await browser.close();
    console.log(`Search completed: Found ${allTweets.length}/${maxTweets} requested tweets for keyword: ${keyword}`);
    
    return {
      keyword,
      maxTweets,
      maxAgeDays,
      totalFound: allTweets.length,
      requestedCount: maxTweets,
      hasMore: allTweets.length < maxTweets ? false : undefined, // If we got fewer than requested, no more available
      tweets: allTweets
    };
    
  } catch (error) {
    console.error('Error searching tweets:', error.message);
    await browser.close();
    return { error: error.message };
  }
}

// Route for user profile
app.get("/userProfile", async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).send("Username is required");
  }
  try {
    const profile = await userProfile(username);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for user tweets
app.get("/userTweets", async (req, res) => {
  const { username, maxTweets } = req.query;
  if (!username) {
    return res.status(400).send("Username is required");
  }
  try {
    const tweets = maxTweets ? Number(maxTweets) : 5; // Default to 5 tweets
    const userTweetData = await userTweets(username, tweets);
    res.json(userTweetData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for search tweets
app.get("/searchTweets", async (req, res) => {
  const { keyword, maxTweets, maxAgeDays } = req.query;
  if (!keyword) {
    return res.status(400).send("Keyword is required");
  }
  try {
    // Default values
    const tweets = maxTweets ? Number(maxTweets) : 25;
    const age = maxAgeDays ? Number(maxAgeDays) : 30;
    const searchResults = await searchTweets(keyword, tweets, age);
    res.json(searchResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// Command line function calls
async function runFromCommandLine() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Available functions:
  node app.js userProfile <username>
  node app.js userTweets <username> [maxTweets=5]
  node app.js searchTweets <keyword> [maxTweets=25] [maxAgeDays=30]

Examples:
  node app.js userProfile CryptoRank_VCs
  node app.js userTweets CryptoRank_VCs 10
  node app.js searchTweets testnet 15 30
    `);
    return;
  }

  const functionName = args[0];
  
  try {
    switch (functionName) {
      case 'userProfile':
        if (!args[1]) {
          console.error('Error: Username is required for userProfile');
          return;
        }
        console.log('Getting user profile for:', args[1]);
        const profile = await userProfile(args[1]);
        console.log(JSON.stringify(profile, null, 2));
        break;
        
      case 'userTweets':
        if (!args[1]) {
          console.error('Error: Username is required for userTweets');
          return;
        }
        const maxTweets = args[2] ? parseInt(args[2]) : 5;
        console.log(`Getting ${maxTweets} tweets for:`, args[1]);
        const tweets = await userTweets(args[1], maxTweets);
        console.log(JSON.stringify(tweets, null, 2));
        break;
        
      case 'searchTweets':
        if (!args[1]) {
          console.error('Error: Keyword is required for searchTweets');
          return;
        }
        const searchMaxTweets = args[2] ? parseInt(args[2]) : 25;
        const maxAgeDays = args[3] ? parseInt(args[3]) : 30;
        console.log(`Searching for "${args[1]}" - ${searchMaxTweets} tweets, ${maxAgeDays} days`);
        const searchResults = await searchTweets(args[1], searchMaxTweets, maxAgeDays);
        console.log(JSON.stringify(searchResults, null, 2));
        break;
        
      default:
        console.error(`Unknown function: ${functionName}`);
        console.log('Available functions: userProfile, userTweets, searchTweets');
        break;
    }
  } catch (error) {
    console.error('Error executing function:', error.message);
  }
  
  process.exit(0);
}

// Check if script is run with arguments
if (process.argv.length > 2) {
  runFromCommandLine();
}
