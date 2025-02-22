const { sendPage } = require("../utils/functions");
const router = require("express").Router();
const cache = require("../utils/cache");

module.exports = function(dbPool) {
  router.get("/first-setup", (req, res) => {
    // Ensure the site has not been setup yet
    if (cache.firstSetup === false) return res.redirect("/");

    // Send the welcome page
    sendPage(req, res, "first-setup/welcome.ejs");
  });
  router.get("/first-setup/create-account", (req, res) => {
    // Ensure the site has not been setup yet
    if (cache.firstSetup === false) return res.redirect("/");

    // Send the create-account page
    sendPage(req, res, "first-setup/create-account.ejs");
  });

  return router;
}