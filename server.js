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
  res.send("Backend live ✔");
});

/*
  BUSINESS SIGNUP (NOW UNVERIFIED + UNPAID)
*/
app.post("/business/signup", (req, res) => {
  const { name, service } = req.body;

  const newBiz = {
    id: businesses.length + 1,
    name,
    service: service.toLowerCase(),
    verified: false,
    paid: false
  };

  businesses.push(newBiz);

  res.json({
    message: "Registered. Pay ₦2000 to activate",
    business: newBiz
  });
});

/*
  SUBMIT PAYMENT PROOF
*/
app.post("/business/pay", (req, res) => {
  const { id } = req.body;

  const biz = businesses.find(b => b.id == id);

  if (!biz) return res.json({ error: "Business not found" });

  biz.paid = true;

  res.json({
    message: "Payment submitted. Waiting for admin approval"
  });
});

/*
  ADMIN VERIFY (YOU CONTROL THIS)
*/
app.post("/business/approve", (req, res) => {
  const { id } = req.body;

  const biz = businesses.find(b => b.id == id);

  if (!biz) return res.json({ error: "Not found" });

  if (!biz.paid) {
    return res.json({ error: "Payment not completed" });
  }

  biz.verified = true;

  res.json({ message: "Business approved ✔" });
});

/*
  GET VERIFIED BUSINESSES
*/
app.get("/business/:service", (req, res) => {
  const service = req.params.service.toLowerCase();

  const result = businesses.filter(
    b => b.service.includes(service) && b.verified
  );

  res.json(result);
});

/*
  REQUEST MATCHING
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

  res.json({
    service,
    matches: matched
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running");
});
