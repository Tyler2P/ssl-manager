const { checkRequest, sendPage } = require("../utils/functions");
const cache = require("../utils/cache");
const router = require("express").Router();

module.exports = function(dbPool) {
  router.get(["/", "/dashboard"], async function(req, res) {
    // Ensure the site has been setup
    if (cache.firstSetup === true)
      return res.status().redirect("/first-setup");

    const checkReq = await checkRequest(req, res, { authCookie: true, authType: "Authorized" }, true);
    if (!checkReq?.bool) return;

    sendPage(req, res, "dashboard/overview.ejs");
  });

  return router;
}