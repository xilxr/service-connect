const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const crypto = require("crypto");
const app = express();

/* =========================================
   CREATE STUDENT SESSION TOKEN
========================================= */

function createStudentToken(studentId, sessionVersion) {

  if (!STUDENT_SESSION_SECRET) {
    throw new Error("Student session secret is missing");
  }

  const expiresAt =
    Date.now() + (30 * 24 * 60 * 60 * 1000);

  const data =
    `student:${studentId}:${sessionVersion}:${expiresAt}`;

  const signature = crypto
    .createHmac("sha256", STUDENT_SESSION_SECRET)
    .update(data)
    .digest("hex");

  return Buffer.from(
    `${data}:${signature}`
  ).toString("base64url");

}

/* =========================================
   CREATE BUSINESS SESSION TOKEN
========================================= */

function createBusinessToken(businessId, sessionVersion) {

  if (
    !BUSINESS_SESSION_SECRET ||
    Buffer.byteLength(BUSINESS_SESSION_SECRET, "utf8") < 32
  ) {
    throw new Error("Business session secret is missing or too short");
  }

  const expiresAt =
    Date.now() + (30 * 24 * 60 * 60 * 1000);

  const data =
    `business:${businessId}:${sessionVersion}:${expiresAt}`;

  const signature = crypto
    .createHmac("sha256", BUSINESS_SESSION_SECRET)
    .update(data)
    .digest("hex");

  return Buffer.from(
    `${data}:${signature}`
  ).toString("base64url");

}

/* =========================================
   VERIFY BUSINESS SESSION TOKEN
========================================= */

function verifyBusinessToken(token) {

  try {

    if (
      typeof token !== "string" ||
      !token ||
      !BUSINESS_SESSION_SECRET ||
      Buffer.byteLength(BUSINESS_SESSION_SECRET, "utf8") < 32
    ) {
      return null;
    }

    const decoded = Buffer.from(
      token,
      "base64url"
    ).toString("utf8");

    const parts = decoded.split(":");

    if (parts.length !== 5) {
      return null;
    }

    const [
      role,
      businessId,
      sessionVersion,
      expiresAt,
      signature
    ] = parts;

    if (role !== "business") {
      return null;
    }

    if (!mongoose.isValidObjectId(businessId)) {
      return null;
    }

    const version = Number(sessionVersion);
    const expiry = Number(expiresAt);

    if (
      !Number.isSafeInteger(version) ||
      version < 0 ||
      !Number.isSafeInteger(expiry) ||
      Date.now() >= expiry
    ) {
      return null;
    }

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return null;
    }

    const data =
      `business:${businessId}:${sessionVersion}:${expiresAt}`;

    const expectedSignature = crypto
      .createHmac("sha256", BUSINESS_SESSION_SECRET)
      .update(data)
      .digest();

    const receivedSignature = Buffer.from(
      signature,
      "hex"
    );

    if (
      receivedSignature.length !== expectedSignature.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        receivedSignature,
        expectedSignature
      )
    ) {
      return null;
    }

    return {
      businessId,
      sessionVersion: version
    };

  } catch (error) {

    return null;

  }

}

/* =========================================
   REQUIRE BUSINESS OWNER LOGIN
========================================= */

async function requireBusiness(req, res, next) {

  try {

    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {

      return res.status(401).json({
        error: "Business owner login required."
      });

    }

    const token = authHeader.slice(7).trim();

    const session = verifyBusinessToken(token);

    if (!session) {

      return res.status(401).json({
        error: "Invalid or expired business session."
      });

    }

    const business = await Business.findById(
      session.businessId
    );

    if (!business) {

      return res.status(401).json({
        error: "Business account no longer exists."
      });

    }

    if (
      (business.sessionVersion ?? 0) !==
      session.sessionVersion
    ) {

      return res.status(401).json({
        error: "Your session has ended. Please log in again."
      });

    }

    req.business = business;

    next();

  } catch (error) {

    console.error("BUSINESS AUTH ERROR:", error);

    return res.status(500).json({
      error: "Unable to verify business login."
    });

  }

}

/* =========================================
   VERIFY STUDENT SESSION TOKEN
========================================= */

function verifyStudentToken(token) {

  try {

    if (
      typeof token !== "string" ||
      !token ||
      !STUDENT_SESSION_SECRET
    ) {
      return null;
    }

    const decoded = Buffer.from(
      token,
      "base64url"
    ).toString("utf8");

    const parts = decoded.split(":");

    if (parts.length !== 5) {
      return null;
    }

    const [
      role,
      studentId,
      sessionVersion,
      expiresAt,
      signature
    ] = parts;

    if (role !== "student") {
      return null;
    }

    if (!mongoose.isValidObjectId(studentId)) {
      return null;
    }

    const version = Number(sessionVersion);
    const expiry = Number(expiresAt);

    if (
      !Number.isSafeInteger(version) ||
      version < 0 ||
      !Number.isSafeInteger(expiry) ||
      Date.now() >= expiry
    ) {
      return null;
    }

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return null;
    }

    const data =
      `student:${studentId}:${sessionVersion}:${expiresAt}`;

    const expectedSignature = crypto
      .createHmac("sha256", STUDENT_SESSION_SECRET)
      .update(data)
      .digest();

    const receivedSignature = Buffer.from(
      signature,
      "hex"
    );

    if (
      receivedSignature.length !== expectedSignature.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        receivedSignature,
        expectedSignature
      )
    ) {
      return null;
    }

    return {
      studentId,
      sessionVersion: version
    };

  } catch (error) {

    return null;

  }

}

/* =========================================
   REQUIRE STUDENT LOGIN
========================================= */

async function requireStudent(req, res, next) {

  try {

    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {

      return res.status(401).json({
        error: "Student login required."
      });

    }

    const token = authHeader.slice(7).trim();

    const session = verifyStudentToken(token);

if (!session) {

  return res.status(401).json({
    error: "Invalid or expired student session."
  });

}

const student = await Student.findById(
  session.studentId
).select("-password");

if (!student) {

  return res.status(401).json({
    error: "Student account no longer exists."
  });

}

if (
  (student.sessionVersion ?? 0) !==
  session.sessionVersion
) {

  return res.status(401).json({
    error: "Your session has ended. Please log in again."
  });

}

    req.student = student;

    next();

  } catch (error) {

    console.error("STUDENT AUTH ERROR:", error);

    return res.status(500).json({
      error: "Unable to verify student login."
    });

  }

}

/* =========================================
   STUDENT PASSWORD SECURITY
========================================= */

function hashStudentPassword(password) {

  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto.scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return `${salt}:${hash}`;

}

