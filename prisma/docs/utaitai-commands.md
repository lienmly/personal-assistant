The commands that are easy to forget between sessions, with the reason each one
is shaped the way it is. Not a list of everything — `npm run dev` does not need
writing down. This is for the ones with a gotcha attached.

## Stripe CLI — forwarding webhooks to the local backend

```
stripe login                                                    # once
stripe listen --forward-to http://127.0.0.1:8000/billing/webhook
```

`stripe listen` prints a `whsec_…`. Put it in `STRIPE_WEBHOOK_SECRET` in
`backend/.env` and restart the backend.

Three things about it:

- **The secret rotates on every listen**, so it has to be re-copied every
  session. A stale one fails signature verification, which looks exactly like
  the webhook never arriving.
- **Use the loopback address, not the hostname** — `127.0.0.1` has to match the
  host the backend is logging on, or the forward goes somewhere nothing is
  listening.
- **It has to be running to test the full flow.** The payment itself succeeds
  without it, so it looks like it worked; the *entitlement* is granted by the
  webhook. `welcome/page.tsx` polls 10× at 1.5s and then shows the "taking
  longer than expected" screen — so the symptom of a forgotten `stripe listen`
  is a successful charge and a customer stuck on that screen.
