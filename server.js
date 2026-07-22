const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

/*
=========================================
DATABASE
=========================================
*/

mongoose.connect(
"mongodb+srv://kernel_void:Goodmoney1.@futodash.cxegic0.mongodb.net/serviceDB?retryWrites=true&w=majority"
)
.then(()=>console.log("MongoDB Connected ✔"))
.catch(err=>console.log(err));

/*
=========================================
BUSINESS SCHEMA
=========================================
*/

const Business = mongoose.model("Business",{

businessCode:{
type:String,
unique:true
},

name:String,

email:{
type:String,
default:""
},

password:{
type:String,
default:""
},

service:String,

phone:String,

location:String,

profilePicture:{
type:String,
default:""
},

coverPhoto:{
type:String,
default:""
},

shortBio:{
type:String,
default:"Welcome to my Service Connect profile."
},

availability:{
type:String,
default:"Available"
},

rating:{
type:Number,
default:0
},

reviews:{
type:Number,
default:0
},

reviewList:[

{

studentName:{
type:String,
default:"Anonymous"
},

rating:{
type:Number,
default:5
},

comment:{
type:String,
default:""
},

createdAt:{
type:Date,
default:Date.now
}

}

],

jobsCompleted:{
type:Number,
default:0
},

profileViews:{
type:Number,
default:0
},

searchAppearances:{
type:Number,
default:0
},

whatsappClicks:{
type:Number,
default:0
},

callClicks:{
type:Number,
default:0
},

totalLeads:{
type:Number,
default:0
},

trustScore:{
type:Number,
default:100
},

paid:{
type:Boolean,
default:false
},

verified:{
type:Boolean,
default:false
},

approvedAt:{
type:Date,
default:null
},

expiryDate:{
type:Date,
default:null
},

createdAt:{
type:Date,
default:Date.now
}

});

/*
====================================
CUSTOMER HISTORY SCHEMA
====================================
*/

const CustomerHistory = mongoose.model("CustomerHistory",{

businessId:String,

studentName:String,

studentPhone:{
type:String,
default:""
},

service:String,

status:{
type:String,
default:"pending"
},

reviewed:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

});

/*
=========================================
STUDENT SCHEMA
=========================================
*/

const Student = mongoose.model("Student",{

name:String,

email:String,

password:String,

phone:String,

location:String,

profilePicture:{
type:String,
default:""
},

shortBio:{
type:String,
default:""
},

notifications:{
type:Array,
default:[]
},

createdAt:{
type:Date,
default:Date.now
}

});

/*
=========================================
REQUEST SCHEMA
=========================================
*/

const Request = mongoose.model("Request",{

studentId:String,

studentName:String,

studentPhone:String,

businessId:String,

message:String,

service:String,

location:String,

status:{
type:String,
default:"Pending"
},

createdAt:{
type:Date,
default:Date.now
}

});

app.get("/business/:id/requests", async (req, res) => {

try {

const requests = await Request.find({
  businessId: req.params.id
}).sort({
  createdAt: -1
});

res.json(requests);

} catch (err) {

console.log(err);
res.json([]);

}

});

app.post("/request/status", async (req, res) => {

try {

const { requestId, status } = req.body;

const request = await Request.findById(requestId);

if (!request) {
  return res.json({ error: "Request not found" });
}

request.status = status;

await request.save();

res.json({ message: "Request updated successfully." });

} catch (err) {

console.log(err);
res.json({ error: "Unable to update request." });

}

});

/*
=========================================
NOTIFICATION SCHEMA
=========================================
*/

const Notification = mongoose.model("Notification",{

title:String,

message:String,

receiverType:String,

receiverId:String,

read:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

});

/*
=========================================
BUSINESS CODE GENERATOR
=========================================
*/

async function generateBusinessCode(service){

const map={

electrician:"ELEC",

electrical:"ELEC",

plumber:"PLUM",

mechanic:"MECH",

baker:"BAKE",

tailor:"TAIL",

barber:"BARB",

fashion:"FASH",

computer:"TECH",

technician:"TECH"

};

let prefix="GEN";

for(let key in map){

if(service.toLowerCase().includes(key)){

prefix=map[key];

break;

}

}

let code;
let exists=true;

while(exists){

const random=Math.floor(100000+Math.random()*900000);

code=`SC-FUTO-${prefix}-${random}`;

exists=await Business.findOne({

businessCode:code

});

}

return code;

}

