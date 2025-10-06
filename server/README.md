
# Waste Classifier (GitHub Pages + Node Backend)

- **Frontend**: `/frontend/index.html` → Host on GitHub Pages
- **Backend**: `/server/server.js` → Deploy to Render/Railway/Fly (Node 18+)
- Uses OpenAI **Responses API** with `text.format` JSON schema.
- Backend already adds decision logic: ≥75% → 「就是（分類）」; 45~75% → 「較可能」; 低於 45% → 「不確定」.

## Deploy (Render)
1. New **Web Service** → connect this repo; **Root Directory** = `server`.
2. Build: `npm install` ; Start: `npm start` ; Node 18+.
3. Env var: `OPENAI_API_KEY = sk-...`.
4. (Optional) In `server/server.js`, replace `app.use(cors())` with:
   ```js
   app.use(cors({ origin: "https://<USER>.github.io/<REPO>" }));
   ```
5. After deploy, you get `https://xxx.onrender.com`.

## GitHub Pages
1. Settings → Pages → Source: *Deploy from a branch*, Branch `main`, **Folder** `/frontend`.
2. Edit `/frontend/index.html` and set:
   ```js
   const API_URL = "https://xxx.onrender.com/api/classify";
   ```
3. Visit `https://<USER>.github.io/<REPO>/` to use it.

## Local dev
```bash
# backend
cd server
npm i
OPENAI_API_KEY=sk-xxx node server.js

# frontend: open frontend/index.html in browser,
# and set API_URL to "http://localhost:3000/api/classify"
```
