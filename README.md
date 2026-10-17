<div align="center">

# Pause 🌙

### A small, gentle space to breathe, play, reflect, and begin again.

**Pause** is a calm, local-first mental wellness web app for the moments when you need a little room to yourself.

[Explore the features](#-a-little-of-everything) · [Run it locally](#-run-it-on-your-computer) · [Publish with GitHub Pages](#-publish-with-github-pages)

</div>

---

## 🌿 A little of everything

Pause lets you choose what feels useful in the moment. There is no score, streak, or pressure to finish.

| Take a breath | Find a small distraction | Make space for your thoughts |
|---|---|---|
| Four gentle, locally generated soundscapes and silence | Fireflies, bubbles, fluid art, bubble wrap, five senses, and alphabet games | Optional mood check-ins and private reflections |
| Play only when you press the sound button; adjust volume or stop anytime | Game interactions are silent | Saved affirmations, including “I am worthy of being loved, exactly as I am.” |
| Reduce-motion setting | No timers or scores | Reading library, bookmarks, and therapy-note organizer |

## ✨ What makes Pause different

- **Your pace comes first.** Choose an activity, switch whenever you like, or simply leave the page open.
- **Gentle sound, on your terms.** Pick a soundscape, preview it, adjust the volume, mute it, or stop it. Sound begins only after you press Play.
- **Words you can return to.** Browse supportive reading, save affirmations, or write one in your own words.
- **A private-by-default design.** Saved reflections and notes stay in this browser on this device. There is no account or app server.
- **Simple to run.** No framework, build step, API key, or package installation is required.

## 💻 Run it on your computer

1. Download the project or clone your GitHub repository.
2. Open `index.html` in a modern browser.
3. Press **Play** in the sound player if you want background sound.

For more reliable browser storage, serve the folder using a local static server. For example, with Python installed:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000> (run the command from the project folder).

## 🗂️ Project files

```text
pause/
├── index.html                 # App entry point
├── README.md                  # This guide
├── assets/
│   ├── css/styles.css         # Layout, colors, and responsive styling
│   └── js/
│       ├── app.js             # Pages, navigation, and app interactions
│       ├── audio-player.js    # User-controlled soundscapes
│       ├── enhancements.js    # Reading and quality-of-life features
│       ├── games.js           # Quiet interactive activities
│       └── storage.js         # On-device saved data
└── data/
    ├── articles.js            # Reading library
    └── articles-extra.js      # Additional reflections
```

## 🚀 Publish with GitHub Pages

1. Create a new repository on GitHub. If you plan to publish this exact app as a project site, the repository name can be `pause`.
2. Open PowerShell in the `pause` folder (the folder containing `index.html`).
3. Run these commands, replacing the URL with your repository's HTTPS or SSH URL:

```powershell
git init
git add index.html README.md assets data
git commit -m "Add Pause wellness app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pause.git
git push -u origin main
```

4. On GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.
6. When GitHub Pages finishes publishing, open the URL shown on that Pages settings screen.

### What should I upload?

Upload the app's `index.html`, `assets/` folder, `data/` folder, and `README.md`. Keep the folder structure intact. You do not need to upload anything from the parent Codex workspace, browser data, or your private reflections.

## 🔐 Privacy notes

Saved mood entries, notes, reading bookmarks, and affirmations are kept in browser storage on this device. They are not sent to a Pause server, and they will not automatically move to another browser or device. Clearing browser data can delete them. Browser storage is not an encrypted backup.

The app does load Bootstrap and fonts from public CDNs for styling. Your saved reflections are not included in those requests. The soundscapes are generated locally by the browser with the Web Audio API; there are no bundled audio files, and game interactions have no sound effects.

## 🤍 A gentle note

Pause is a self-reflection and wellness tool. It does not diagnose, provide crisis care, or replace a qualified mental-health professional. If you are in immediate danger in India, call **112**. For mental-health support, Tele-MANAS can be reached at **14416** or **1800-89-14416**. Service details may change; check the official [112](https://112.gov.in/) and [Tele-MANAS](https://dghs.mohfw.gov.in/national-mental-health-programme.php) pages for current information.

---

<div align="center">

Made to make a little room for yourself. 🌙

</div>