/*
=========================================
HOME
=========================================
*/

app.get("/",(req,res)=>{

res.send("Service Connect Backend V2 ✔");

});
/*
=========================================
BUSINESS SIGNUP
=========================================
*/

app.post("/business/signup", async (req, res) => {

  try {

    const {
    name,
    service,
    phone,
    location,
    shortBio,
    profilePicture
} = req.body;

    console.log(req.body);
    if (
    !name ||
    !service ||
    !phone ||
    !location
) {
    return res.json({
        error: "Please fill all required fields."
    });
}

    const businessCode =
      await generateBusinessCode(service);

    const business = await Business.create({

    businessCode,

    name,

    service: service.toLowerCase(),

    phone,

    location: location.toLowerCase(),

    shortBio: shortBio || "",

    profilePicture: profilePicture || "",

    paid: false,

    verified: false,

    rating: 0,

    reviews: 0

});

    res.json({
      message: "Registration successful ✔",
      business
    });

  } catch (err) {

    console.log("SIGNUP ERROR:", err);

    res.json({
      error: err.message
    });

}

});

/*
=========================================
BUSINESS LOGIN
=========================================
*/

app.post("/business/login", async (req, res) => {

  try {

    const businessCode = req.body.businessCode.trim().toUpperCase();

const business = await Business.findOne({
    businessCode
});

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    res.json({

      message: "Login successful ✔",

      business

    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Login failed"
    });

  }

});
/*
=========================================
BUSINESS PAYMENT
=========================================
*/

