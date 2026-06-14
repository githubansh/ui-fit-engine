# FitEngine Frontend

React + Vite frontend for the FitEngine exercise recommendation prototype.

## Local Run

```powershell
npm install
npm run dev
```

The app expects the backend at `http://localhost:8000` by default.

To point to a deployed backend:

```powershell
$env:VITE_API_BASE_URL = "https://your-backend-url"
npm run dev
```

## Production Build

```powershell
npm run build
```

## Deploy

Set this environment variable in Vercel or Netlify:

```text
VITE_API_BASE_URL=https://your-backend-url
```

## Prototype Limitation

FitEngine stores the active `userId` and `planId` in browser localStorage. Use
one browser tab during demos; multi-tab profile or plan edits are not
synchronized in real time.
