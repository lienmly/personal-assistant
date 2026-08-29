# Putting Clan Centurio on your phone

You don't have to remember the Railway URL any more. Open it once, add it to your home
screen, and after that it's an icon next to everything else — it opens straight to **Today**,
with no address bar.

You only do this once per device.

---

## iPhone / iPad

Safari only. Chrome on iOS can't install web apps.

1. Open the app in **Safari** and sign in.
2. Tap the **Share** button (the square with the arrow, at the bottom).
3. Scroll down and tap **Add to Home Screen**.
4. It'll be called **Centurio** — tap **Add**.

The icon appears on your home screen. Tapping it opens the app full screen.

**Your login sticks.** An installed app gets its own cookie jar, so the first launch may
ask you to sign in with Google again. That's the last time.

## Android

1. Open the app in **Chrome** and sign in.
2. Chrome usually offers **Install app** in a banner at the bottom. Tap it.
3. If it doesn't: menu (⋮) → **Add to Home screen** → **Install**.

**Long-press the icon** and you get shortcuts straight to the Calendar and Social Media.
(The Hunt Board's shortcut came off with its nav entry on 28 August — a shortcut to a
screen with no way back to it is a dead end on a phone.)

## Desktop (Mac / Windows)

Chrome or Edge, with the app open: there's an **install icon** in the address bar (a screen
with a down arrow), or use menu → **Cast, save and share** → **Install page as app**. It gets
its own window and its own dock/taskbar icon.

---

## What changes once it's installed

- **No address bar, no tabs.** Just the app.
- **It opens on Today**, not on a redirect.
- **The status bar matches the theme** — light in the day, dark after sunset, same as the
  rest of the app.
- **The home indicator stops overlapping the tab bar** on an iPhone.

## What doesn't change

**It still needs signal.** Everything on every screen comes from the database — your tasks,
the journal, today's content — so there is nothing useful to show without a connection. If
you open it with no signal you get a "No connection, kupo" card and a Try again button,
rather than the browser's error page.

This is deliberate. The alternative is showing you a cached copy of yesterday, which looks
like it's working and isn't — and you'd tick things off a list that no longer exists.

## If the icon opens Safari with an address bar

That's an old iOS (before 17) that didn't get the install right. Delete the icon, make sure
you're on the latest iOS, and add it again.

## If nothing offers to install

- You must be on **https** — the live Railway URL, not a `localhost` address.
- On iOS it has to be **Safari**.
- Try a hard reload first; the browser needs to have fetched the manifest at least once.

## Updating

There's nothing to update. The app is fetched fresh every time you open it, so whatever's
deployed is what you get — no App Store, no waiting for review, no "update available".

---

## One thing worth doing separately

The URL itself is still the long Railway one, which matters whenever you install on a **new**
device or send yourself a link. A custom domain fixes that permanently:

1. Railway → the web service → **Settings** → **Networking** → **Custom Domain**.
2. Add something short you'll actually remember.
3. Add the CNAME record Railway gives you at your DNS provider.
4. Update **`AUTH_URL`** in the Railway variables to the new address, and add the new
   callback URL in the Google Cloud console — otherwise sign-in breaks.

Step 4 is the one that's easy to forget and the one that takes the app down.