app.post("/business/pay", async (req, res) => {

  try {

    const { id } = req.body;

    const business =
      await Business.findById(id);

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    business.paid = true;

    await business.save();

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
=========================================
GET SINGLE BUSINESS
=========================================
*/

app.get("/business/:id", async (req, res) => {

  try {

    const business =
      await Business.findById(req.params.id);

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    business.profileViews++;

await business.save();

    res.json(business);

  } catch (err) {

    res.json({
      error: "Invalid business ID"
    });

  }

});

/*
=========================================
UPDATE BUSINESS PROFILE
=========================================
*/

app.post("/business/updateProfile", async (req, res) => {

  try {

    const {

      id,

      profilePicture,

      coverPhoto,

      shortBio,

      availability,

      phone,

      location

    } = req.body;

    const business =
      await Business.findById(id);

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    if (profilePicture)
      business.profilePicture = profilePicture;

    if (coverPhoto)
      business.coverPhoto = coverPhoto;

    if (shortBio)
      business.shortBio = shortBio;

    if (availability)
      business.availability = availability;

    if (phone)
      business.phone = phone;

    if (location)
      business.location = location.toLowerCase();

    await business.save();

    res.json({

      message: "Profile updated ✔",

      business

    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Profile update failed"
    });

  }

});
/*
=========================================
ADMIN - GET ALL BUSINESSES
=========================================
*/

app.get("/admin/businesses", async (req, res) => {

  try {

    const businesses = await Business.find()
      .sort({ createdAt: -1 });

    res.json(businesses);

  } catch (err) {

    res.json({
      error: "Failed to load businesses"
    });

  }

});

/*
=========================================
ADMIN APPROVE
=========================================
*/

app.post("/admin/approve", async (req, res) => {

  try {

    const { id } = req.body;

    const business = await Business.findById(id);

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    business.verified = true;

const today = new Date();

business.approvedAt = today;

const expiryDate = new Date(today);

expiryDate.setDate(expiryDate.getDate() + 30);

business.expiryDate = expiryDate;
    await business.save();

    res.json({
      message: "Business approved ✔"
    });

  } catch (err) {

    res.json({
      error: "Approval failed"
    });

  }

});

/*
=========================================
ADMIN DISAPPROVE
=========================================
*/

app.post("/admin/unapprove", async (req, res) => {

  try {

    const { id } = req.body;

    const business = await Business.findById(id);

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    business.verified = false;

    await business.save();

    res.json({
      message: "Business disapproved ✔"
    });

  } catch (err) {

    res.json({
      error: "Disapproval failed"
    });

  }

});

/*
=========================================
AUTO EXPIRE AFTER 30 DAYS
=========================================
*/

app.get("/business/check-expiry", async (req, res) => {

  const businesses = await Business.find({
    verified: true
  });

  const now = new Date();

  for (const business of businesses) {

    if (!business.approvedAt) continue;

    const days =
      (now - business.approvedAt) /
      (1000 * 60 * 60 * 24);

    if (days >= 30) {

      business.verified = false;

      await business.save();

    }

  }

  res.json({
    message: "Expiry check completed"
  });

});

/*
=========================================
SMART SEARCH
=========================================
*/

app.post("/request", async (req, res) => {

  try {

    const { message, location } = req.body;

    const text = message.toLowerCase();

    let service = "";

    if (
      text.includes("electric") ||
      text.includes("light") ||
      text.includes("socket")
    ) {

      service = "elect";

    }

    else if (

      text.includes("pipe") ||
      text.includes("water") ||
      text.includes("tap")

    ) {

      service = "plumb";

    }

    else if (

      text.includes("generator") ||
      text.includes("engine") ||
      text.includes("mechanic")

    ) {

      service = "mech";

    }

    const matches = await Business.find({

      verified: true,

      availability: "Available",

      service: {

        $regex: service,

        $options: "i"

      },

      location: {

        $regex: location,

        $options: "i"

      }

    }).sort({

      rating: -1

    });

    for(const worker of matches){

worker.searchAppearances++;

worker.totalLeads++;

await worker.save();

await CustomerHistory.create({

businessId:worker._id,

studentName:"Service Connect Visitor",

studentPhone:"",

service:worker.service,

status:"New Lead"

});

}

for(const worker of matches){

await Request.create({

businessId: worker._id,

studentName: "Service Connect Visitor",

studentPhone: "",

message,

service,

location,

status: "Pending"

});

}

    res.json({

      matches

    });

  } catch (err) {

    res.json({

      error: "Search failed"

    });

  }

});

/*
=========================================
RATE BUSINESS
=========================================
*/

app.post("/rate", async (req, res) => {

  try {

    const { id, rating } = req.body;

    const business =
      await Business.findById(id);

    if (!business) {

      return res.json({

        error: "Business not found"

      });

    }

    const total =
      business.rating *
      business.reviews;

    business.reviews++;

    business.rating =
      (total + Number(rating))
      / business.reviews;

    business.trustScore = Math.min(
100,
Math.round(
(business.rating * 20) +
(business.reviews * 2)
)
);

    await business.save();

    res.json({

      message: "Rating submitted ✔"

    });

  } catch (err) {

    res.json({

      error: "Rating failed"

    });

  }

});

/*
=========================================
SEND NOTIFICATION
=========================================
*/

app.post("/notification/send", async (req, res) => {

  try {

    const {

      title,

      message,

      receiverType,

      receiverId

    } = req.body;

    const notification =
      await Notification.create({

        title,

        message,

        receiverType,

        receiverId

      });

    res.json({

      message: "Notification sent ✔",

      notification

    });

  } catch (err) {

    res.json({

      error: "Notification failed"

    });

  }

});
/*
=========================================
GET NOTIFICATIONS
=========================================
*/

app.get("/notifications/:receiverId", async (req, res) => {

  const notifications =
    await Notification.find({

      receiverId: req.params.receiverId

    }).sort({

      createdAt: -1

    });

  res.json(notifications);

});

app.post("/business/availability", async (req, res) => {

  try {

    const { id, availability } = req.body;

    const business = await Business.findById(id);

    if (!business) {
      return res.json({
        error: "Business not found"
      });
    }

    business.availability = availability;

    await business.save();

    res.json({
      message: "Availability updated ✔"
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Update failed"
    });

  }

});
/*
====================================
AUTO EXPIRE BUSINESSES
====================================
*/

app.get("/admin/check-expiry", async (req, res) => {

  try {

    const today = new Date();

    const expiredBusinesses = await Business.find({

      verified: true,

      expiryDate: {
        $lte: today
      }

    });

    for (const business of expiredBusinesses) {

      business.verified = false;

      business.paid = false;

      business.approvedAt = null;

      business.expiryDate = null;

      await business.save();

    }

    res.json({

      message: `${expiredBusinesses.length} expired business(es) updated.`

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
BUSINESS REMAINING DAYS
====================================
*/

app.get("/business/:id/remaining-days", async (req, res) => {

  try {

    const business = await Business.findById(req.params.id);

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    if (!business.expiryDate) {

      return res.json({
        remainingDays: 0
      });

    }

    const today = new Date();

    const expiry = new Date(business.expiryDate);

    const difference = expiry - today;

    const remainingDays = Math.max(
      0,
      Math.ceil(difference / (1000 * 60 * 60 * 24))
    );

    res.json({
      remainingDays
    });

  } 
  catch (err) {

  console.log("REMAINING DAYS ERROR:", err);

  res.json({
    error: err.message
  });

}

});

/*
====================================
WHATSAPP CLICK
====================================
*/

app.post("/business/whatsapp-click", async (req,res)=>{

try{

const { id } = req.body;

const business = await Business.findById(id);

if(!business){

return res.json({
error:"Business not found"
});

}

business.whatsappClicks++;

await business.save();

res.json({
message:"WhatsApp click recorded."
});

}catch(err){

console.log(err);

res.json({
error:"Unable to record click."
});

}

});

/*
====================================
CALL CLICK
====================================
*/

app.post("/business/call-click", async (req,res)=>{

try{

const { id } = req.body;

const business = await Business.findById(id);

if(!business){

return res.json({
error:"Business not found"
});

}

business.callClicks++;

await business.save();

res.json({
message:"Call click recorded."
});

}catch(err){

console.log(err);

res.json({
error:"Unable to record click."
});

}

});
/*
=========================================
START SERVER
=========================================
*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log("🚀 Service Connect Backend V2 Running on Port " + PORT);

});

/*
====================================
GET BUSINESS REVIEWS
====================================
*/

app.get("/business/:id/reviews", async (req,res)=>{

try{

const business = await Business.findById(req.params.id);

if(!business){

return res.json({

reviews:[]

});

}

res.json({

reviews:business.reviewList || []

});

}catch(err){

console.log(err);

res.json({

reviews:[]

});

}

});

/*
====================================
SUBMIT BUSINESS REVIEW
====================================
*/

app.post("/business/review", async (req,res)=>{

try{

const{

businessId,

studentName,

rating,

comment

}=req.body;

const business=await Business.findById(businessId);

if(!business){

return res.json({

error:"Business not found"

});

}

business.reviewList.push({

studentName,

rating:Number(rating),

comment

});

business.reviews=

business.reviewList.length;

let total=0;

business.reviewList.forEach(r=>{

total+=Number(r.rating);

});

business.rating=

total/business.reviewList.length;

await business.save();

res.json({

message:"Review submitted successfully."

});

}catch(err){

console.log(err);

res.json({

error:"Unable to submit review."

});

}

});

/*
====================================
CREATE CUSTOMER HISTORY
====================================
*/

app.post("/customer-history", async (req,res)=>{

try{

const{

businessId,

studentName,

studentPhone,

service

}=req.body;

const history = new CustomerHistory({

businessId,

studentName,

studentPhone,

service

});

await history.save();

res.json({

message:"Customer history recorded."

});

}catch(err){

console.log(err);

res.json({

error:"Unable to record customer history."

});

}

});

/*
====================================
GET CUSTOMER HISTORY
====================================
*/

app.get("/customer-history/:businessId", async (req,res)=>{

try{

const history = await CustomerHistory.find({

businessId:req.params.businessId

}).sort({

createdAt:-1

});

res.json(history);

}catch(err){

console.log(err);

res.json([]);

}

});
