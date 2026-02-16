const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/kommo-webhook", async (req, res) => {
  const { token, data, return_url } = req.body;

  // 1️⃣ Respond immediately (IMPORTANT)
  res.sendStatus(200);

  // 2️⃣ Verify JWT
  try {
    jwt.verify(token, process.env.KOMMO_SECRET_KEY);
  } catch (err) {
    console.log("Invalid token");
    return;
  }

  // 3️⃣ Process message
  const userMessage = data?.message || "No message received";

  const reply = `You said: ${userMessage}`;

  // 4️⃣ Resume Salesbot
  try {
    await axios.post(
      return_url,
      {
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
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.KOMMO_LONG_LIVED_TOKEN}`
        }
      }
    );
  } catch (err) {
    console.log("Error sending response to Kommo");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
