const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/*
  DATABASE (temporary memory storage)
*/
let businesses = [];
let requests = [];

/*
  HOME TEST
*/
app.get("/", (req, res) => {
  res.send("Backend is live and working ✔");
});

/*
  BOT SYSTEM
*/
app.post("/bot", (req, res) => {
  const { message } = req.body;

  let reply = "We are checking your request...";

  if (message.toLowerCase().includes("generator")) {
    reply = "Generator issue detected. Connecting you to nearest mechanic...";
  }

  if (message.toLowerCase().includes("urgent")) {
    reply = "Urgent request received. Finding fastest available help...";
  }

  res.json({ reply });
});

/*
  STUDENT REQUEST SYSTEM
*/
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

/*
  VIEW REQUESTS (TEST ONLY)
*/
app.get("/requests", (req, res) => {
  res.json(requests);
});

/*
  BUSINESS SIGNUP
*/
app.post("/business/signup", (req, res) => {
  const { name, service } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);

  const newBusiness = {
    id: businesses.length + 1,
    name,
    service,
    otp,
    verified: false
  };

  businesses.push(newBusiness);

  res.json({
    message: "Business registered successfully",
    business: newBusiness
  });
});

/*
  BUSINESS VERIFY
*/
app.post("/business/verify", (req, res) => {
  const { id, otp } = req.body;

  const biz = businesses.find(b => b.id == id);

  if (!biz) {
    return res.json({ error: "Business not found" });
  }

  if (biz.otp == otp) {
    biz.verified = true;
    return res.json({ message: "Business verified successfully ✔" });
  }

  res.json({ error: "Wrong OTP" });
});

/*
  START SERVER
*/
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
