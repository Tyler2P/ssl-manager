const cache = require("../../../utils/cache");
const { createCert } = require("../../../utils/certificate-handler");
const { users, hasNumber } = require("../../../utils/functions");
const { checkRequest, getAuth } = require("../../../utils/functions").API;
const acme = require("acme-client");
const router = require("express").Router();

module.exports = function(dbPool) {
  router.all("/:version/certificates/create", async function(req, res) {
    const checkReq = await checkRequest(req, res, { versionEnabled: true, authHeader: true, allowedMethods: ["POST"] }, true);
    if (!checkReq?.bool) return;

    let name = (req.body.name)?.trim();
    let description = (req.body.description)?.trim();
    let domain = (req.body.domain)?.trim();
    let domains = req.body.domains;
    let profile = req.body.provider;

    let errors = [];

    // Ensure required variables are valid
    if (!name || name.length < 3 || name.length > 255)
      errors.push({ msg: "Invalid name provided", type: "name" });
    if (!domain && !Array.isArray(domains))
      errors.push({ msg: "At least one domain must be provided", type: "domains" });
    
    if (errors.length > 0)
      return res.status(400).json({ errors, code: 4015 });

    if (cache.config.defaultProfile && !profile)
      profile = cache.config.defaultProfile;
    else if (!profile)
      errors.push({ msg: "Invalid DNS Profile provided", type: "dns_profile" });

    if (!description || description === "")
      description = null;

    if (domain && domains)
      domains.push(domain);
    else if (!domains)
      domains = [domain];

    if (domains.length > 40)
      errors.push({ msg: "Too many domains provided", type: "domains" });

    if (errors.length > 0)
      return res.status(400).json({ errors, code: 4015 });

    const domainRegex =  /^(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}\.)*(xn--)?([a-z0-9][a-z0-9\-]{0,60}|[a-z0-9-]{1,30}\.[a-z]{2,})$/;
    const validDomains = domains.filter(domain => domain.match(domainRegex));
    if (validDomains.length !== domains.length)
      return res.status(400).json({ error: "Invalid domain(s) provided", code: 4006 });

    // Fetch a database connection
    const db = await dbPool.getConnection();

    // Fetch profile
    let [dnsProfile] = await db.query("SELECT * FROM dns_profiles WHERE id = ?", [profile]);
    if (!dnsProfile[0])
      return res.status(400).json({ error: "Invalid DNS Profile provided", code: 4002 });

    dnsProfile = dnsProfile[0];

    createCert(domains, cache.config.emailAddress, dnsProfile);
  });

  return router;
}