function verifyStudentPassword(password, storedPassword) {

  try {

    const parts = storedPassword.split(":");

    if (parts.length !== 2) return false;

    const [salt, originalHash] = parts;

    const newHash = crypto.scryptSync(
      password,
      salt,
      64
    );

    const savedHash = Buffer.from(originalHash, "hex");

    if (newHash.length !== savedHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(newHash, savedHash);

  } catch (error) {

    return false;

  }

}

/* =========================================
   BUSINESS PASSWORD SECURITY
========================================= */

function hashBusinessPassword(password) {
  return hashStudentPassword(password);
}

function verifyBusinessPassword(password, storedPassword) {
  return verifyStudentPassword(password, storedPassword);
}

/* =========================================
   GENERATE BUSINESS PASSWORD SETUP CODE
========================================= */

function generateBusinessSetupCode() {

  return crypto.randomBytes(32).toString("hex");

}

/* =========================================
   HASH BUSINESS PASSWORD SETUP CODE
========================================= */

function hashBusinessSetupCode(code) {

  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");

}

app.use(cors());
app.use(express.json());

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

/* =========================================
   STUDENT SESSION CONFIGURATION
========================================= */

const STUDENT_SESSION_SECRET =
  process.env.STUDENT_SESSION_SECRET;

/* =========================================
   BUSINESS SESSION CONFIGURATION
========================================= */

const BUSINESS_SESSION_SECRET =
  process.env.BUSINESS_SESSION_SECRET;

if (
  !STUDENT_SESSION_SECRET ||
  Buffer.byteLength(STUDENT_SESSION_SECRET, "utf8") < 32
) {
  console.error(
    "❌ STUDENT_SESSION_SECRET is missing or too short"
  );
}

if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_SECRET) {
  console.error("❌ Admin security environment variables are missing");
}
/*
=========================================
DATABASE
=========================================
*/

function createAdminToken() {
  const expiresAt = Date.now() + (12 * 60 * 60 * 1000);

  const data = `admin:${expiresAt}`;

  const signature = crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(data)
    .digest("hex");

  return Buffer.from(`${data}:${signature}`).toString("base64");
}

function verifyAdminToken(token) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(":");

    if (parts.length !== 3) return false;

    const [role, expiresAt, signature] = parts;

    if (role !== "admin") return false;
    if (Date.now() > Number(expiresAt)) return false;

    const data = `admin:${expiresAt}`;

    const expectedSignature = crypto
      .createHmac("sha256", ADMIN_SECRET)
      .update(data)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

