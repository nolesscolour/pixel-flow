# Pixel Flow

A generative pixel visualizer with interactive flow fields.

## Setup (run once)

Open this folder in VS Code, then open the Terminal (View → Terminal) and run:

```
npm install
```

Wait for it to finish (1–2 minutes).

## Run locally

```
npm run dev
```

Open http://localhost:3000 in your browser. You'll see the visualizer live.

Press `Ctrl+C` in the Terminal to stop.

## Deploy to Vercel

1. Create a new repo on GitHub (e.g. `pixel-flow`).
2. In the Terminal, run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/pixel-flow.git
   git push -u origin main
   ```
3. Go to vercel.com → **Add New Project** → import the repo.
4. Click **Deploy**. Done.

Every future push to `main` will auto-deploy.
