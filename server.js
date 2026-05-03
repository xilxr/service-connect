const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb+srv://kernel_void:Goodmoney1.@futodash.cxegic0.mongodb.net/serviceDB?retryWrites=true&w=majority")
  .then(() => console.log("MongoDB connected ✔"))
  .catch(err => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });

const Business = mongoose.model("Business", {
  name: String,
  service: String,
  phone: String,
  location: String,
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  paid: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  profilePicture: String,
  shortBio: String,
  approvedAt: { type: Date, default: Date.now }
});

const Student = mongoose.model("Student", {
  name: String,
  phone: String,
  profilePicture: String,
  shortBio: String,
  location: String
});

app.get("/", (req, res) => {
  res.send("Backend + Database live ✔");
});

app.post("/business/signup", async (req, res) => {
  const { name, service, phone, location } = req.body;

  if (!name || !service || !phone || !location) {
    return res.json({ error: "All fields are required." });
  }

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

app.post("/business/pay", async (req, res) => {
  const { id } = req.body;

  const biz = await Business.findById(id);
  if (!biz) {
    return res.json({ error: "Business not found" });
  }

  biz.paid = true;
  await biz.save();

  res.json({ message: "Payment submitted ✔" });
});

app.post("/admin/approve", async (req, res) => {
  const { id } = req.body;

  const biz = await Business.findById(id);
  if (!biz) return res.json({ error: "Business not found" });

  if (!biz.paid) {
    return res.json({ error: "Business has not paid yet" });
  }

  biz.verified = true;
  biz.approvedAt = Date.now();
  await biz.save();

  res.json({ message: "Business approved ✔" });
});

app.post("/admin/unapprove", async (req, res) => {
  const { id } = req.body;

  const biz = await Business.findById(id);
  if (!biz) return res.json({ error: "Business not found" });

  biz.verified = false;
  await biz.save();

  res.json({ message: "Business unapproved ✔" });
});

app.post("/admin/checkExpiry", async (req, res) => {
  const { id } = req.body;

  const biz = await Business.findById(id);
  if (!biz) return res.json({ error: "Business not found" });

  const currentDate = new Date();
  const expiryDate = new Date(biz.approvedAt);
  expiryDate.setDate(expiryDate.getDate() + 30);

  if (currentDate > expiryDate) {
    return res.json({ error: "Business approval expired" });
  }

  res.json({ message: "Business approval still valid" });
});

app.post("/student/updateProfile", async (req, res) => {
  const { id, profilePicture, shortBio } = req.body;

  const student = await Student.findById(id);
  if (!student) return res.json({ error: "Student not found" });

  student.profilePicture = profilePicture || student.profilePicture;
  student.shortBio = shortBio || student.shortBio;

  await student.save();

  res.json({ message: "Profile updated ✔" });
});

app.get("/admin/businesses", async (req, res) => {
  const data = await Business.find();
  res.json(data);
});

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
  }).sort({ rating: -1 });

  res.json({ matches });
});

app.post("/rate", async (req, res) => {
  const { id, rating } = req.body;

  const biz = await Business.findById(id);
  if (!biz) return res.json({ error: "Not found" });

  let total = biz.rating * biz.reviews;
  total += rating;

  biz.reviews += 1;
  biz.rating = total / biz.reviews;

  await biz.save();

  res.json({ message: "Rating submitted ✔" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running ✔");
});
