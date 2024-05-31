exports.submitContact = function (req, res) {
   console.log("submitContact");
   console.log(req.body);
   res.send("thanks for contacting us!  We will get back to you shortly.");
}
