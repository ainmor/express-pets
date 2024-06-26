const sanitizeHtml = require("sanitize-html")
const sgMail = require('@sendgrid/mail')
const { SMTPServer } = require('smtp-server');
const simpleParser = require('mailparser').simpleParser;
const validator = require('validator');
const { ObjectId } = require("mongodb")
const fs = require('fs');
const petsCollection = require("../db").db().collection("pets")
const contactsCollection = require("../db").db().collection("contacts")

// Read the private key and certificate
const privateKey = fs.readFileSync('/Users/ainmor/private-key.pem', 'utf8');
const certificate = fs.readFileSync('/Users/ainmor/cert.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };
const passphrase = process.env.PASSWORD_PHRASE; // Provide the correct passphrase here

const certOptions = {
   secure: true,
   key: credentials.key,
   cert: credentials.cert,
   passphrase: passphrase, // Provide the correct passphrase when loading the private key
};


const sanitizeOptions = {
   allowedTags: [],
   allowedAttributes: {}
 }
 

exports.submitContact = async function (req, res) {
   if (req.body.secret.toUpperCase() !== "PUPPY") {
      console.log("spam detected");
      return res.json({error: "error due to spam detected"});
   }


   if (typeof req.body.name !== "string" || req.body.name.trim() === "") { 
      req.body.name = "";
      console.log("invalid name detected");
      return res.json({error: "error due to invalid name detected"});
   }

   if (typeof req.body.email !== "string" || req.body.email.trim() === "") {
      req.body.email = "";
      console.log("invalid email detected");
      return res.json({error: "error due to invalid email detected"});
   }

   if (typeof req.body.comment !== "string" || req.body.comment.trim() === "") {
      req.body.comment = "";
      console.log("invalid comment detected");
      return res.json({error: "error due to invalid comment detected"});
   }

   // invalid email detection
   if (!validator.isEmail(req.body.email)) {
      console.log("invalid email detected");
      return res.json({error: "error due to invalid email detected"});
   }


   // invalid id detection
   if (!ObjectId.isValid(req.body.petId)) {
      console.log("invalid id detected");
      return res.json({error: "error due to invalid id detected"});
   }

   req.body.petId = ObjectId.createFromHexString(req.body.petId);
   // does pet exists a check based on the petId to the database
   const pet = await petsCollection.findOne({_id: req.body.petId});

   if (!pet) {
      console.log("pet not found");
      return res.json({error: "error due to pet not found"});
   }
   
   const finalObject = {
      petId: req.body.petId,
      name: sanitizeHtml(req.body.name, sanitizeOptions),
      email: sanitizeHtml(req.body.email, sanitizeOptions),
      comment: sanitizeHtml(req.body.comment, sanitizeOptions)
   }

   // sgMail.setApiKey(process.env.SENDGRID_API_KEY);


   const server = new SMTPServer({
       // Enable TLS
      secure: true, 
      ...certOptions, 
      authOptional: true,
      onData(stream, session, callback) {
         stream.on('data', (chunk) => {
             console.log('Message chunk:', chunk.toString());
         });
 
         stream.on('end', () => {
             console.log('Message received');
             callback(null, // Error first callback, null means successful
                 'Message received and processed');
         });
     },
   });

   server.listen(465, () => {
      console.log('SMTP Server is running on port 465');
  });

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
      service: 'Gmail', // Use your email service provider
      auth: {
         user: process.env.USER_NAME,
         pass: process.env.PASSWORD // Use an app password generated from your Google account
      }, 
      port: 465,
      secure: true, // Use TLS
      tls: {
         // Do not fail on invalid certs
         rejectUnauthorized: false
     }
  });

   console.log("finalObject email: ", finalObject.email);

   const mailOptions = {
      to: finalObject.email,
      from: 'ainbmor@gmail.com',
      subject: `Thank you for your interest in our pet ${pet.name}.`,
      text: finalObject.comment,
      html: `<h3 style="color:blue;">Thank you for your interest in our pet ${pet.name}.</h3><br><p>We appreciate your interest in ${pet.name} and one of the 
             staff member will reach out to you shortly.</p>
             <p>Below is the email that you send us for the record purpose.</p>
             <p><em>${finalObject.comment}</em></p><br><p>Best regards, Ain Mor</p>`,
   };
  

    const msg_to_owner = {
      to: 'ainbmor@gmail.com',
      from: 'ainbmor@gmail.com',
      subject: `You have an email who is interested on the pet ${pet.name}.`,
      text: finalObject.comment,
      html: `<h3 style="color:blue;">You have got the customer who is interested on the pet ${pet.name}.</h3><br><p>Kindly make an appointment to the 
            customer <strong>${finalObject.email}</strong> and inform the sales department immediately to contact the customer for further process.</p>
             <p>Below is the email that we have received from the customer ${finalObject.name}.</p>
             <p><em>${finalObject.comment}</em></p><br><p>Best regards, Ain Mor</p>`,
   }; 
     

   try {
      // Send the email to the customer
      const promise1 = transporter.sendMail(mailOptions, async (error, info) => {
         if (error) {
            return console.log(`Error: ${error}`);
      }
      console.log('Email sent: ' + info.response);

      // Send the email to the owner
      const promise2 = transporter.sendMail(msg_to_owner, (error, info) => {
         if (error) {
            return console.log(`Error: ${error}`);
        }
        console.log('Email sent: ' + info.response);
      });

      // save the contact to the database
      const contact = await contactsCollection.insertOne(finalObject);

      await Promise.all([promise1, promise2, contact]);
   });
   } catch (error) {
      console.error(error);
  
      if (error.response) {
        console.error(error.response.body)
      }      
   }  

   console.log("submitContact: ",finalObject);
   res.send("thanks for contacting us!  We will get back to you shortly.");
}


exports.viewPetContacts = async function (req, res) {
   if (!ObjectId.isValid(req.params.id)) {
      console.log("invalid id detected");
      return res.redirect("/")
   }

   // find the contacts based on the petId
   const pet = await petsCollection.findOne({_id: ObjectId.createFromHexString(req.params.id)});
      
   if (!pet) {
      console.log("pet not found");
      return res.redirect("/")
   } 

   const contacts = await contactsCollection.find({petId: ObjectId.createFromHexString(req.params.id)}).toArray()
   res.render("pet-contacts", {contacts, pet})
}
