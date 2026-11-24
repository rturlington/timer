# 🦖 Tolliver's Timer

A big, bright, kid-friendly countdown timer you can cast to your TV with a Chromecast.

- A colorful "pie" that shrinks (green → yellow → orange → pink) so little ones can *see* time running out
- Pick a buddy (🦖 🐶 🦄 🚀 …), a preset (1, 2, 5, 10, 15, 20 min) or any length up to 2 hours
- Name the activity ("Brush teeth!") and it shows on the TV
- Cheery messages along the way, and confetti + a "ta-da!" fanfare when time's up
- Your phone/laptop is the remote: Go, Pause, Reset, change things while casting

## Running it

It's a plain static website with no build step. Serve the folder from anywhere:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in **Google Chrome** on a computer that's on the
same Wi-Fi as your Chromecast. (GitHub Pages or any HTTPS host works too.)

## Casting to the TV

1. Pick a time and a buddy.
2. Press **📡 Cast to TV** and choose your Chromecast.
3. The TV shows the big timer; the page you're on becomes the remote. Press **▶️ Go!**

This uses Chrome's built-in Presentation API, so there's nothing to register. Keep the
remote tab open while the timer runs (Chrome renders the TV screen and streams it).

**Fallback:** press **🖥️ Open big-screen window**, then use Chrome's ⋮ menu → **Cast…** →
*Cast tab* on that window. It stays in sync with the remote automatically.

### Optional: native Chromecast receiver

If you want the Chromecast to run the timer itself (so your laptop can sleep, and phones
can cast from Chrome on Android), register a Custom Web Receiver:

1. Host this folder on HTTPS (e.g. GitHub Pages).
2. Go to the [Google Cast SDK Developer Console](https://cast.google.com/publish)
   ($5 one-time fee), add a **Custom Receiver** with the URL of your hosted `tv.html`.
3. Put the Application ID in `js/config.js` as `CAST_APP_ID`.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `js/controller.js` | The remote control |
| `tv.html`, `js/receiver.js` | The big TV screen |
| `js/face.js` | The timer face, sounds, confetti (shared) |
| `js/config.js` | Optional Cast app id |
| `css/style.css` | Sky, clouds, grass and bouncy letters |
