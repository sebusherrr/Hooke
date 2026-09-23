# Abingdon Library — Frontend

`index.html` + `css/styles.css` + `js/app.js` (split out of the earlier single-file prototype),
plus `css/liquid-glass-button.css` / `js/components/liquid-glass-button.js` as an optional
extra component.

## Running it
Any static file server works — this has no build step:
```bash
npx serve .
# or: python3 -m http.server 8080
```

## Status — read before assuming this is wired to the backend
`js/app.js` still contains the prototype's localStorage-based demo logic (hardcoded accounts,
browser-only data) carried over from before the backend existed. It has NOT yet been rewired
to call the real API in `../backend`. That rewiring — replacing the ACCOUNTS map and db.* calls
with fetch() calls to /api/auth, /api/books, /api/loans etc. — is the next piece of work.
Treat this folder as still demo-mode until that's done.
