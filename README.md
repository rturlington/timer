# 🦖 Tolliver's Timer

A big, bright, kid-friendly countdown timer you can cast to your TV with a Chromecast.

- A colorful "pie" that shrinks (green → yellow → orange → pink) so little ones can *see* time running out
- Pick a buddy (🦖 🐶 🦄 🚀 …), a preset (1, 2, 5, 10, 15, 20 min) or any length up to 2 hours
- Name the activity ("Brush teeth!") and it shows on the TV
- Cheery messages along the way, and confetti + a "ta-da!" fanfare when time's up
- Your phone/laptop is the remote: Go, Pause, Reset, change things while casting

## Using it from an Android phone

A phone can't cast an ordinary web page, so the TV screen (`tv.html`) is registered
with Google as a Cast "receiver app". You only do this once.

### 1. Put it on the web (free, GitHub Pages)

1. On GitHub, open **rturlington/timer → Settings → General → Danger Zone →
   Change visibility → Public** (your Chromecast must be able to load the page
   without logging in).
2. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, branch
   **`ccr-afc3f703-8j0dge`** (or `main` once merged), folder **/ (root)** → **Save**.
3. After a minute it's live at **https://rturlington.github.io/timer/**.
   Check that **https://rturlington.github.io/timer/tv.html** shows the timer.

### 2. Register the TV screen with Google ($5 one time)

1. Go to the [Google Cast SDK Developer Console](https://cast.google.com/publish),
   sign in and pay the one-time $5 registration fee.
2. **Add New Application → Custom Receiver**.
   - Name: `Tolliver's Timer`
   - Receiver Application URL: `https://rturlington.github.io/timer/tv.html`
3. Save. Copy the **Application ID** (8 characters, like `A1B2C3D4`).
4. Make it usable on your Chromecast — either:
   - click **Publish** on the app (easiest; anyone who knows the ID could launch it,
     which is harmless), **or**
   - under **Cast Receiver Devices → Add New Device**, enter your Chromecast's serial
     number, then reboot the Chromecast. This can take ~15 minutes to kick in.

### 3. On your phone

1. Open **https://rturlington.github.io/timer/** in **Chrome** on your Android phone
   (same Wi-Fi as the Chromecast).
2. The App ID (`2F2D05DB`) is already built into `js/config.js`, so there's nothing to paste.
3. Tap **📡 Cast to TV**, pick your Chromecast, then **▶️ Go!**
4. Tip: Chrome ⋮ menu → **Add to Home screen** gives you a Tolliver's Timer app icon.

The timer runs on the Chromecast itself, so your phone can go to sleep. If you reopen
the page later it reconnects and picks up the running timer.

> iPhone: Apple's browsers can't cast to a Chromecast, so this needs an Android phone
> (or Chrome on a computer).

## Using it from a computer (no setup needed)

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000** in **Chrome**, press **📡 Cast to TV**, pick the
Chromecast. Without an App ID this uses Chrome's built-in Presentation API — keep the tab
open while the timer runs. Fallback: **🖥️ Open big-screen window**, then Chrome ⋮ →
**Cast…** → *Cast tab*.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `js/controller.js` | The remote control |
| `tv.html`, `js/receiver.js` | The big TV screen |
| `js/face.js` | The timer face, sounds, confetti (shared) |
| `js/config.js` | Optional built-in Cast App ID (or set it on the phone) |
| `manifest.webmanifest`, `icons/` | Add-to-home-screen app icon |
| `css/style.css` | Sky, clouds, grass and bouncy letters |
