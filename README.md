# 🚀 GitHub Consistency Bot

A premium, fully client-side web application and cloud automation suite designed to help you maintain your daily GitHub contribution streak. With a stunning modern UI, interactive calendar, and one-click cloud setup, you can keep your consistency intact from any device.

---

## 🌟 Key Features

### 1. Interactive Contribution Calendar
* **Visual Grid**: A custom 15x2 calendar grid displaying your last 30 days of activity.
* **Clickable Squares**: Click on any square to open a **Detail Panel** showing exactly which commits (message, timestamp, type, and repository) were made using the app on that day.
* **Smart History Sync**: Uses the **GitHub GraphQL API v4** to fetch your official contribution calendar (including public, private, and organization commits) directly from your GitHub profile.
* **Streak Calculator**: Instantly calculates your consecutive day streak from your live profile data.

### 2. Manual Commit Dashboard
* Trigger custom commits on-demand directly from the web app.
* **Commit Types**:
  * **Dev Journal (`journal.md`)**: Appends a dated, readable entry to a markdown file.
  * **README Update (`README.md`)**: Appends a hidden HTML comment containing a timestamp, updating the file without changing how your README looks to profile visitors.
  * **Code Comment (source files)**: Appends a timestamped code comment to a JavaScript file, simulating active development.
  * **Random Selection (Recommended)**: Randomly selects one of the three types above for each commit, making your commit history look organic and varied.
* **Commit Count**: Choose to trigger 1, 2, or 3 commits at once.

### 3. One-Click Cloud Setup
* **Zero Manual Effort**: Input your token, select your repository, and click **🚀 One-Click Cloud Setup**.
* The app will automatically talk to the GitHub API, create the required folder structure (`.github/workflows/` and `scripts/`), and write the automation files directly into your repository.
* GitHub's official cloud servers (GitHub Actions) will then run the script every day at your preferred time for free.

### 4. Daily Commit Reminders (Notifications)
* Uses the browser's native **Notification API** and background **Service Workers**.
* Sends a push reminder to your phone or laptop at **8:00 PM** if you haven't made a commit yet today, ensuring you never break a streak.

### 5. Secure Local Storage & Backups
* **IndexedDB**: Your GitHub Personal Access Token is stored securely in your browser's local database.
* **`streak.json` Cloud Backup**: Every time you commit, the app backs up your streak count, last commit date, and history directly in your repository. Opening the app on a new device or phone will instantly restore your entire history from this backup.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, Vanilla CSS3 (glassmorphism, CSS grid/flexbox, custom responsive variables), Vanilla JavaScript (ES6+).
* **APIs**:
  * **GitHub REST API v3**: For writing files, creating commits, and repository management.
  * **GitHub GraphQL API v4**: For fetching official contribution calendars directly from the profile.
* **Service Workers**: For background push notifications, caching, and background tasks.
* **Database**: **IndexedDB**: For high-capacity, secure local client-side storage.
* **CI/CD**: **GitHub Actions**: For scheduled cloud automation.

---

## 🚀 Getting Started & Setup

### Prerequisites
To authorize the bot to push commits to your repository, you need a **GitHub Personal Access Token (classic)**:
1. Log in to [GitHub.com](https://github.com).
2. Go to **Settings** > **Developer Settings** > **Personal Access Tokens** > **Tokens (classic)**.
3. Click **Generate new token (classic)**.
4. Set a name (e.g., `Commit Bot`) and select the **`repo`** scope checkbox (this is required to write commits).
5. Click **Generate token** and copy it immediately.

---

### Method 1: One-Click Cloud Setup (Recommended)
1. Open the web app (`index.html`).
2. Paste your token into the **Authentication** box. The app will automatically verify it and load your profile.
3. Go to the **Automation Settings** tab.
4. Turn on **Full Auto Mode**.
5. Select the repository you want to use for automation from the dropdown.
6. Click **`🚀 One-Click Cloud Setup (Auto-Configure)`**.
7. The app will configure everything in your repository. You are all set! GitHub Actions will now make a daily commit every day at your preferred time.

---

### Method 2: Manual Cloud Setup
If you prefer to configure it manually, you can download the files from the **Automation Settings** tab and place them in your repository:

1. Create a folder named `.github/workflows/` in the root of your repository, and place **`daily-commit.yml`** inside it:
   ```yaml
   name: Daily Commit Bot

   on:
     schedule:
       - cron: '0 9 * * *'       # Runs every day at 9:00 AM UTC
     workflow_dispatch:          # Allows manual triggering from the Actions tab

   jobs:
     commit:
       runs-on: ubuntu-latest
       permissions:
         contents: write

       steps:
         - name: Checkout repository
           uses: actions/checkout@v3
           with:
             persist-credentials: true

         - name: Set up Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'

         - name: Run Auto Commit Script
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             GITHUB_REPOSITORY: ${{ github.repository }}
           run: node scripts/auto_commit.js
   ```

2. Create a folder named `scripts/` in the root of your repository, and place **`auto_commit.js`** inside it (download it from the settings tab).
3. Push these files to your repository.

---

## 🔍 How it Works Under the Hood

### Why does 1 commit show as 2 on GitHub?
To keep your streak data synchronized across all your devices (phone, laptop, tablet), the app maintains a **`streak.json`** file in your repository. 

Whenever you trigger a commit:
1. The app commits your selected file change (e.g., appending a line to `journal.md`).
2. The app immediately makes a second commit to update `streak.json` with your updated streak count and history.

Since the GitHub API only allows modifying **one file per commit**, this results in **2 commits** on GitHub. Both are real, valid commits and will be counted on your GitHub graph.

### ⚠️ Note on the 30-Day Limit
The calendar grid on the web app's dashboard displays a rolling window of the **last 30 days**. Commits older than 30 days will rotate off this visual grid, but they are **never lost**—they remain permanently in your GitHub repository history and your `streak.json` backup!

---

## 🔒 Security & Privacy

* **100% Serverless**: There is no backend server. All operations happen directly in your browser.
* **No Data Collection**: Your Personal Access Token is stored **only in your local browser** (IndexedDB). It is never sent to any third-party server—only directly to `api.github.com`.
* **GitHub Actions Security**: The cloud automation script uses a temporary `secrets.GITHUB_TOKEN` provided by GitHub itself. This token is short-lived, sandboxed, and expires immediately after the action completes.

---

## ⚠️ Ethical Usage Warning
This bot is designed as a safety net or emergency backup for times when you cannot access your laptop (e.g., during travel, illness, or urgent situations) to help you maintain your daily consistency. 

It is not intended to automate your entire GitHub presence or falsify your skills. Use it responsibly to bridge occasional gaps, not to replace genuine coding activity.
