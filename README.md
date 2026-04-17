# Noach's Switch 2 Tracker 🎮

## Deploy to Netlify

### Step 1 — Upload to GitHub
1. Create a free account at github.com
2. Create a new repository called "noach-switch-tracker"
3. Upload all these files to it

### Step 2 — Deploy on Netlify
1. Go to netlify.com, sign in with GitHub
2. Click "Add new site" → "Import an existing project"
3. Connect to your GitHub repo
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
5. Click Deploy!

### Step 3 — Set up accounts
1. Open the deployed app
2. **Noach signs up first** with his email/password
3. After signing up, open browser DevTools (F12) → Console
4. You'll see "Your UID: abc123xyz" — copy that
5. **You (Sarah) sign up** with your email/password
6. After signing up, check console for your own UID

### Step 4 — Configure parent access
1. Open `src/App.js`
2. Find line: `const PARENT_UID = "";`
3. Paste YOUR UID there: `const PARENT_UID = "your-uid-here";`
4. Also find `const NOACH_UID = "";` in ParentLiveView
5. Save and redeploy on Netlify (it auto-deploys from GitHub)

### Step 5 — Connect parent to Noach's data
1. Sign in as parent
2. You'll be asked for Noach's UID — paste it in
3. It saves automatically — you'll see live updates!

## How it works
- Noach logs in on his phone → sees his full tracker
- You log in on your phone → see live parent dashboard
- All data syncs through Firebase Firestore in real time
- Badge album, streaks, bonuses all live forever in the cloud
