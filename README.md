## Naukri Login & Profile Automation

This project contains a Playwright (Node.js) automation script that:

- Logs into your Naukri Jobseeker account using stable, predictable browser settings.
- Saves browser storage state locally so subsequent runs can reuse the same logged‑in session.
- Opens your profile page and toggles a preferred location inside **Career preferences** on every run (add on one run, remove on the next).

The goal is **reliability and predictability**, not aggressive anti‑bot fingerprinting. The script avoids rotating proxies, user agents, or heavy “stealth” tricks so that your activity looks like a consistent, legitimate user.

---

## 1. Prerequisites

- Node.js 18+ installed
- NPM
- A Naukri Jobseeker account (email + password)

Install dependencies:

```bash
npm install
```

---

## 2. Environment Configuration

Use `example.env` as a template:

```bash
cp example.env .env
```

Edit `.env` and set at least:

- `USER_EMAIL` – your Naukri login email
- `USER_PASSWORD` – your Naukri password
- `NAUKRI_TOGGLE_CITY` – (optional) the city to toggle in Career preferences; defaults to `Kolkata` if not set

Example:

```dotenv
USER_EMAIL=youremail@job.com
USER_PASSWORD=your_password
NAUKRI_TOGGLE_CITY=Kolkata
```

> Note: the other entries in `example.env` (CV uploads, proxies, Telegram notifications) are optional—fill them only if you need those features.

### Telegram Notifications (Optional)

If you want every automation run to report its status to Telegram, follow these steps:

