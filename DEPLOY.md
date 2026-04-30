# Putting Home Hub Online (GitHub Pages)

This lets the app live at a permanent URL so you can share it with anyone — no file attachments needed.

---

## One-Time Setup

**Step 1 — Make sure Git is installed**
Download from https://git-scm.com if you don't have it.

**Step 2 — Your GitHub repo**
You already have one at: `https://github.com/msindall/HomeHub`

**Step 3 — Enable GitHub Pages**
1. Go to your repo on github.com
2. Click **Settings** (top menu) → then **Pages** (left sidebar)
3. Under *Source*, choose **Deploy from a branch**
4. Branch: `main`, Folder: `/ (root)` → click **Save**
5. Wait about 60 seconds — your app is live at:
   `https://msindall.github.io/HomeHub/`

---

## Deploying an Update

Every time you build a new version, run this from the project folder:

```
python deploy_github.py --push
```

That's it. It will:
- Find the latest `App_VX_Y.html` you just built
- Update `index.html` to redirect to it
- Commit and push both files to GitHub
- The live URL updates within a minute

---

## Manual Steps (if --push doesn't work)

If the automatic push fails, open a terminal in the project folder and run:

```
git add App_V6_30.html index.html
git commit -m "Deploy Home Hub v6.30"
git push
```

---

## Sharing the App

Once live, share the URL: `https://msindall.github.io/HomeHub/`

Or use the **🔗 Share** button inside the app to get a link that pre-fills the Setup Wizard for whoever opens it.
