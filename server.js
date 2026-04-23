const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let businesses = [];

// test route
app.get("/", (req, res) => {
  res.send("Backend is live!");
});

// signup
app.post("/signup", (req, res) => {
  const { name, service } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);

  const newBiz = {
    id: businesses.length + 1,
    name,
    service,
    otp,
    verified: false
  };

  businesses.push(newBiz);

  res.json(newBiz);
});

// verify
app.post("/verify", (req, res) => {
  const { id, otp } = req.body;

  const biz = businesses.find(b => b.id == id);

  if (!biz) return res.json({ error: "Not found" });

  if (biz.otp == otp) {
    biz.verified = true;
    return res.json({ message: "Verified" });
  }

  res.json({ error: "Wrong OTP" });
});

// bot
let requests = [];

// SAVE STUDENT REQUEST
app.post("/request", (req, res) => {
  const { message } = req.body;

  const newRequest = {
    id: requests.length + 1,
    message,
    status: "pending"
  };

  requests.push(newRequest);

  res.json({
    message: "Request saved successfully",
    request: newRequest
  });
});

// VIEW REQUESTS (for testing)
app.get("/requests", (req, res) => {
  res.json(requests);
});
app.post("/bot", (req, res) => {
  const { message } = req.body;

  let reply = "Checking your request...";

  if (message.toLowerCase().includes("generator")) {
    reply = "Connecting you to a generator mechanic...";
  }

  if (message.toLowerCase().includes("urgent")) {
    reply = "Urgent request received!";
  }

  res.json({ reply });
});

app.listen(10000, () => {
  console.log("Server running");
});