1. **Create your bot** – Talk to [`@BotFather`](https://t.me/BotFather), run `/newbot`, and copy the `TELEGRAM_BOT_TOKEN` it returns.
2. **Invite the bot to your chat** – Add it to your private chat or channel where you want the updates delivered. For channels, make the bot an admin so it can post.
3. **Find your chat ID** – Either forward a message to [`@userinfobot`](https://t.me/userinfobot) or send a message in the channel and visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` to read the `chat.id` value (channel IDs start with `-100`).
4. **Configure `.env`** – Add both values:

	```dotenv
	TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
	TELEGRAM_CHAT_ID=-1001234567890
	TELEGRAM_ATTACH_EXECUTION_LOG=false
	```

That’s it. Successful runs send a ✅ summary, failures send a ❌ summary with the error message and stack trace. Set `TELEGRAM_ATTACH_EXECUTION_LOG=true` if you also want the daily execution log file attached to each message. If any Telegram env var is missing, the notifier silently skips sending so you can leave them blank when Telegram isn’t needed.

---

## 3. Storage State & Sessions

The script uses Playwright storage state to avoid logging in on every run.

- Storage state file: `storage-states/naukri-login.json`
- This directory is **ignored by Git** (see `.gitignore`).

Behavior:

1. **First run**:
	- Script logs in with `USER_EMAIL`/`USER_PASSWORD`.
	- On successful login, it saves storage state to `storage-states/naukri-login.json`.
2. **Subsequent runs**:
	- Script loads that storage state when creating the browser context.
	- If the session is still valid, it skips the login flow and goes straight to profile automation.
	- If Naukri has expired/invalidated the session, the script performs a fresh login and overwrites the storage state.

If you ever want to force a fresh login, simply delete the JSON file:

```bash
rm -f storage-states/naukri-login.json
```

On Windows PowerShell:

```powershell
Remove-Item storage-states/naukri-login.json -ErrorAction Ignore
```

---

## 4. What the Script Does

Main script: `scripts/naukri-automation.js`

High‑level flow:

1. Load `.env` configuration.
2. Create a Chromium browser instance with **stable** desktop Chrome settings (no proxy/UA rotation).
3. If a storage state exists, attempt to reuse it and go to Naukri home.
4. If the session is not valid, perform a full login:
	- Open `https://www.naukri.com/`.
	- Click the **Register** button.
	- On the register page, click the **Login** link.
	- Fill email and password and submit.
	- Confirm navigation to the logged‑in homepage and save storage state.
5. With a valid session, navigate to **View profile → Your career preferences**.
6. In the Career preferences modal, **toggle the preferred location**:
	- If a chip with `NAUKRI_TOGGLE_CITY` already exists, remove it.
	- If it does not exist, type the city name, select it from suggestions, and ensure it appears as a chip.
7. Save the preferences and close the browser.

All interactions use explicit waits on visible elements so that the script does not click or type before the UI is ready.

---

## 5. Running the Automation

From the project root:

```bash
npm run automate
```

This executes:

```bash
node scripts/naukri-automation.js
```

By default, the script runs headful (visible browser). To run headless, set:

```dotenv
HEADLESS=true
```

in your `.env` and rerun `npm run automate`.


## 6. Automated Scheduling with PM2

If you want this automation to run automatically at **09:30** and **11:30** IST, Monday through Friday, without touching system cron, use the bundled PM2 scheduler:

1. **Install dependencies (once)**
	```bash
	npm install
	npm install -g pm2
	```
2. **Prepare environment**
	```bash
	cp example.env .env
	nano .env # fill credentials, NAUKRI_TOGGLE_CITY, HEADLESS, etc.
	```
3. **Start the scheduler**
	```bash
	npm run pm2:start
	pm2 save
	pm2 startup systemd
	```
	   - `scripts/scheduler.js` registers two cron-style jobs using `node-cron` with `Asia/Kolkata` timezone baked in.
   - Each job spawns `node scripts/naukri-automation.js` so the original script remains unchanged.
   - `ecosystem.config.js` keeps the scheduler alive and restarts it if it crashes.
4. **Monitor**
	```bash
	pm2 list
	pm2 logs scheduler
	```

> Timezone tip: the scheduler already targets `Asia/Kolkata`, so the jobs fire at 09:30/11:30 IST regardless of the VPS timezone. Setting the server timezone to IST is optional but can make log timestamps easier to reason about.

To stop or restart the automation daemon:

```bash
pm2 restart scheduler
pm2 stop scheduler
pm2 delete scheduler
```

---

## 7. VPS Setup (Ubuntu + PM2 + Xvfb)

For a headless Ubuntu VPS where Chromium needs a virtual display, follow these steps:

1. **Install system dependencies**
	```bash
	sudo apt update
	sudo apt install -y git curl xvfb
	curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
	sudo apt install -y nodejs
	sudo npm install -g pm2
	```
2. **Clone and configure the project**
	```bash
	git clone https://github.com/imshaiknasir/automate-it-to-get-it.git
	cd automate-it-to-get-it
	cp example.env .env
	nano .env   # fill USER_EMAIL, USER_PASSWORD, NAUKRI_TOGGLE_CITY, HEADLESS, etc.
	npm install
	```
3. **Run the scheduler with PM2**
	```bash
	pm2 delete scheduler 2>/dev/null || true
	pm2 start ecosystem.config.js
	pm2 save
	pm2 startup systemd
	```
	- The scheduler automatically wraps each automation run with `xvfb-run` so Chromium gets a virtual display.
	- PM2 keeps the scheduler alive and restarts it on reboot (after `pm2 startup systemd` and `pm2 save`).
4. **Manual one-off run (optional)**
	```bash
	xvfb-run -a npm run automate
	```
	Useful for testing changes without touching the PM2-managed daemon.

Logs:

```bash
pm2 logs scheduler
pm2 list
```

Remove the daemon if needed:

```bash
pm2 delete scheduler
```

---

## 8. Customizing Behavior

You can adjust behavior without touching the code by changing env vars:

- **Login credentials**: `USER_EMAIL`, `USER_PASSWORD`
- **Preferred city toggle**: `NAUKRI_TOGGLE_CITY`
- **Headless mode**: `HEADLESS=true` or leave unset/false for visible browser

If you want to temporarily disable the location toggle but still reuse the login session, you can comment out the call in `scripts/naukri-automation.js`:

```js
// await openProfileAndTogglePreferredLocation(page, PREFERRED_LOCATION);
```

and re‑enable it later when needed.

---

## 9. Notes & Limitations

- The script assumes Naukri’s DOM structure is similar to the selectors used (login fields, profile link, career preferences modal). If Naukri changes their UI, selectors may need updates.
- No proxy/fingerprint randomization is intentionally used; the browser profile is meant to stay stable over time.
- Storage state is local only and should **not** be committed to Git.

If you notice selectors breaking after a Naukri UI change, update `scripts/naukri-automation.js` with the new DOM and rerun `npm run automate`.

---

## 10. Logging & Video Recording

The automation now includes comprehensive logging and video recording for monitoring and debugging:

### Features

- ✅ **Structured JSON logs** with daily rotation (14-day retention)
- ✅ **Video recording** for every automation run (not just failures)
- ✅ **Automated weekly cleanup** of old videos (7-day retention)
- ✅ **Execution tracking** with unique IDs and duration metrics
- ✅ **PM2 log management** with custom log paths

### Quick Reference

**Check today's logs:**
```bash
# View combined logs
cat logs/combined-$(date +%Y-%m-%d).log

# View execution summaries only
cat logs/execution-$(date +%Y-%m-%d).log

# View errors only
cat logs/error-$(date +%Y-%m-%d).log
```

**PM2 logs:**
```bash
# Live tail
pm2 logs scheduler

# Last 100 lines
pm2 logs scheduler --lines 100
```

**Videos location:**
- Stored in: `videos/`
- Format: MP4 (automatically converted from WebM for Telegram streaming compatibility)
- Cleaned up: Every Monday at 2 AM IST (videos older than 7 days)
- Manual cleanup: `node scripts/utils/cleanup-videos.js`

### Configuration

Set retention periods in `.env`:

```bash
LOG_RETENTION_DAYS=14      # How long to keep log files
VIDEO_RETENTION_DAYS=7     # How long to keep video recordings
```

### Full Documentation

See **[`docs/LOGGING_SETUP.md`](docs/LOGGING_SETUP.md)** for complete details on:
- Log format and structure
- Video recording configuration
- PM2 log rotation setup
- Troubleshooting and log analysis
- Storage management

---

## 11. Deep-Dive Documentation

Need the full architecture map for PM2, the scheduler, automation script, and storage state? Check `docs/automation-stack-guide.md` for:

- Mermaid mindmap of the entire stack
- Component responsibilities and flow diagrams
- Storage-state lifecycle, scheduler matrix, and PM2 cheat sheet
- First-time setup checklist for new contributors

Use that guide as the onboarding reference when sharing this project.
