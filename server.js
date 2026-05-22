const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

/*
====================================
CONNECT TO DATABASE
====================================
*/
mongoose.connect(
  "mongodb+srv://kernel_void:Goodmoney1.@futodash.cxegic0.mongodb.net/serviceDB?retryWrites=true&w=majority"
)
.then(() => console.log("MongoDB connected ✔"))
.catch(err => console.log(err));

/*
====================================
BUSINESS SCHEMA
====================================
*/
const Business = mongoose.model("Business", {
  name: String,
  service: String,
  phone: String,
  location: String,

  rating: {
    type: Number,
    default: 0
  },

  reviews: {
    type: Number,
    default: 0
  },

  paid: {
    type: Boolean,
    default: false
  },

  verified: {
    type: Boolean,
    default: false
  },

  profilePicture: String,

  shortBio: String,

  approvedAt: Date
});

/*
====================================
STUDENT SCHEMA
====================================
*/
const Student = mongoose.model("Student", {
  name: String,
  phone: String,
  location: String,

  profilePicture: String,

  shortBio: String
});

/*
====================================
REQUEST SCHEMA
THIS WAS THE MISSING PART
====================================
*/
const Request = mongoose.model("Request", {
  message: String,
  service: String,
  location: String
});

/*
====================================
HOME
====================================
*/
app.get("/", (req, res) => {
  res.send("Backend + Database live ✔");
});

/*
====================================
BUSINESS SIGNUP
====================================
*/
app.post("/business/signup", async (req, res) => {

  try {

    const { name, service, phone, location } = req.body;

    if (!name || !service || !phone || !location) {
      return res.json({
        error: "Please fill all fields"
      });
    }

    const newBiz = await Business.create({
      name,
      service: service.toLowerCase(),
      phone,
      location: location.toLowerCase(),

      paid: false,
      verified: false
    });

    res.json({
      business: newBiz
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Registration failed"
    });

  }

});

/*
====================================
BUSINESS PAYMENT
====================================
*/
app.post("/business/pay", async (req, res) => {

  try {

    const { id } = req.body;

    const biz = await Business.findById(id);

    if (!biz) {
      return res.json({
        error: "Business not found"
      });
    }

    biz.paid = true;

    await biz.save();

    res.json({
      message: "Payment submitted ✔"
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Payment failed"
    });

  }

});

/*
====================================
ADMIN APPROVE
====================================
*/
app.post("/admin/approve", async (req, res) => {

  const { id } = req.body;

  const biz = await Business.findById(id);

  if (!biz){

    return res.json({
      error:"Business not found"
    });

  }

  biz.verified = true;

  biz.approvedAt = new Date();

  await biz.save();

  res.json({
    message:"Business activated ✔"
  });
/*
AUTO EXPIRE BUSINESS AFTER 30 DAYS
*/

app.get("/business/check-expiry", async (req, res) => {

  const businesses = await Business.find({
    verified:true
  });

  const now = new Date();

  for(let biz of businesses){

    const approvedDate =
      new Date(biz.approvedAt);

    const diffTime =
      now - approvedDate;

    const diffDays =
      diffTime / (1000 * 60 * 60 * 24);

    if(diffDays >= 30){

      biz.verified = false;

      await biz.save();

    }

  }

  res.json({
    message:"Expiry check complete"
  });

});
  
});

  } catch (err) {

    console.log(err);

    res.json({
      error: "Approval failed"
    });

  }

});

/*
====================================
ADMIN UNAPPROVE
====================================
*/
app.post("/admin/unapprove", async (req, res) => {

  try {

    const { id } = req.body;

    const biz = await Business.findById(id);

    if (!biz) {
      return res.json({
        error: "Business not found"
      });
    }

    biz.verified = false;

    await biz.save();

    res.json({
      message: "Business unapproved ✔"
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Unapprove failed"
    });

  }

});

/*
====================================
CHECK APPROVAL EXPIRY
====================================
*/
app.post("/admin/checkExpiry", async (req, res) => {

  try {

    const { id } = req.body;

    const biz = await Business.findById(id);

    if (!biz) {
      return res.json({
        error: "Business not found"
      });
    }

    const currentDate = new Date();

    const expiryDate = new Date(biz.approvedAt);

    expiryDate.setDate(expiryDate.getDate() + 30);

    if (currentDate > expiryDate) {

      return res.json({
        error: "Business approval expired"
      });

    }

    res.json({
      message: "Business approval still valid"
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Expiry check failed"
    });

  }

});

/*
====================================
UPDATE STUDENT PROFILE
====================================
*/
app.post("/student/updateProfile", async (req, res) => {

  try {

    const { id, profilePicture, shortBio } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.json({
        error: "Student not found"
      });
    }

    student.profilePicture =
      profilePicture || student.profilePicture;

    student.shortBio =
      shortBio || student.shortBio;

    await student.save();

    res.json({
      message: "Profile updated ✔"
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Profile update failed"
    });

  }

});

/*
====================================
GET ALL BUSINESSES
====================================
*/
app.get("/admin/businesses", async (req, res) => {

  try {

    const data = await Business.find();

    res.json(data);

  } catch (err) {

    console.log(err);

    res.json({
      error: "Failed to load businesses"
    });

  }

});

/*
====================================
/*
  SMART REQUEST MATCHING
*/
app.post("/request", async (req, res) => {
  const { message, location } = req.body;

  const text = message.toLowerCase();

  let service = "";

  /*
    ELECTRICAL KEYWORDS
  */
  if (
    text.includes("light") ||
    text.includes("socket") ||
    text.includes("electric") ||
    text.includes("nepa") ||
    text.includes("wire") ||
    text.includes("current")
  ) {
    service = "electrical";
  }

  /*
    PLUMBING KEYWORDS
  */
  else if (
    text.includes("water") ||
    text.includes("pipe") ||
    text.includes("tap") ||
    text.includes("plumber") ||
    text.includes("leak")
  ) {
    service = "plumber";
  }

  /*
    MECHANIC KEYWORDS
  */
  else if (
    text.includes("generator") ||
    text.includes("engine") ||
    text.includes("mechanic") ||
    text.includes("repair")
  ) {
    service = "mechanic";
  }

  /*
    SAVE REQUEST
  */
  await Request.create({
    message,
    service
  });

  /*
    FIND MATCHES
  */
  const matches = await Business.find({
    service: { $regex: service, $options: "i" },
    location: { $regex: location, $options: "i" },
    verified: true
  }).sort({ rating: -1 });

  res.json({ matches });
});

  } catch (err) {

    console.log(err);

    res.json({
      error: "Matching failed"
    });

  }

});

/*
====================================
RATE BUSINESS
====================================
*/
app.post("/rate", async (req, res) => {

  try {

    const { id, rating } = req.body;

    const biz = await Business.findById(id);

    if (!biz) {
      return res.json({
        error: "Business not found"
      });
    }

    let total = biz.rating * biz.reviews;

    total += rating;

    biz.reviews += 1;

    biz.rating = total / biz.reviews;

    await biz.save();

    res.json({
      message: "Rating submitted ✔"
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Rating failed"
    });

  }

});

/*
====================================
START SERVER
====================================
*/
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running ✔");
});
