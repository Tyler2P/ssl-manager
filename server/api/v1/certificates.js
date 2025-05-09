const PermissionBitfield = require("../../../utils/permissions").default;
const cache = require("../../../utils/cache");
const { createCert } = require("../../../utils/certificate-handler");
const { users, hasNumber, API, getDB, generateId } = require("../../../utils/functions");
const { checkRequest, getAuth } = require("../../../utils/functions").API;
const acme = require("acme-client");
const router = require("express").Router();

module.exports = function(dbPool) {
  router.all("/:version/certificates/create", async function(req, res) {
    const checkReq = await checkRequest(req, res, { versionEnabled: true, authHeader: true, allowedMethods: ["POST"] }, true);
    if (!checkReq?.bool) return;

    // Ensure the user is authenticated
    let user = checkReq.user;
    if (!user) user = await users.findByOauth(API.getAuth(req.headers));
    if (!user)
      return res.status(401).json({ error: "Unauthorized Request", code: 4010 });
    const userPerms = new PermissionBitfield(BigInt(user.permissions));
    if (!userPerms.has("CreateCertificates"))
      return res.status(403).json({ error: "Permission denied", code: 4013 });

    // Get expected variables
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
      errors.push({ msg: "At least one valid domain must be provided", type: "domains" });
    
    if (errors.length > 0)
      return res.status(400).json({ errors, code: 4015 });

    if (cache.config.defaultProfile && !profile)
      profile = cache.config.defaultProfile;
    else if (!profile)
      errors.push({ msg: "Invalid DNS Profile provided", type: "dns-profile" });

    if (!description || description === "")
      description = null;
    if (!type || !["staging", "production"].includes(type?.toLowerCase()))
      type = 1; // Set to PRODUCTION
    else
      type = type.toUpperCase().replace("PRODUCTION", 1).replace("STAGING", 2);

    if (domain && domains)
      domains.push(domain);
    else if (!domains)
      domains = [domain];

    // Remove duplicate domains
    domains = [...new Set(domains)];

    if (domains.length > 40)
      errors.push({ msg: "Too many domains provided", type: "domains" });
    if (domains.length < 1)
      errors.push({ msg: "At least one valid domain must be provided", type: "domains" });

    if (errors.length > 0)
      return res.status(400).json({ errors, code: 4015 });

    // Ensure the domains are valid
    const domainRegex =  /^(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}\.)*(xn--)?([a-z0-9][a-z0-9\-]{0,60}|[a-z0-9-]{1,30}\.[a-z]{2,})$/;
    const validDomains = domains.filter(domain => domain.match(domainRegex));
    if (validDomains.length !== domains.length)
      return res.status(400).json({ error: "Invalid domain(s) provided", code: 4006 });

    // Fetch a database connection
    const db = await dbPool.getConnection();

    // Ensure the name isn't already in use
    let [existingCertificateName] = await db.query("SELECT * FROM certificates WHERE name = ?", [name]);
    if (existingCertificateName[0])
      return res.status(400).json({ error: "A certificate with the provided name already exists", code: 4402 });
    // Ensure the domain doesn't exist in an existing certificate
    for await (let domain of domains) {
      let [existingCertificate] = await db.query("SELECT * FROM certificates WHERE FIND_IN_SET(?, domains) AND disabled=0 AND type=?", [domain, type]);
      if (existingCertificate[0])
        return res.status(400).json({ error: "One or more domains are already in use by another certificate", domain, code: 4401 });
    }

    // Fetch profile
    let [dnsProfile] = await db.query("SELECT * FROM dns_profiles WHERE id = ?", [profile]);
    if (!dnsProfile[0])
      return res.status(400).json({ error: "Invalid DNS Profile provided", code: 4002 });

    dnsProfile = dnsProfile[0];

    const certId = generateId(25);

    // Update the database
    await db.query("INSERT INTO certificates (id, name, description, created_by, type, domains, dns_profile) VALUES (?, ?, ?, ?, ?, ?, ?)", [certId, name, description, user.user_id, type, domains.join(","), dnsProfile.id]);

    return res.status(200).json({ id: certId });
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