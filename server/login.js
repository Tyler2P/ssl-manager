const { sendPage, checkRequest } = require("../utils/functions");
const cache = require("../utils/cache");
const { users } = require("../utils/functions");
const router = require("express").Router();

module.exports = function(dbPool) {
  router.get("/login", async function(req, res) {
    // Ensure the site has been setup
    if (cache.firstSetup === true)
      return res.status(307).redirect("/first-setup");

    sendPage(req, res, "login/template", { page: "login", allowRegistrations: !!cache.config.allowRegistrations });
  });
  router.get("/login/mfa", async function(req, res) {
    // Ensure the site has been setup
    if (cache.firstSetup === true)
      return res.status(307).redirect("/first-setup");
    if (!req.cookies["pre-auth"] && !req.query.token) return res.status(307).redirect("/auth/login");

    sendPage(req, res, "login/template", { page: "mfa", token: req.cookies["pre-auth"] || req.query.token });
  });
  router.get("/register", async function(req, res, next) {
    // Ensure the site has been setup
    if (cache.firstSetup === true)
      return res.status(307).redirect("/first-setup");
    // Ensure new registrations are enabled
    if (cache.config?.allowRegistrations !== true) return next();

    sendPage(req, res, "login/template", { page: "register" });
  });

  // Account Alterations (Reset Password, etc)
  router.get(["/login/alterations", "/login/alteration"], async function(req, res) {
    // Ensure the site has been setup
    if (cache.firstSetup === true)
      return res.status(307).redirect("/first-setup");
    const checkReq = await checkRequest(req, res, { authCookie: true, authType: "Authorized", redirectAccountAlterations: false }, true);
    if (!checkReq?.bool) return;

    let user = checkReq.user || (await users.findByOauth(req.cookies.auth, { ignoreInvalidVariables: true }));

    if (!user) return res.status(401).redirect("/auth/login");

    if (user.reset_password === 1) {
      return sendPage(req, res, "login/template", { page: "reset-password" });
    }

    sendPage(req, res, "errors/custom", { title: "No Alterations Required", description: "Your account does not require any alterations, please continue to the dashboard" });
  });

  return router;
}