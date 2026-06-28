/**
 * GitHub Daily Commit Bot - Service Worker
 * Handles background notifications and IndexedDB data access.
 */

const CACHE_NAME = 'github-commit-bot-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/README.md',
  '/journal.md'
];

// Install Service Worker and cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch handler for offline capability
self.addEventListener('fetch', (event) => {
  // Only handle standard HTTP/HTTPS requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback or offline support
      });
    })
  );
});

// IndexedDB Helper Functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CommitBotDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getSetting(key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

function setSetting(key, value) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico', // Fallback if no icon
      badge: '/favicon.ico',
      tag: 'commit-reminder',
      requireInteraction: true
    });
  }

  if (data.type === 'CHECK_AUTO_COMMIT') {
    try {
      const autoMode = await getSetting('auto_mode');
      if (!autoMode) return;

      const token = await getSetting('token');
      const repo = await getSetting('auto_repo');
      const commitType = await getSetting('auto_commit_type') || 'random';
      const lastCommitDate = await getSetting('last_commit_date');

      const todayStr = new Date().toISOString().split('T')[0];
      if (lastCommitDate === todayStr) {
        console.log('[SW] Auto commit already done today.');
        return;
      }

      console.log('[SW] Background Auto Commit triggered...');
      await performAutoCommit(token, repo, commitType, todayStr);
    } catch (err) {
      console.error('[SW] Background Auto Commit failed:', err.message);
    }
  }
});

// Perform commit via GitHub API from the Service Worker
async function performAutoCommit(token, repo, commitType, todayStr) {
  if (!token || !repo) return;
  const [owner, repoName] = repo.split('/');
  const timestamp = `${todayStr} ${new Date().toTimeString().split(' ')[0]}`;
  
  let path = 'journal.md';
  let message = `auto daily journal ${todayStr}`;
  let contentToAppend = `\n## ${timestamp}\nAuto log: Stayed consistent. Building every day.\n`;

  if (commitType === 'readme') {
    path = 'README.md';
    message = `auto daily readme update ${todayStr}`;
    contentToAppend = `\n<!-- Last active: ${timestamp} -->\n`;
  } else if (commitType === 'comment') {
    path = 'scripts/auto_commit.js'; // Commit comment to the script or another file
    message = `auto daily comment ${todayStr}`;
    contentToAppend = `\n// Active: ${timestamp}\n`;
  }

  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'github-commit-bot'
  };

  try {
    // 1. Get file content/SHA
    const getRes = await fetch(url, { headers });
    let sha = null;
    let currentContent = '';

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      // Decode Base64 using atob (standard in Worker environment)
      currentContent = atob(fileData.content.replace(/\s/g, ''));
    }

    const updatedContent = currentContent + contentToAppend;
    // Encode Base64 using btoa
    const base64Content = btoa(unescape(encodeURIComponent(updatedContent)));

    // 2. Put commit
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        content: base64Content,
        sha: sha || undefined
      })
    });

    if (putRes.ok) {
      console.log('[SW] Auto commit successful.');
      await setSetting('last_commit_date', todayStr);
      
      // Update streak
      let streak = (await getSetting('streak')) || 0;
      let lastCommit = await getSetting('last_commit_date');
      // Simple local streak logic
      streak = streak + 1;
      await setSetting('streak', streak);

      // Notify user of success
      self.registration.showNotification('Auto Commit Successful! ✅', {
        body: `Committed to ${repo} (${commitType}) at ${new Date().toLocaleTimeString()}`,
        tag: 'auto-commit-success'
      });
    } else {
      const errText = await putRes.text();
      throw new Error(`Commit failed (${putRes.status}): ${errText}`);
    }
  } catch (err) {
    console.error('[SW] Commit error:', err.message);
    self.registration.showNotification('Auto Commit Failed ⚠️', {
      body: err.message,
      tag: 'auto-commit-fail'
    });
  }
}

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
