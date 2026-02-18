const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.post("/kommo-webhook", async (req, res) => {
  const { token, data, return_url } = req.body;

  const incomingMessage = typeof data?.message === "string" ? data.message.trim() : "";
  const hasMessage = incomingMessage.length > 0;
  const hasReturnUrl = !!return_url;
  const hasToken = !!token;

  console.log("[webhook] Request received, message:", hasMessage ? incomingMessage : "(empty)", "return_url:", hasReturnUrl ? "present" : "missing");

  // 1️⃣ Respond immediately (IMPORTANT) — Kommo requires 200 within 2 seconds
  res.sendStatus(200);

  // Skip processing if no message — likely a different Kommo trigger (e.g. another bot), not widget_request
  if (!hasMessage) {
    console.log("[webhook] Skipping: no message in payload (not a widget_request?)");
    return;
  }

  // Debug: log when payload looks wrong (missing return_url or token)
  if (!hasReturnUrl || !hasToken) {
    console.log("[webhook] DEBUG: Missing return_url or token. body keys:", req.body && Object.keys(req.body).join(", ") || "none");
    return;
  }

  // 2️⃣ Verify JWT (signed with integration Secret key per Kommo docs)
  // clockTolerance: allow small server clock skew (fixes "jwt not active" when nbf is ahead of our clock)
  try {
    jwt.verify(token, process.env.KOMMO_SECRET_KEY, { clockTolerance: 30 });
    console.log("[webhook] Token valid");
  } catch (err) {
    const decoded = (typeof token === "string" && token.length > 0) ? (() => { try { return jwt.decode(token); } catch (_) { return null; } })() : null;
    console.log("[webhook] Invalid token:", err.message, decoded ? "| decoded payload keys: " + Object.keys(decoded).join(", ") : "");
    return;
  }

  // 3️⃣ Process message
//   const userMessage = data?.message || "No message received";

//   const reply = `You said: ${userMessage}`;
const userMessage = (data?.message || "No message received").trim().toLowerCase();

let reply;
if (userMessage === "hello" || userMessage === "hi" || userMessage === "hey") {
  reply = "Hello! How can I help you?";
} else {
  reply = `You said: ${data?.message || userMessage}`;
}

// Ensure Kommo always gets non-empty body content (fixes "no body content" error)
reply = (reply && String(reply).trim()) || "How can I help you today?";
  console.log("[webhook] Reply:", reply);

  // 4️⃣ Resume Salesbot (only if return_url was provided)
  if (!return_url) {
    console.log("[webhook] No return_url, skipping Kommo callback");
    return;
  }
  try {
    console.log("[webhook] Sending reply to Kommo...");
    const payload = {
      data: { message: reply },
      execute_handlers: [
        {
          handler: "show",
          params: {
            type: "text",
            value: reply
          }
        }
      ]
    };
    await axios.post(
      return_url,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.KOMMO_LONG_LIVED_TOKEN}`
        }
      }
    );
    console.log("[webhook] Reply sent to Kommo successfully");
  } catch (err) {
    console.log("[webhook] Error sending response to Kommo:", err.response?.data || err.message);
  }
});

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.status(200).send("Kommo webhook server is running");
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
