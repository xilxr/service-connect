const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

/*
  CONNECT TO DATABASE
*/
mongoose.connect("mongodb+srv://kernel_void:Goodmoney1.@futodash.cxegic0.mongodb.net/serviceDB?retryWrites=true&w=majority")
.then(() => console.log("MongoDB connected ✔"))
.catch(err => console.log(err));

/*
  SCHEMAS
*/
const Business = mongoose.model("Business", {
  name: String,
  service: String,
  phone: String,
  location: String,
  paid: Boolean,
  verified: Boolean
});

const Request = mongoose.model("Request", {
  message: String,
  service: String
});

/*
  HOME
*/
app.get("/", (req, res) => {
  res.send("Backend + Database live ✔");
});

/*
  BUSINESS SIGNUP
*/
app.post("/business/signup", async (req, res) => {
  const { name, service, phone, location } = req.body;

  const newBiz = await Business.create({
  name,
  service: service.toLowerCase(),
  phone,
  location: location.toLowerCase(),
  paid: false,
  verified: false
});

  res.json({ business: newBiz });
});

/*
  PAYMENT
*/
app.post("/business/pay", async (req, res) => {
  const { id } = req.body;

  await Business.findByIdAndUpdate(id, { paid: true });

  res.json({ message: "Payment submitted" });
});

/*
  ADMIN APPROVE
*/
app.post("/admin/approve", async (req, res) => {
  const { id } = req.body;

  const biz = await Business.findById(id);

  if (!biz) return res.json({ error: "Not found" });

  if (!biz.paid) {
    return res.json({ error: "User has not paid" });
  }

  biz.verified = true;
  await biz.save();

  res.json({ message: "Approved ✔" });
});

/*
  GET ALL BUSINESSES
*/
app.get("/admin/businesses", async (req, res) => {
  const data = await Business.find();
  res.json(data);
});

/*
  REQUEST MATCHING
*/
app.post("/request", async (req, res) => {
  const { message, location } = req.body;

  let service = "";

  if (message.toLowerCase().includes("generator")) {
    service = "mechanic";
  } else if (message.toLowerCase().includes("plumber")) {
    service = "plumber";
  } else if (message.toLowerCase().includes("electric")) {
    service = "electrician";
  }

  await Request.create({ message, service });

  const matches = await Business.find({
  service: { $regex: service },
  location: { $regex: location.toLowerCase() },
  verified: true
});

  res.json({ matches });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running ✔");
});
