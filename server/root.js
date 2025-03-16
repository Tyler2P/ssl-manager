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

    let [dnsProfiles] = await dbPool.query("SELECT id, name FROM dns_profiles");

    sendPage(req, res, "dashboard/overview.ejs", {
      dnsProfiles,
      defaultDnsProfile: Array.isArray(dnsProfiles) ? dnsProfiles.find((x) => x.id === cache.config.defaultProfile) : null
    });
  });

  return router;
}