# Abide — Pray, Reflect, Grow

A lightweight, installable Progressive Web App for prayer check-ins and private journaling.

## Features
- Custom prayer schedule with add, edit, and remove.
- Daily prayer check-ins and a gentle prayer timer.
- Scripture of the day.
- Private journal stored in browser local storage.
- Prayer and journal history.
- Exportable JSON backup.
- Offline support after first visit (service worker).

## Deploy with GitHub Pages
1. Create a **public** repository named `abide` in your GitHub account.
2. Upload the six files in this project to the repository's **root** (not inside a folder): `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, and `icon.svg`. Include `README.md` too if desired.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then Save.
6. Wait for GitHub Pages to publish. The site will be at `https://YOUR-USERNAME.github.io/abide/`.

## Install on Android
Open the published HTTPS address in Chrome. Use the browser menu and choose **Install app** or **Add to Home screen**.

## Privacy and storage
Journal entries, schedule, and check-ins are stored in `localStorage` on the device/browser. They are not sent to a server. They do not automatically sync across devices. Clearing browser storage can erase them, so use **Settings → Download backup** regularly.

## Important limitations in v1
- The app does not send push notifications or background alarms.
- The Scripture set is a small curated set of short passages; verify translations and context in your preferred Bible.
- Local storage is not encrypted or protected by an app password. Anyone with access to the same browser profile may be able to access the data.
