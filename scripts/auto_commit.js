/**
 * GitHub Daily Commit Automation
 * Zero-dependency Node.js script using built-in fetch (Node 18+)
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY; // format: "owner/repo"
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !repo) {
  console.error("Error: GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required.");
  process.exit(1);
}

const [owner, repoName] = repo.split('/');
const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'github-commit-bot',
  'Content-Type': 'application/json'
};

// Helper for GitHub API requests
async function githubApi(endpoint, options = {}) {
  const url = `https://api.github.com${endpoint}`;
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  
  if (response.status === 403) {
    const rateRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateRemaining === '0') {
      throw new Error("403_RATELIMIT: GitHub API rate limit exceeded. Try again in 1 hour.");
    }
  }
  
  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json()
  };
}

// Helper to send Telegram messages
async function sendTelegramAlert(message) {
  if (!telegramToken || !telegramChatId) return;
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: `⚠️ GitHub Commit Bot Alert:\n\n${message}\n\nCheck your GitHub Action logs for details.`,
        parse_mode: 'HTML'
      })
    });
    if (response.ok) {
      console.log("Telegram alert sent successfully.");
    } else {
      console.error("Failed to send Telegram alert:", await response.text());
    }
  } catch (err) {
    console.error("Error sending Telegram alert:", err.message);
  }
}

// Main commit execution function
async function run() {
  try {
    console.log(`Starting daily commit process for ${repo}...`);
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toTimeString().split(' ')[0];
    const timestamp = `${dateStr} ${timeStr}`;

    // 1. Commit to journal.md
    const journalPath = 'journal.md';
    const logEntry = `\n## ${timestamp}\nDaily log entry - staying consistent.\n`;
    let journalSha = null;
    let journalContent = '';

    console.log(`Checking if ${journalPath} exists...`);
    const journalRes = await githubApi(`/repos/${owner}/${repoName}/contents/${journalPath}`);
    
    if (journalRes.status === 200) {
      journalSha = journalRes.data.sha;
      // Decode existing content
      journalContent = Buffer.from(journalRes.data.content, 'base64').toString('utf8');
      console.log(`${journalPath} found. Updating content...`);
    } else {
      console.log(`${journalPath} not found. Creating new file...`);
    }

    const updatedJournalContent = journalContent + logEntry;
    const journalBody = {
      message: `daily update ${dateStr}`,
      content: Buffer.from(updatedJournalContent).toString('base64'),
    };
    if (journalSha) {
      journalBody.sha = journalSha;
    }

    console.log(`Pushing commit for ${journalPath}...`);
    const commitRes = await githubApi(`/repos/${owner}/${repoName}/contents/${journalPath}`, {
      method: 'PUT',
      body: JSON.stringify(journalBody)
    });
    console.log(`Successfully committed to ${journalPath}! SHA: ${commitRes.data.commit.sha}`);

    // 2. Update streak.json backup in the repo
    const streakPath = 'streak.json';
    let streakSha = null;
    let streakData = {
      streak: 0,
      last_commit_date: '',
      history: []
    };

    console.log(`Checking if ${streakPath} exists...`);
    const streakRes = await githubApi(`/repos/${owner}/${repoName}/contents/${streakPath}`);
    
    if (streakRes.status === 200) {
      streakSha = streakRes.data.sha;
      const rawStreak = Buffer.from(streakRes.data.content, 'base64').toString('utf8');
      try {
        streakData = JSON.parse(rawStreak);
      } catch (e) {
        console.warn("Failed to parse existing streak.json, resetting...", e.message);
      }
    }

    // Update streak logic
    const lastDate = streakData.last_commit_date;
    if (lastDate === dateStr) {
      // Already committed today, keep streak the same
      console.log("A commit was already recorded for today. Streak remains:", streakData.streak);
    } else {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastDate === yesterdayStr) {
        streakData.streak += 1;
        console.log("Streak extended! New streak:", streakData.streak);
      } else {
        streakData.streak = 1;
        console.log("Streak reset or started. New streak:", streakData.streak);
      }
      streakData.last_commit_date = dateStr;
    }

    streakData.history.push(dateStr);

    const streakBody = {
      message: `update streak.json ${dateStr}`,
      content: Buffer.from(JSON.stringify(streakData, null, 2)).toString('base64')
    };
    if (streakSha) {
      streakBody.sha = streakSha;
    }

    console.log(`Updating ${streakPath} backup in repository...`);
    await githubApi(`/repos/${owner}/${repoName}/contents/${streakPath}`, {
      method: 'PUT',
      body: JSON.stringify(streakBody)
    });
    console.log("Streak backup updated successfully!");

  } catch (error) {
    console.error("Automation Error:", error.message);
    // Send Telegram alert if configured
    await sendTelegramAlert(`❌ Daily Commit Automation failed!\n\n<b>Error:</b> ${error.message}`);
    process.exit(1);
  }
}

run();
