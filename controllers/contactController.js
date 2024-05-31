const petsCollection = require("../db").db().collection("pets")
const sanitizeHtml = require("sanitize-html")
const sgMail = require('@sendgrid/mail')
const { ObjectId } = require("mongodb")


const sanitizeOptions = {
   allowedTags: [],
   allowedAttributes: {}
 }
 

exports.submitContact = async function (req, res) {
   if (req.body.secret.toUpperCase() !== "MAGIC") {
      console.log("spam detected");
      return res.json({error: "error due to spam detected"});
   }

   // invalid id detection
   if (!ObjectId.isValid(req.body.petId)) {
      console.log("invalid id detected");
      return res.json({error: "error due to invalid id detected"});
   }

   // does pet exists a check based on the petId to the database
   const pet = await petsCollection.findOne({_id: ObjectId.createFromHexString(req.body.petId)});

   if (!pet) {
      console.log("pet not found");
      return res.json({error: "error due to pet not found"});
   }
   
   const finalObject = {
      name: sanitizeHtml(req.body.name, sanitizeOptions),
      email: sanitizeHtml(req.body.email, sanitizeOptions),
      comment: sanitizeHtml(req.body.comment, sanitizeOptions)
   }

   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   const msg = {
      to: finalObject.email,
      from: 'ainbmor@gmail.com',
      subject: `Thank you for your interest in our pet ${pet.name}.`,
      text: finalObject.comment,
      html: `<h3 style="color:blue;">Thank you for your interest in our pet ${pet.name}.</h3><br><p>We appreciate your interest in ${pet.name} and one of the 
             staff member will reach out to you shortly.</p>
             <p>Below is the email that you send us for the record purpose.</p>
             <p><em>${finalObject.comment}</em></p><br><p>Best regards, Ain Mor</p>`,
   };
   try {
      await sgMail.send(msg);
    } catch (error) {
      console.error(error);
  
      if (error.response) {
        console.error(error.response.body)
      }
    }   

    const msg_to_owner = {
      to: 'ainbmor@gmail.com',
      from: 'ainbmor@gmail.com',
      subject: `Thank you for your interest in our pet ${pet.name}.`,
      text: finalObject.comment,
      html: `<h3 style="color:blue;">You have got the customer who is interested on the pet ${pet.name}.</h3><br><p>Kindly make an appointment to the 
            customer <strong>${finalObject.email}</strong> and inform the sales department immediately to contact the customer for further process.</p>
             <p>Below is the email that we have received from the customer ${finalObject.name}.</p>
             <p><em>${finalObject.comment}</em></p><br><p>Best regards, Ain Mor</p>`,
   };

   try {
      await sgMail.send(msg_to_owner);
    } catch (error) {
      console.error(error);
  
      if (error.response) {
        console.error(error.response.body)
      }
    } 

   console.log("submitContact: ",finalObject);
   res.send("thanks for contacting us!  We will get back to you shortly.");
}