mongoose.connect(
process.env.MONGODB_URI
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

password: {
  type: String,
  default: "",
  select: false
},

sessionVersion: {
  type: Number,
  default: 0
},

// =========================================
// BUSINESS PASSWORD SETUP APPROVAL
// =========================================

passwordSetupApproved: {
  type: Boolean,
  default: false
},

passwordSetupCompleted: {
  type: Boolean,
  default: false
},

// =========================================
// BUSINESS PASSWORD SETUP TOKEN
// =========================================

passwordSetupTokenHash: {
  type: String,
  default: "",
  select: false
},

passwordSetupTokenExpiresAt: {
  type: Date,
  default: null
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

viewed:{
type:Boolean,
default:false
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

paymentSubmittedAt: {
type: Date,
default: null
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

requestId:String,

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

viewed:{
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

name:{
  type:String,
  required:true,
  trim:true
},

email:{
  type:String,
  default:""
},

password:{
  type:String,
  default:""
},

phone:{
  type:String,
  required:true,
  trim:true,
  unique:true
},

location:{
  type:String,
  default:""
},

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

sessionVersion:{
  type:Number,
  default:0
},

createdAt:{
type:Date,
default:Date.now
}

});

/* =========================================
   STUDENT ACCOUNT REGISTRATION
========================================= */

app.post("/student/register", async (req, res) => {

  try {

    const { name, phone, password, location } = req.body;

    if (
      typeof name !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !phone.trim() ||
      password.length < 8
    ) {
      return res.status(400).json({
        error: "Enter your name, phone number, and a password of at least 8 characters."
      });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone)) {
      return res.status(400).json({
        error: "Enter a valid phone number without spaces."
      });
    }

    const existingStudent = await Student.findOne({
      phone: cleanPhone
    });

    if (existingStudent) {
      return res.status(409).json({
        error: "This phone number is already registered. Please log in."
      });
    }

    const hashedPassword = hashStudentPassword(password);

    const student = await Student.create({
      name: cleanName,
      phone: cleanPhone,
      password: hashedPassword,
      location: typeof location === "string"
        ? location.trim()
        : ""
    });

    return res.status(201).json({
      message: "Student account created successfully ✔",
      student: {
        id: student._id,
        name: student.name,
        phone: student.phone,
        location: student.location
      }
    });

  } catch (error) {

    console.error("STUDENT REGISTRATION ERROR:", error);

    return res.status(500).json({
      error: "Registration failed. Please try again."
    });

  }

});

/* =========================================
   STUDENT LOGIN
========================================= */

app.post("/student/login", async (req, res) => {

  try {

    const { phone, password } = req.body;

    if (
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !phone.trim() ||
      !password
    ) {

      return res.status(400).json({
        error: "Please enter your phone number and password."
      });

    }

    const cleanPhone = phone.trim();

    const student = await Student.findOne({
      phone: cleanPhone
    });

    if (
      !student ||
      !verifyStudentPassword(password, student.password)
    ) {

      return res.status(401).json({
        error: "Incorrect phone number or password."
      });

    }

    const token = createStudentToken(
  student._id.toString(),
  student.sessionVersion ?? 0
);

return res.json({

  message: "Login successful ✔",

  token,

  expiresIn: 30 * 24 * 60 * 60,

  student: {
    id: student._id,
    name: student.name,
    phone: student.phone,
    location: student.location,
    profilePicture: student.profilePicture
  }

});

  } catch (error) {

    console.error("STUDENT LOGIN ERROR:", error);

    return res.status(500).json({
      error: "Login failed. Please try again."
    });

  }

});

/* =========================================
   CHECK STUDENT LOGIN SESSION
========================================= */

app.get("/student/me", requireStudent, async (req, res) => {

  try {

    const student = req.student;

    return res.json({

      loggedIn: true,

      student: {
        id: student._id,
        name: student.name,
        phone: student.phone,
        location: student.location,
        profilePicture: student.profilePicture,
        shortBio: student.shortBio
      }

    });

  } catch (error) {

    console.error("STUDENT SESSION ERROR:", error);

    return res.status(500).json({
      error: "Unable to load student account."
    });

  }

});

/* =========================================
   STUDENT SECURE LOGOUT
========================================= */

app.post("/student/logout", requireStudent, async (req, res) => {

  try {

    await Student.updateOne(
      { _id: req.student._id },
      { $inc: { sessionVersion: 1 } }
    );

    return res.json({
      message: "Logged out successfully ✔"
    });

  } catch (error) {

    console.error("STUDENT LOGOUT ERROR:", error);

    return res.status(500).json({
      error: "Unable to log out. Please try again."
    });

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

viewed:{
type:Boolean,
default:false
},

reviewed: {
  type: Boolean,
  default: false
},

createdAt:{
type:Date,
default:Date.now
}

});

/*
=========================================
CHAT SCHEMA
=========================================
*/

const Chat = mongoose.model("Chat",{

requestId:String,

businessId:String,

studentPhone:String,

studentName:String,

senderType:String,

message:String,

unread:{
type:Boolean,
default:true
},

read:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

});

/* =========================================
   SECURE BUSINESS HIRE REQUESTS
========================================= */

app.get("/business/:id/requests", requireBusiness, async (req, res) => {

  try {

    const requestedBusinessId = req.params.id;

    const loggedInBusinessId =
      req.business._id.toString();

    // Prevent access to another business owner's requests

    if (requestedBusinessId !== loggedInBusinessId) {

      return res.status(403).json({
        error: "You cannot access another business owner's requests."
      });

    }

    // Retrieve only this business owner's hire requests

    const requests = await Request.find({
      businessId: loggedInBusinessId
    }).sort({
      createdAt: -1
    });

    return res.json(requests);

  } catch (error) {

    console.error("BUSINESS REQUESTS ERROR:", error);

    return res.status(500).json({
      error: "Unable to load hire requests."
    });

  }

});

/*
=========================================
REQUEST STATUS
=========================================
*/

app.post("/request/status", requireBusiness, async (req,res)=>{

try{

const { requestId, status } = req.body;


const request = await Request.findById(requestId);

// Verify the request belongs to the logged-in business owner

if (
  request &&
  request.businessId.toString() !== req.business._id.toString()
) {
  return res.status(403).json({
    error: "You cannot update another business owner's request."
  });
}

// Allow only valid status changes

if (!["Accepted", "Declined"].includes(status)) {
  return res.status(400).json({
    error: "Invalid request status."
  });
}

if(!request){

return res.json({
error:"Request not found"
});

}


request.status = status;
request.viewed = false;

await request.save();



const business = await Business.findById(
request.businessId
);



if(business){


let message="";


if(status==="Accepted"){

message =
`${business.name} has accepted your ${request.service} request. The professional will contact you shortly.`;

await CustomerHistory.create({

businessId: business._id,

requestId: request._id,

studentName: request.studentName,

studentPhone: request.studentPhone,

service: request.service,

status: "Accepted"

});

}


if(status==="Declined"){

message =
`${business.name} declined your ${request.service} request. You can search for another professional.`;


}



if(message){

await Notification.create({

title:"Service Request Update",

message,

receiverType:"student",

receiverId:request.studentPhone,

type:"request_status",

studentViewed:false,

requestId:request._id,

businessId:business._id

});


}


}



res.json({

message:"Request updated successfully ✔"

});


}catch(err){

console.log(err);

res.json({

error:"Unable to update request"

});

}

});

/*
====================================
COMPLETE JOB
====================================
*/

app.post("/request/complete", requireBusiness, async (req,res)=>{

try{

const { requestId } = req.body;


const request = await Request.findById(requestId);


// Verify the job belongs to the logged-in business owner

if (
  request &&
  request.businessId.toString() !== req.business._id.toString()
) {
  return res.status(403).json({
    error: "You cannot complete another business owner's job."
  });
}

// Prevent completing a job more than once

if (request && request.status === "Completed") {
  return res.status(409).json({
    error: "This job has already been completed."
  });
}

// Only accepted jobs can be completed

if (request && request.status !== "Accepted") {
  return res.status(400).json({
    error: "Only accepted jobs can be marked as completed."
  });
}

if(!request){

return res.json({
error:"Request not found"
});

}


// update request status

request.status="Completed";
  
request.viewed = false;

await request.save();


// increase worker completed jobs

const business = await Business.findById(
request.businessId
);


if(business){

business.jobsCompleted++;

await Notification.create({

title:"Job Completed",

message:
`Your ${request.service} request has been completed. Please rate the professional.`,

receiverType:"student",

receiverId:request.studentPhone,

requestId:request._id.toString(),

businessId:business._id.toString(),

type:"request_status",

studentViewed:false

});

await business.save();

}


res.json({

message:"Job completed successfully ✔"

});


}catch(err){

console.log(err);

res.json({

error:"Unable to complete job"

});

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

businessId:{
type:String,
default:""
},

studentPhone:{
type:String,
default:""
},

requestId:{
type:String,
default:""
},

type:{
type:String,
default:"general"
},

read:{
type:Boolean,
default:false
},

studentViewed:{
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

/* =========================================
   SECURE BUSINESS OWNER LOGIN
========================================= */

app.post("/business/login", async (req, res) => {

  try {

    const { businessCode, password } = req.body || {};

    if (
      typeof businessCode !== "string" ||
      !businessCode.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        error: "Please enter your business code and password."
      });
    }

    const cleanCode = businessCode.trim().toUpperCase();

    const business = await Business.findOne({
      businessCode: cleanCode
    }).select("+password");

    if (
      !business ||
      !business.password ||
      !verifyBusinessPassword(password, business.password)
    ) {
      return res.status(401).json({
        error: "Incorrect business code or password."
      });
    }

    const token = createBusinessToken(
      business._id.toString(),
      business.sessionVersion ?? 0
    );

    return res.json({

      message: "Login successful ✔",

      token,

      expiresIn: 30 * 24 * 60 * 60,

      business: {
        _id: business._id,
        businessCode: business.businessCode,
        name: business.name,
        service: business.service,
        phone: business.phone,
        location: business.location,
        profilePicture: business.profilePicture,
        verified: business.verified,
        availability: business.availability
      }

    });

  } catch (error) {

    console.error("BUSINESS LOGIN ERROR:", error);

    return res.status(500).json({
      error: "Unable to log in. Please try again."
    });

  }

});

/* =========================================
   CHECK BUSINESS OWNER LOGIN SESSION
========================================= */

app.get("/business/me", requireBusiness, async (req, res) => {

  try {

    const business = req.business;

    return res.json({

      loggedIn: true,

      business: {
        _id: business._id,
        businessCode: business.businessCode,
        name: business.name,
        service: business.service,
        phone: business.phone,
        location: business.location,
        profilePicture: business.profilePicture,
        coverPhoto: business.coverPhoto,
        shortBio: business.shortBio,
        verified: business.verified,
        availability: business.availability
      }

    });

  } catch (error) {

    console.error("BUSINESS SESSION ERROR:", error);

    return res.status(500).json({
      error: "Unable to load business account."
    });

  }

});

/* =========================================
   SECURE BUSINESS OWNER LOGOUT
========================================= */

app.post("/business/logout", requireBusiness, async (req, res) => {

  try {

    await Business.updateOne(
      { _id: req.business._id },
      { $inc: { sessionVersion: 1 } }
    );

    return res.json({
      message: "Logged out successfully ✔"
    });

  } catch (error) {

    console.error("BUSINESS LOGOUT ERROR:", error);

    return res.status(500).json({
      error: "Unable to log out. Please try again."
    });

  }

});

/*
=========================================
BUSINESS PAYMENT
=========================================
*/

app.post("/business/pay", requireBusiness, async (req, res) => {

  try {

    const { id } = req.body;

// Verify payment submission belongs to the logged-in business owner

if (id !== req.business._id.toString()) {
  return res.status(403).json({
    error: "You cannot submit payment for another business account."
  });
}
     
    const business =
      await Business.findById(id);

    if (!business) {

      return res.json({
        error: "Business not found"
      });

    }

    business.paid = true;
business.paymentSubmittedAt = new Date();

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

app.post("/business/updateProfile", requireBusiness, async (req, res) => {

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

// Verify the profile belongs to the logged-in business owner

if (
  id !== req.business._id.toString()
) {
  return res.status(403).json({
    error: "You cannot edit another business owner's profile."
  });
}
     
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
ADMIN LOGIN
=========================================
*/

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username !== ADMIN_USERNAME ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      message: "Invalid admin username or password"
    });
  }

  const token = createAdminToken();

  res.json({
    success: true,
    token
  });
});

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Admin login required"
    });
  }

  const token = authHeader.substring(7);

  if (!verifyAdminToken(token)) {
    return res.status(401).json({
      message: "Invalid or expired admin session"
    });
  }

  next();
}

/*
=========================================
ADMIN - GET ALL BUSINESSES
=========================================
*/

app.get("/admin/businesses", requireAdmin, async (req, res) => {

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
FEATURED WORKER
=========================================
*/

app.get("/featured-worker", async (req, res) => {

try{

const worker = await Business.findOne({

verified: true,

availability: {
$regex:"available",
$options:"i"
}

}).sort({

rating: -1,

trustScore: -1,

searchAppearances: -1

});

if(!worker){

return res.json({});

}

res.json(worker);

}catch(err){

console.log(err);

res.json({});

}

});

/*
=========================================
TOP WORKERS
=========================================
*/

app.get("/top-workers", async (req, res) => {

try {

const workers = await Business.find({

verified: true,

availability:{
$regex:"available",
$options:"i"
}

}).sort({

rating: -1,

trustScore: -1

}).limit(5);

res.json(workers);

} catch (err) {

console.log(err);

res.json([]);

}

});

/*
=========================================
ADMIN APPROVE
=========================================
*/

app.post("/admin/approve", requireAdmin, async (req, res) => {

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

    await Notification.create({

title:"Account Approved",

message:"Congratulations! Your business has been approved and is now visible to customers.",

receiverType:"business",

businessId:business._id,

type:"approval"

});

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

app.post("/admin/unapprove", requireAdmin, async (req, res) => {
  
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

/* =========================================
   ADMIN APPROVE BUSINESS PASSWORD SETUP
========================================= */

app.post("/admin/business/password-setup/approve", requireAdmin, async (req, res) => {

  try {

    const { businessId } = req.body || {};

    if (!mongoose.isValidObjectId(businessId)) {
      return res.status(400).json({
        error: "Invalid business ID."
      });
    }

    const business = await Business.findById(businessId)
      .select("+password +passwordSetupTokenHash");

    if (!business) {
      return res.status(404).json({
        error: "Business account not found."
      });
    }

    if (business.passwordSetupCompleted || business.password) {
      return res.status(409).json({
        error: "This business already has a password."
      });
    }

    business.passwordSetupApproved = true;

    // Invalidate any previously issued setup code
    business.passwordSetupTokenHash = "";
    business.passwordSetupTokenExpiresAt = null;

    await business.save();

    return res.json({
      message: "Password setup approved successfully.",
      businessId: business._id,
      passwordSetupApproved: true
    });

  } catch (error) {

    console.error("BUSINESS PASSWORD APPROVAL ERROR:", error);

    return res.status(500).json({
      error: "Unable to approve password setup."
    });

  }

});

/* =========================================
   ADMIN ISSUE BUSINESS PASSWORD SETUP CODE
========================================= */

app.post("/admin/business/password-setup/issue", requireAdmin, async (req, res) => {

  try {

    const { businessId } = req.body || {};

    if (!mongoose.isValidObjectId(businessId)) {
      return res.status(400).json({
        error: "Invalid business ID."
      });
    }

    const business = await Business.findById(businessId)
      .select("+password +passwordSetupTokenHash");

    if (!business) {
      return res.status(404).json({
        error: "Business account not found."
      });
    }

    if (!business.passwordSetupApproved) {
      return res.status(403).json({
        error: "Approve this owner for password setup first."
      });
    }

    if (business.passwordSetupCompleted || business.password) {
      return res.status(409).json({
        error: "This business already has a password."
      });
    }

    const setupCode = generateBusinessSetupCode();

    business.passwordSetupTokenHash =
      hashBusinessSetupCode(setupCode);

    business.passwordSetupTokenExpiresAt =
      new Date(Date.now() + 15 * 60 * 1000);

    await business.save();

    return res.json({
      message: "One-time setup code generated.",
      businessId: business._id,
      setupCode,
      expiresInMinutes: 15
    });

  } catch (error) {

    console.error("BUSINESS SETUP CODE ERROR:", error);

    return res.status(500).json({
      error: "Unable to generate password setup code."
    });

  }

});

/* =========================================
   BUSINESS FIRST PASSWORD SETUP
========================================= */

app.post("/business/password-setup/complete", async (req, res) => {

  try {

    const { businessId, setupCode, password } = req.body || {};

    if (
      !mongoose.isValidObjectId(businessId) ||
      typeof setupCode !== "string" ||
      !/^[a-f0-9]{64}$/.test(setupCode) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 1024
    ) {
      return res.status(400).json({
        error: "Enter valid setup details and a password of at least 8 characters."
      });
    }

    const business = await Business.findById(businessId)
      .select("+password +passwordSetupTokenHash");

    if (
      !business ||
      !business.passwordSetupApproved ||
      business.passwordSetupCompleted ||
      business.password ||
      !business.passwordSetupTokenHash ||
      !business.passwordSetupTokenExpiresAt ||
      business.passwordSetupTokenExpiresAt <= new Date()
    ) {
      return res.status(400).json({
        error: "Invalid or expired password setup request."
      });
    }

    const submittedHash = Buffer.from(
      hashBusinessSetupCode(setupCode),
      "hex"
    );

    const savedHash = Buffer.from(
      business.passwordSetupTokenHash,
      "hex"
    );

    if (
      savedHash.length !== 32 ||
      !crypto.timingSafeEqual(submittedHash, savedHash)
    ) {
      return res.status(400).json({
        error: "Invalid or expired password setup request."
      });
    }

    const hashedPassword = hashBusinessPassword(password);

    const updatedBusiness = await Business.findOneAndUpdate(
      {
        _id: business._id,
        passwordSetupApproved: true,
        passwordSetupCompleted: { $ne: true },
        passwordSetupTokenHash: business.passwordSetupTokenHash,
        passwordSetupTokenExpiresAt: { $gt: new Date() },
        $or: [
          { password: "" },
          { password: { $exists: false } }
        ]
      },
      {
        $set: {
          password: hashedPassword,
          passwordSetupApproved: false,
          passwordSetupCompleted: true,
          passwordSetupTokenHash: "",
          passwordSetupTokenExpiresAt: null
        },
        $inc: {
          sessionVersion: 1
        }
      },
      { new: true }
    );

    if (!updatedBusiness) {
      return res.status(409).json({
        error: "This setup code is no longer valid."
      });
    }

    return res.json({
      message: "Password created successfully. You can now log in."
    });

  } catch (error) {

    console.error("BUSINESS PASSWORD SETUP ERROR:", error);

    return res.status(500).json({
      error: "Unable to complete password setup."
    });

  }

});

/*
=========================================
AUTO EXPIRE AFTER 30 DAYS
=========================================
*/

app.get("/business/check-expiry", requireAdmin, async (req, res) => {

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
STUDENT REQUESTS PHONE
=========================================
*/

app.get("/student/requests/:phone", requireStudent, async(req,res)=>{

try{

if (req.params.phone !== req.student.phone) {
  return res.status(403).json({
    error: "You cannot access another student's requests."
  });
}

const requests = await Request.find({

studentPhone:req.student.phone

}).sort({

createdAt:-1

});


res.json(requests);


}catch(err){

console.log(err);

res.json([]);

}

});

/*
=========================================
SMART SEARCH WORKERS
=========================================
*/

app.post("/request", async (req, res) => {

  try {

    const {
      studentName,
      studentPhone,
      message,
      location
    } = req.body;

    if (
      !studentName ||
      !studentPhone ||
      !message ||
      !location
    ) {

      return res.json({
        error: "Please fill all required fields."
      });

    }

    const text = message.toLowerCase();

    let service = "";

    /*
    ==============================
    DETECT SERVICE
    ==============================
    */

    if (
      text.includes("electric") ||
      text.includes("electrical") ||
      text.includes("light") ||
      text.includes("socket")
    ) {

      service = "elect";

    }

    else if (
      text.includes("pipe") ||
      text.includes("water") ||
      text.includes("tap") ||
      text.includes("plumb")
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

    else if (
      text.includes("cake") ||
      text.includes("bake") ||
      text.includes("food")
    ) {

      service = "bake";

    }

    else if (
      text.includes("cloth") ||
      text.includes("fashion") ||
      text.includes("tailor")
    ) {

      service = "tail";

    }

    else if (
      text.includes("hair") ||
      text.includes("barber")
    ) {

      service = "barb";

    }

    else {

      service = text;

    }

    /*
    ==============================
    LOCATION MATCHING
    ==============================
    */

    const searchLocation =
      location.toLowerCase().trim();

    const nearbyMap = {

      futo: [
        "futo",
        "eziobodo",
        "ihiagwa",
        "umuchima"
      ],

      eziobodo: [
        "eziobodo",
        "futo",
        "ihiagwa"
      ],

      ihiagwa: [
        "ihiagwa",
        "futo",
        "eziobodo"
      ],

      nekede: [
        "nekede",
        "owerri",
        "futo"
      ],

      owerri: [
        "owerri",
        "nekede",
        "futo"
      ]

    };

    const allowedLocations =
      nearbyMap[searchLocation] ||
      [searchLocation];

    /*
    ==============================
    FIND VERIFIED AVAILABLE WORKERS
    ==============================
    */

    const matches = await Business.find({

      verified: true,

      availability: {
        $regex: "^available$",
        $options: "i"
      },

      expiryDate: { $gt: new Date() },
      
      service: {
        $regex: service,
        $options: "i"
      },

      location: {
        $in: allowedLocations
      }

    });

    /*
    ==============================
    NO WORKER FOUND
    ==============================
    */

    if (matches.length === 0) {

      return res.json({

        matches: [],

        message:
          "No verified worker found in your area."

      });

    }

    /*
    ==============================
    SORT WORKERS
    ==============================
    */

    matches.sort((a, b) => {

      const aIndex =
        allowedLocations.indexOf(a.location);

      const bIndex =
        allowedLocations.indexOf(b.location);

      if (aIndex !== bIndex) {

        return aIndex - bIndex;

      }

      return b.rating - a.rating;

    });

    /*
    ==============================
    RETURN WORKERS
    ==============================
    */

    const responseWorkers =
      matches.map(worker => ({

        _id:
          worker._id,

        name:
          worker.name,

        service:
          worker.service,

        phone:
          worker.phone,

        location:
          worker.location,

        profilePicture:
          worker.profilePicture,

        coverPhoto:
          worker.coverPhoto,

        shortBio:
          worker.shortBio,

        availability:
          worker.availability,

        rating:
          worker.rating,

        reviews:
          worker.reviews,

        trustScore:
          worker.trustScore,

        verified:
          worker.verified

      }));

    /*
    ==============================
    SEND SEARCH RESULTS
    ==============================
    */

    res.json({

      matches:
        responseWorkers

    });

  }

  catch (err) {

    console.log(
      "SMART SEARCH ERROR:",
      err
    );

    res.status(500).json({

      error:
        "Search failed. Please try again."

    });

  }

});

/*
=========================================
HIRE WORKER
=========================================
*/

app.post("/hire", requireStudent, async (req, res) => {
  try {

    const {
  businessId,
  message,
  service,
  location
} = req.body;

const studentId = req.student._id.toString();
const studentName = req.student.name;
const studentPhone = req.student.phone;

    /*
    ==============================
    CHECK REQUIRED INFORMATION
    ==============================
    */

    if (
  !studentName ||
  !studentPhone ||
  !businessId
) {

  return res.json({

    error:
      "Missing required information."

  });

}
    /*
    ==============================
    FIND WORKER
    ==============================
    */

    const business =
      await Business.findById(businessId);

    if (!business) {

      return res.json({

        error:
          "Worker not found."

      });

    }

if (
  !business.verified ||
  !business.expiryDate ||
  business.expiryDate <= new Date()
) {
  return res.json({
    error: "This worker is no longer approved."
  });
}
    
    /*
    ==============================
    CHECK WORKER AVAILABILITY
    ==============================
    */

    if (
      !business.availability ||
      business.availability.toLowerCase()
      !== "available"
    ) {

      return res.json({

        error:
          "This worker is currently unavailable."

      });

    }

    /*
    ==============================
    CHECK FOR EXISTING ACTIVE REQUEST
    ==============================
    */

    let request =
      await Request.findOne({

        businessId:
          business._id.toString(),

        studentPhone,

        status: {
          $in: [
            "Pending",
            "Accepted"
          ]
        }

      });

    /*
    ==============================
    CREATE NEW HIRE REQUEST
    ==============================
    */

    if (!request) {

      request =
        await Request.create({

          studentId:
            studentId || "",

          studentName,

          studentPhone,

          businessId:
            business._id.toString(),

          message,

          service:
            service || business.service,

          location:
            location || "",

          status:"Pending",
          
          viewed:false,
          
          hired:true

        });

    }

    /*
    ==============================
    SEND NOTIFICATION TO WORKER
    ==============================
    */

    await Notification.create({

      title:
        "New Hire Request",

      message:
        `${studentName} wants to hire you for ${service || business.service}.`,

      receiverType:
        "business",

      businessId:
        business._id.toString(),

      studentPhone,

      requestId:
        request._id.toString(),

      type:
        "hire"

    });

    /*
    ==============================
    SUCCESS
    ==============================
    */

    res.json({

      message:
        `Hire request sent to ${business.name} ✔`,

      requestId:
        request._id.toString(),

      businessId:
        business._id.toString(),

      workerName:
        business.name

    });

  }

  catch (err) {

    console.log(
      "HIRE ERROR:",
      err
    );

    res.status(500).json({

      error:
        "Unable to send hire request."

    });

  }

});

/*
=========================================
RATE BUSINESS
=========================================
*/

app.post("/rate", requireStudent, async (req, res) => {

  try {

    const { id, rating } = req.body;

// Verify the rating is valid

const ratingNumber = Number(rating);

if (
  !mongoose.isValidObjectId(id) ||
  !Number.isInteger(ratingNumber) ||
  ratingNumber < 1 ||
  ratingNumber > 5
) {
  return res.status(400).json({
    error: "Select a valid rating between 1 and 5."
  });
}

// Verify this student has hired this worker

const completedHire = await Request.findOne({
  businessId: id,
  studentPhone: req.student.phone,
  status: "Completed"
});

if (!completedHire) {
  return res.status(403).json({
    error: "You can only rate workers after completing a job with them."
  });
}

// Prevent repeated ratings for the same completed job

// Atomically claim this completed job for rating

const ratingClaim = await Request.findOneAndUpdate(
  {
    _id: completedHire._id,
    status: "Completed",
    reviewed: { $ne: true }
  },
  {
    $set: { reviewed: true }
  },
  {
    new: true
  }
);

if (!ratingClaim) {
  return res.status(409).json({
    error: "This completed job has already been rated."
  });
}
     
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

// Record that this completed job has been rated

completedHire.reviewed = true;

await completedHire.save();
     
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
GET STUDENT NOTIFICATIONS
====================================
*/

app.get("/student/notifications/:phone", requireStudent, async (req,res)=>{
try{

if (req.params.phone !== req.student.phone) {
  return res.status(403).json({
    error: "You cannot access another student's notifications."
  });
}

const notifications = await Notification.find({

receiverId:req.student.phone

}).sort({

createdAt:-1

});

res.json(notifications);

}catch(err){

console.log(err);

res.json([]);

}

});

/*
====================================
STUDENT NOTIFICATION UNREAD COUNT
====================================
*/

app.get("/student/notifications/:phone/unread-count", requireStudent, async (req, res) => {

try{

if (req.params.phone !== req.student.phone) {
  return res.status(403).json({
    error: "You cannot access another student's notifications."
  });
}

const count = await Notification.countDocuments({

receiverId:req.params.phone,

receiverType:"student",

read:false

});

res.json({

count

});

}catch(err){

console.log(err);

res.json({

count:0

});

}

});

app.get("/student/requests/:phone/unread-count", requireStudent, async (req, res) => {

  try{

if (req.params.phone !== req.student.phone) {
  return res.status(403).json({
    error: "You cannot access another student's request count."
  });
}
   
    const count = await Request.countDocuments({
      studentPhone: req.params.phone,
      viewed: false
    });

    res.json({ count });

  }catch(err){

    console.log(err);
    res.json({ count: 0 });

  }
});

app.post("/student/requests/viewed", requireStudent, async (req, res) => {

  try {

if (req.body.phone && req.body.phone !== req.student.phone) {
  return res.status(403).json({
    error: "You cannot update another student's requests."
  });
}
   
    await Request.updateMany(
  {
    studentPhone: req.student.phone,
    viewed: false
  },
  {
    $set: {
      viewed: true
    }
  }
);

    res.json({
      message: "Student requests marked as viewed."
    });

  } catch (err) {

    console.log(err);

    res.json({
      error: "Unable to mark requests as viewed."
    });

  }

});

/*
====================================
MARK STUDENT NOTIFICATIONS AS READ
====================================
*/

app.post("/student/notifications/read", requireStudent, async (req, res) => {

  try {

    // Get phone number from the verified student account
    const phone = req.student.phone;

    await Notification.updateMany(
      {
        receiverId: phone,
        receiverType: "student",
        read: false
      },
      {
        $set: {
          read: true
        }
      }
    );

    res.json({
      message: "Student notifications marked as read."
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Unable to update notifications."
    });

  }

});

/*
====================================
MARK ONE STUDENT NOTIFICATION READ
====================================
*/

app.post("/student/notifications/read-one", requireStudent, async (req, res) => {

  try {

    // Get notification ID from the browser
    const { notificationId } = req.body;

    // Get phone number from the verified student account
    const phone = req.student.phone;

    if (!notificationId) {

      return res.status(400).json({
        error: "Missing notification information."
      });

    }

    await Notification.updateOne(
      {
        _id: notificationId,
        receiverId: phone,
        receiverType: "student"
      },
      {
        $set: {
          read: true
        }
      }
    );

    res.json({
      message: "Notification marked as read."
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Unable to mark notification as read."
    });

  }

});

/*
====================================
GET BUSINESS NOTIFICATIONS
====================================
*/

app.get("/notifications/business/:businessId",async(req,res)=>{
  try{
    const notifications=await Notification.find({
      businessId:req.params.businessId,
      receiverType:"business"
    }).sort({createdAt:-1});

    res.json(notifications);
  }catch(err){
    console.log(err);
    res.json([]);
  }
});

/*
====================================
MARK BUSINESS NOTIFICATIONS AS READ
====================================
*/

app.post("/notifications/business/:businessId/read", async (req, res) => {
  try {
    await Notification.updateMany(
      {
        businessId: req.params.businessId,
        receiverType: "business",
        read: false
      },
      {
        $set: { read: true }
      }
    );

    res.json({
      message: "Business notifications marked as read."
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: err.message
    });
  }
});

/*
====================================
AUTO EXPIRE BUSINESSES
====================================
*/

app.get("/admin/check-expiry", requireAdmin, async (req, res) => {

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

      await Notification.create({

title:"Subscription Expired",

message:"Your subscription has expired. Renew now to continue receiving customers.",

receiverType:"business",

businessId:business._id,

type:"subscription"

});

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
BUSINESS ANALYTICS
====================================
*/

app.get("/business/:id/analytics", async (req,res)=>{

try{

const business = await Business.findById(req.params.id);

if(!business){

return res.json({
error:"Business not found"
});

}

res.json({

profileViews:business.profileViews,

searchAppearances:business.searchAppearances,

callClicks:business.callClicks,

whatsappClicks:business.whatsappClicks,

totalLeads:business.totalLeads,

jobsCompleted:business.jobsCompleted,

trustScore:business.trustScore,

rating:business.rating,

reviews:business.reviews

});

}catch(err){

console.log(err);

res.json({

error:"Unable to load analytics"

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
====================================
BUSINESS REQUEST COUNT
====================================
*/

app.get("/business/:id/requests/count", async (req,res)=>{

try{

const count = await Request.countDocuments({

businessId:req.params.id,

status:"Pending",

viewed:false

});

res.json({count});

}catch(err){

console.log(err);

res.json({count:0});

}

});

/*
====================================
MARK REQUESTS AS VIEWED
====================================
*/

app.post("/business/:id/requests/viewed", async (req,res)=>{

try{

await Request.updateMany(

{

businessId:req.params.id,

viewed:false

},

{

$set:{viewed:true}

}

);

res.json({

message:"Requests marked as viewed."

});

}catch(err){

console.log(err);

res.json({

error:"Unable to update requests."

});

}

});

/*
====================================
BUSINESS REVIEW COUNT
====================================
*/

app.get("/business/:id/reviews/count", async(req,res)=>{

try{

const business = await Business.findById(req.params.id);

if(!business){

return res.json({count:0});

}

const unreadReviews = business.reviewList.filter(r => !r.viewed);

res.json({

count: unreadReviews.length

});

}catch(err){

console.log(err);

res.json({count:0});

}

});

/*
====================================
CUSTOMER HISTORY COUNT
====================================
*/

app.get("/business/:id/history/count", async(req,res)=>{

try{

const count = await CustomerHistory.countDocuments({

businessId:req.params.id,

viewed:false

});

res.json({count});

}catch(err){

console.log(err);

res.json({count:0});

}

});

/*
====================================
SEND CHAT MESSAGE
====================================
*/

app.post("/chat/send", async (req,res)=>{

try{

const{
requestId,
businessId,
studentPhone,
studentName,
senderType,
message
}=req.body;

// =========================================
// BLOCK MESSAGES AFTER JOB COMPLETION
// =========================================

if (!mongoose.isValidObjectId(requestId)) {
  return res.status(400).json({
    error: "Invalid conversation ID."
  });
}

// =========================================
// VALIDATE CHAT SENDER TYPE
// =========================================

if (
  senderType !== "student" &&
  senderType !== "business"
) {
  return res.status(400).json({
    error: "Invalid chat sender type."
  });
}

const hireRequest = await Request.findById(requestId);

if (!hireRequest) {
  return res.status(404).json({
    error: "Conversation not found."
  });
}

// =========================================
// VERIFY STUDENT CHAT IDENTITY
// =========================================

if (senderType === "student") {

  const authorization = req.headers.authorization || "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  const session = verifyStudentToken(token);

  if (!session) {
    return res.status(401).json({
      error: "Please log in to send messages."
    });
  }

  const loggedInStudent = await Student.findById(session.studentId);

  if (
    !loggedInStudent ||
    (loggedInStudent.sessionVersion ?? 0) !== session.sessionVersion
  ) {
    return res.status(401).json({
      error: "Your login session has expired. Please log in again."
    });
  }

  if (hireRequest.studentPhone !== loggedInStudent.phone) {
    return res.status(403).json({
      error: "You cannot send messages in another student's conversation."
    });
  }

}

// =========================================
// VERIFY BUSINESS CHAT IDENTITY
// =========================================

if (senderType === "business") {

  const authorization = req.headers.authorization || "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  const session = verifyBusinessToken(token);

  if (!session) {
    return res.status(401).json({
      error: "Please log in as a business owner to send messages."
    });
  }

  const loggedInBusiness = await Business.findById(
    session.businessId
  );

  if (
    !loggedInBusiness ||
    (loggedInBusiness.sessionVersion ?? 0) !== session.sessionVersion
  ) {
    return res.status(401).json({
      error: "Your business session has expired. Please log in again."
    });
  }

  if (
    hireRequest.businessId.toString() !==
    loggedInBusiness._id.toString()
  ) {
    return res.status(403).json({
      error: "You cannot send messages in another business owner's conversation."
    });
  }

}

// Get the student's actual name from the hire request
const actualStudentName =
  hireRequest.studentName?.trim() ||
  "A student";

if (hireRequest.status === "Completed") {
  return res.status(403).json({
    error: "This service has been completed. You can no longer send messages in this conversation. Hire this professional again to start a new chat.",
    chatLocked: true
  });
}

if (hireRequest.status === "Declined") {
  return res.status(403).json({
    error: "This service request was declined. Messaging is unavailable.",
    chatLocked: true
  });
}

const chat = await Chat.create({

requestId: hireRequest._id,
businessId: hireRequest.businessId,
studentPhone: hireRequest.studentPhone,
studentName: actualStudentName,
senderType,
message,
unread: true,
read: false

});

if (senderType === "student") {

  await Notification.create({

    title: "New Message",

    message: `${actualStudentName} sent you a message.`,

    receiverType: "business",

    businessId: hireRequest.businessId,

    requestId: hireRequest._id,

    type: "chat"

  });

} else {

  await Notification.create({

    title: "New Message",

    message: "You have received a new message.",

    receiverType: "student",

    receiverId: hireRequest.studentPhone,

    requestId: hireRequest._id,

    businessId: hireRequest.businessId,

    type: "chat"

  });

}

res.json({

message:"Message sent ✔",

chat

});

}catch(err){

console.log(err);

res.json({

error:"Unable to send message."

});

}

});

/* =========================================
   SECURE CHAT MESSAGE READING
========================================= */

app.get("/chat/messages/:requestId", async (req, res) => {

  try {

    const requestId = req.params.requestId;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        error: "Invalid conversation ID."
      });
    }

    const hireRequest = await HireRequest.findById(requestId);

    if (!hireRequest) {
      return res.status(404).json({
        error: "Conversation not found."
      });
    }

    const authorization = req.headers.authorization || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    let authorized = false;

    // CHECK STUDENT LOGIN

    const studentSession = verifyStudentToken(token);

    if (studentSession) {

      const student = await Student.findById(
        studentSession.studentId
      );

      if (
        student &&
        (student.sessionVersion ?? 0) ===
          studentSession.sessionVersion &&
        student.phone === hireRequest.studentPhone
      ) {
        authorized = true;
      }

    }

    // CHECK BUSINESS OWNER LOGIN

    if (!authorized) {

      const businessSession = verifyBusinessToken(token);

      if (businessSession) {

        const business = await Business.findById(
          businessSession.businessId
        );

        if (
          business &&
          (business.sessionVersion ?? 0) ===
            businessSession.sessionVersion &&
          hireRequest.businessId &&
          hireRequest.businessId.toString() ===
            business._id.toString()
        ) {
          authorized = true;
        }

      }

    }

    if (!authorized) {
      return res.status(403).json({
        error: "You are not authorized to read this conversation."
      });
    }

    const messages = await Chat.find({
      requestId: requestId
    }).sort({
      createdAt: 1
    });

    return res.json(messages);

  } catch (error) {

    console.error("CHAT MESSAGES ERROR:", error);

    return res.status(500).json({
      error: "Unable to load chat messages."
    });

  }

});

/* =========================================
   SECURE LAST CHAT MESSAGE
========================================= */

app.get("/chat/last/:requestId", async (req, res) => {

  try {

    const requestId = req.params.requestId;

    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({
        error: "Invalid conversation ID."
      });
    }

    const hireRequest = await Request.findById(requestId);

    if (!hireRequest) {
      return res.status(404).json({
        error: "Conversation not found."
      });
    }

    const authHeader = req.headers.authorization || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    let authorized = false;

    // Verify student ownership
    const studentSession = verifyStudentToken(token);

    if (studentSession) {

      const student = await Student.findById(
        studentSession.studentId
      );

      if (
        student &&
        (student.sessionVersion ?? 0) ===
          studentSession.sessionVersion &&
        student.phone === hireRequest.studentPhone
      ) {
        authorized = true;
      }

    }

    // Verify business ownership
    if (!authorized) {

      const businessSession = verifyBusinessToken(token);

      if (businessSession) {

        const business = await Business.findById(
          businessSession.businessId
        );

        if (
          business &&
          (business.sessionVersion ?? 0) ===
            businessSession.sessionVersion &&
          hireRequest.businessId &&
          hireRequest.businessId.toString() ===
            business._id.toString()
        ) {
          authorized = true;
        }

      }

    }

    if (!authorized) {
      return res.status(403).json({
        error: "You cannot access this conversation."
      });
    }

    const message = await Chat.findOne({
      requestId: requestId
    }).sort({
      createdAt: -1
    });

    return res.json(message || {});

  } catch (error) {

    console.error("LAST CHAT MESSAGE ERROR:", error);

    return res.status(500).json({
      error: "Unable to load the last message."
    });

  }

});

/* =========================================
   SECURE MARK MESSAGES AS READ
========================================= */

app.post("/chat/read/:requestId", async (req, res) => {

  try {

    const requestId = req.params.requestId;

    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({
        error: "Invalid conversation ID."
      });
    }

    const hireRequest = await Request.findById(requestId);

    if (!hireRequest) {
      return res.status(404).json({
        error: "Conversation not found."
      });
    }

    const authHeader = req.headers.authorization || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    let readerType = null;

    // VERIFY STUDENT

    const studentSession = verifyStudentToken(token);

    if (studentSession) {

      const student = await Student.findById(
        studentSession.studentId
      );

      if (
        student &&
        (student.sessionVersion ?? 0) ===
          studentSession.sessionVersion &&
        student.phone === hireRequest.studentPhone
      ) {
        readerType = "student";
      }

    }

    // VERIFY BUSINESS OWNER

    if (!readerType) {

      const businessSession = verifyBusinessToken(token);

      if (businessSession) {

        const business = await Business.findById(
          businessSession.businessId
        );

        if (
          business &&
          (business.sessionVersion ?? 0) ===
            businessSession.sessionVersion &&
          hireRequest.businessId &&
          hireRequest.businessId.toString() ===
            business._id.toString()
        ) {
          readerType = "business";
        }

      }

    }

    if (!readerType) {
      return res.status(403).json({
        error: "You cannot access this conversation."
      });
    }

    await Chat.updateMany(
      {
        requestId: requestId,
        senderType: readerType === "student"
          ? "business"
          : "student",
        read: false
      },
      {
        $set: {
          read: true,
          unread: false
        }
      }
    );

    return res.json({
      message: "Messages marked as read ✔"
    });

  } catch (error) {

    console.error("CHAT READ ERROR:", error);

    return res.status(500).json({
      error: "Unable to mark messages as read."
    });

  }

});

/* =========================================
   SECURE BUSINESS UNREAD MESSAGE COUNT
========================================= */

app.get("/chat/unread/:businessId", requireBusiness, async (req, res) => {

  try {

    const requestedBusinessId = req.params.businessId;

    const loggedInBusinessId =
      req.business._id.toString();

    // Prevent access to another owner's messages
    if (requestedBusinessId !== loggedInBusinessId) {

      return res.status(403).json({
        error: "You cannot access another business owner's messages."
      });

    }

    const count = await Chat.countDocuments({

      businessId: loggedInBusinessId,

      senderType: "student",

      read: false

    });

    return res.json({ count });

  } catch (error) {

    console.error("BUSINESS UNREAD COUNT ERROR:", error);

    return res.status(500).json({
      error: "Unable to load unread messages."
    });

  }

});

/* =========================================
   SECURE BUSINESS CONVERSATIONS
========================================= */

app.get("/chat/business/:businessId", requireBusiness, async (req, res) => {

  try {

    const requestedBusinessId = req.params.businessId;

    const loggedInBusinessId =
      req.business._id.toString();

    // Prevent access to another business owner's chats
    if (requestedBusinessId !== loggedInBusinessId) {

      return res.status(403).json({
        error: "You cannot access another business owner's conversations."
      });

    }

    const requests = await Request.find({
      businessId: loggedInBusinessId
    }).sort({
      createdAt: -1
    });

    return res.json(requests);

  } catch (error) {

    console.error("BUSINESS CONVERSATIONS ERROR:", error);

    return res.status(500).json({
      error: "Unable to load conversations."
    });

  }

});

/*
====================================
GET SINGLE REQUEST
====================================
*/

app.get("/request/:id", async (req,res)=>{

try{

const request = await Request.findById(req.params.id);

if(!request){

return res.json({
error:"Request not found"
});

}

res.json(request);

}catch(err){

console.log(err);

res.json({
error:"Unable to load request"
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
MARK REVIEWS AS VIEWED
====================================
*/

app.post("/business/:id/reviews/viewed", async(req,res)=>{

try{

const business = await Business.findById(req.params.id);

if(!business){

return res.json({

error:"Business not found"

});

}

business.reviewList.forEach(review=>{

review.viewed = true;

});

await business.save();

res.json({

message:"Reviews marked as viewed."

});

}catch(err){

console.log(err);

res.json({

error:"Unable to update reviews."

});

}

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

await Notification.create({

title:"New Review",

message:`${studentName} left a ${rating}⭐ review.`,

receiverType:"business",

businessId:business._id,

type:"review"

});

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

/*
====================================
MARK CUSTOMER HISTORY AS VIEWED
====================================
*/

app.post("/customer-history/:businessId/viewed", async (req,res)=>{

try{

await CustomerHistory.updateMany(

{

businessId:req.params.businessId,

viewed:false

},

{

$set:{viewed:true}

}

);

res.json({

message:"Customer history marked as viewed."

});

}catch(err){

console.log(err);

res.json({

error:"Unable to update customer history."

});

}

});
