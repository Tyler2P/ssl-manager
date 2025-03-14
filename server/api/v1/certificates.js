const cache = require("../../../utils/cache");
const { createCert } = require("../../../utils/certificate-handler");
const { users, hasNumber, API, getDB } = require("../../../utils/functions");
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
    let profile = req.body.provider || req.body.profile;
    let type = req.body.type;

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
      errors.push({ msg: "Invalid DNS Profile provided", type: "dns-profile" });

    if (!description || description === "")
      description = null;
    if (!type || !["staging", "production"].includes(type?.toLowerCase()))
      type = "production";
    else
      type = type.toUpperCase();

    if (domain && domains)
      domains.push(domain);
    else if (!domains)
      domains = [domain];

    console.log("domains:");
    console.log(domains);

    // Remove duplicate domains
    domains = [...new Set(domains)];

    console.log(domains);
    console.log(domains.length);
    console.log(domains.length < 1);

    if (domains.length > 40)
      errors.push({ msg: "Too many domains provided", type: "domains" });
    if (domains.length < 1)
      errors.push({ msg: "At least one valid domain must be provided", type: "domains" });

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

    let user = checkReq.user;
    if (!user) user = await users.findByOauth(API.getAuth(req.headers));
    if (!user)
      return res.status(401).json({ error: "Unauthorized Request", code: 4010 });

    // Update the database
    await db.query("INSERT INTO certificates (name, description, created_by, type, domains, dns_profile) VALUES (?, ?, ?, ?, ?, ?)", [name, description, user.user_id, type, domains.join(","), dnsProfile.id]);

    return res.status(204).send();
  });
  router.all("/:version/certificates/:id/update", async function(req, res) {
    const checkReq = await checkRequest(req, res, { versionEnabled: true, authHeader: true, allowedMethods: ["POST", "PUT"] }, true);
    if (!checkReq?.bool) return;

    let name = (req.body.name)?.trim();
    let description = (req.body.description)?.trim();
    let domain = (req.body.domain)?.trim();
    let domains = req.body.domains;
    let profile = req.body.provider || req.body.profile;
    let type = req.body.type;

    let errors = [];

    // Ensure required variables are valid
    if (name && (name.length < 3 || name.length > 255))
      errors.push({ msg: "Invalid name provided", type: "name" });
    
    if (errors.length > 0)
      return res.status(400).json({ errors, code: 4015 });

    if (!description || description === "")
      description = null;
    if (type && !["staging", "production"].includes(type?.toLowerCase()))
      return res.status(400).json({ errors: [{ msg: "Invalid certificate type provided", type: "type"}], code: 4015 });
    else
      type = type.toUpperCase();

    // Fetch a database connection
    const db = await dbPool.getConnection();

    if (req.method.toUpperCase() === "PUT") {
      if (domain && domains)
        domains.push(domain);
      else if (!domains && domain)
        domains = [domain];
    } else {
      // Fetch current certificate
      let [certificate] = await db.query("SELECT * FROM certificates WHERE id = ?", [req.params.id]);
      if (!Array.isArray(certificate) || certificate.length < 1) return res.status(400).json({ error: "Invalid certificate ID provided", code: 4004 });
      certificate = certificate[0];

      if (domain && domains)
        domains.push(domain);
      else if (!domains && domain)
        domains = [domain];

      // Combine domains array
      domains = domains.concat(certificate.domains.split(","));
    }

    // Remove duplicate domains
    domains = [...new Set(array)];

    if (domains.length > 40)
      errors.push({ msg: "Too many domains provided", type: "domains" });
    if (domains.length < 1)
      errors.push({ msg: "At least 1 valid domain must be provided", type: "domains" });

    if (errors.length > 0)
      return res.status(400).json({ errors, code: 4015 });

    const domainRegex =  /^(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}\.)*(xn--)?([a-z0-9][a-z0-9\-]{0,60}|[a-z0-9-]{1,30}\.[a-z]{2,})$/;
    const validDomains = domains.filter(domain => domain.match(domainRegex));
    if (validDomains.length !== domains.length)
      return res.status(400).json({ error: "Invalid domain(s) provided", code: 4006 });

    // Fetch profile
    let dnsProfile;
    if (profile) {
      [dnsProfile] = await db.execute("SELECT * FROM dns_profiles WHERE id = ?", [profile]);
      if (!dnsProfile[0])
        return res.status(400).json({ error: "Invalid DNS Profile provided", code: 4002 });

      dnsProfile = dnsProfile[0];
    }

    let user = checkReq.user;
    if (!user) user = await users.findByOauth(API.getAuth(req.headers));
    if (!user)
      return res.status(401).json({ error: "Unauthorized Request", code: 4010 });

    // Update the database
    if (req.method.toUpperCase() === "PUT") {
      await db.query(`UPDATE certificates SET (name=?, description=?, type=?, domains=?${profile && dnsProfile ? ", dns_profile=?" : ""}) WHERE id = ?`, [name, description, type, domains.join(","), dnsProfile.id, req.params.id]);
    } else {
      let params = [];
      let values = [];

      if (name) {
        params.push("name");
        values.push(name);
      }
      if (description) {
        params.push("description");
        values.push(description);
      }
      if (domains) {
        params.push("domains");
        values.push(domains.join(","));
      }
      if (profile) {
        params.push("profile");
        values.push(dnsProfile.id);
      }
      if (type) {
        params.push("type");
        values.push(type);
      }

      if (params.length < 1 || values.length < 1)
        return res.status(400).json({ error: "No changed detected. No changes were saved", code: 4002 });

      await db.query(
        `UPDATE certificates SET (name=?, description=?, type=?, domains=?${profile && dnsProfile ? ", dns_profile=?" : ""}) WHERE id = ?`,
        profile && dnsProfile ? [name, description, type, domains.join(","), dnsProfile.id, req.params.id] : [name, description, type, domains.join(","), req.params.id]
      );
    }

    return res.status(204).send();
  });

  return router;
}