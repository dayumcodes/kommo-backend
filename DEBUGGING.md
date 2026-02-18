# Debugging Kommo webhook (no message / return_url missing / Invalid token)

## What you're seeing

- `[webhook] Request received, message: (no message)` or `message: (empty)` with `return_url: present`
- `[webhook] Invalid token`

Or a mix: sometimes `message: hello` + Token valid (works), sometimes empty message + Invalid token (fails).

So **two different sources** hit your webhook: (1) the Salesbot **widget_request** (correct payload: message + token + return_url), and (2) another trigger that sends empty message and/or wrong token. The backend now **skips** empty-message requests and returns 200 without verifying token, so you no longer see "Invalid token" for those.

---

## Correct payload (Salesbot widget step)

When a **Salesbot** runs and hits a **Widget** step that uses **widget_request**, Kommo sends a POST like this ([Kommo docs](https://developers.kommo.com/docs/private-chatbot-integration)):

```json
{
  "token": "JWT_TOKEN",
  "data": {
    "message": "Hello! How are you?",
    "from": "widget"
  },
  "return_url": "https://subdomain.kommo.com/api/v4/salesbot/321/continue/123"
}
```

- **token** – JWT signed with your integration **Secret key**
- **data.message** – user message (or placeholder like `{{message_text}}`)
- **return_url** – where your backend must POST the reply

If any of these are missing or wrong, the request is **not** from that Salesbot widget flow.

---

## Why you get wrong payloads

1. **Another Kommo webhook is using your URL**
   - **Settings → Integrations → Web hooks** – if your `https://kommo-backend.onrender.com/kommo-webhook` is set here, Kommo will send a **different** format (entity events, no `token`/`return_url`).
   - **Chat channel webhook** – when connecting a channel (e.g. WhatsApp), if a “webhook URL” is set to your backend, Kommo sends **chat webhooks** (different body, uses `X-Signature`).
   - **Fix:** Use your webhook URL **only** in the Salesbot **Widget** step (your Chatbot widget). Remove it from Settings → Web hooks and from any chat channel webhook URL.

2. **Salesbot not using the Widget block**
   - The step that sends `token`, `data`, `return_url` is the **Widget** block that uses **widget_request** (your custom “Chatbot” widget), not a generic “Webhook” or “HTTP request” step.
   - **Fix:** In Salesbot #5, the step that calls your backend must be the **Chatbot** widget (the one you uploaded with the widget that has `widget_request` and the webhook URL in its settings). If you use a different type of step, the payload will not match.

3. **Website chat → wrong bot runs first**
   - Pipeline “Incoming leads” can run several bots (e.g. Live chat bot, Welcome bot, Salesbot #5). If another bot handles the first message and never triggers your Widget step, your backend is never called with the correct payload. Or another integration might call your URL for a different reason.
   - **Fix:** Ensure the conversation is handled by **Salesbot #5** and that the **first** (or only) step that runs is your **Chatbot widget** step with your webhook URL.

---

## Use the new debug log

After deploy, when a bad request hits your webhook, you’ll see something like:

```text
[webhook] DEBUG: Unexpected payload. Content-Type: ... | body keys: ... | body sample: ...
```

- **Content-Type** – if it’s not `application/json`, the sender may be using another format.
- **body keys** – if you see keys like `message[id]`, `receiver`, `conversation_id`, it’s likely a **chat webhook**, not the Salesbot widget.
- **body sample** – confirms what’s actually in `req.body`.

Use this to see **who** is calling your URL (e.g. “Chat webhooks” vs “General webhooks” vs something else), then remove your URL from that place in Kommo and keep it only for the Salesbot Widget step.

---

## Browser / frontend errors

| Error | Cause | What to do |
|-------|--------|------------|
| `net::ERR_BLOCKED_BY_CLIENT` for `cloudflareinsights.com/beacon.min.js` | Browser tracking prevention (e.g. Edge InPrivate) blocking Cloudflare analytics | Safe to ignore for your backend. Or test in a normal window or another browser. |
| `Tracking Prevention blocked a Script resource` | Same as above | Same as above. |
| `TypeError: Cannot read properties of undefined (reading 'id')` in `livechat.js` | Bug or unexpected data in Kommo’s own script (`livechat.js`) | You can’t fix Kommo’s script. Try a different browser or disable tracking prevention for `kommo-backend.onrender.com`; if it still happens, it’s on Kommo’s side. |

These do not change the fact that the **backend** is receiving the wrong payload; fixing that is done in Kommo (correct webhook URL usage + Salesbot Widget step only).

---

## Checklist

- [ ] Your webhook URL is **not** in **Settings → Integrations → Web hooks**.
- [ ] Your webhook URL is **not** set as the “webhook URL” for a **chat channel**.
- [ ] **Salesbot #5** uses the **Chatbot** (Widget) block that sends **widget_request** to your URL, and that block is the one that runs when the user sends a message.
- [ ] Pipeline “Incoming leads” runs **Salesbot #5** (and ideally it’s the one that handles the first message, or the one that actually reaches the Widget step).
- [ ] Deploy the latest backend and reproduce; check Render logs for `[webhook] DEBUG:` to see the real payload and Content-Type.
