const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/kommo-webhook", async (req, res) => {
  const { token, data, return_url } = req.body;

  const incomingMessage = data?.message ?? "(no message)";
  console.log("[webhook] Request received, message:", incomingMessage, "return_url:", return_url ? "present" : "missing");

  // 1️⃣ Respond immediately (IMPORTANT)
  res.sendStatus(200);

  // 2️⃣ Verify JWT
  try {
    jwt.verify(token, process.env.KOMMO_SECRET_KEY);
    console.log("[webhook] Token valid");
  } catch (err) {
    console.log("[webhook] Invalid token");
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
