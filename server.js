const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let businesses = [];
let requests = [];

/*
  HOME
*/
app.get("/", (req, res) => {
  res.send("Backend is live ✔");
});

/*
  BUSINESS SIGNUP
*/
app.post("/business/signup", (req, res) => {
  const { name, service } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);

  const newBiz = {
    id: businesses.length + 1,
    name,
    service: service.toLowerCase(),
    otp,
    verified: false
  };

  businesses.push(newBiz);

  res.json({ business: newBiz });
});

/*
  VERIFY BUSINESS
*/
app.post("/business/verify", (req, res) => {
  const { id, otp } = req.body;

  const biz = businesses.find(b => b.id == id);

  if (!biz) return res.json({ error: "Not found" });

  if (biz.otp == otp) {
    biz.verified = true;
    return res.json({ message: "Verified ✔" });
  }

  res.json({ error: "Wrong OTP" });
});

/*
  GET VERIFIED BUSINESSES BY SERVICE
*/
app.get("/business/:service", (req, res) => {
  const service = req.params.service.toLowerCase();

  const result = businesses.filter(
    b => b.service.includes(service) && b.verified
  );

  res.json(result);
});

/*
  STUDENT REQUEST + MATCHING
*/
app.post("/request", (req, res) => {
  const { message } = req.body;

  let service = "";

  if (message.toLowerCase().includes("generator")) {
    service = "mechanic";
  } else if (message.toLowerCase().includes("plumber")) {
    service = "plumber";
  } else if (message.toLowerCase().includes("electric")) {
    service = "electrician";
  }

  const matched = businesses.filter(
    b => b.service.includes(service) && b.verified
  );

  const newRequest = {
    id: requests.length + 1,
    message,
    service,
    matches: matched
  };

  requests.push(newRequest);

  res.json(newRequest);
});

/*
  VIEW REQUESTS
*/
app.get("/requests", (req, res) => {
  res.json(requests);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
