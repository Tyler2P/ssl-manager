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

    // Generate an SSL certificate
    // const client = new acme.Client({
    //   directoryUrl: acme.directory.letsencrypt.production,
    //   accountKey: await acme.forge.createPrivateKey()
    // });

    // const [key, csr] = await acme.forge.createCsr({
    //   commonName: domain,
    //   altNames: domains
    // });

    // const privateRsaKey = await acme.crypto.createPrivateRsaKey();
    // const privateEcdsaKey = await acme.crypto.createPrivateEcdsaKey();

    // const [certificateKey, certificateCsr] = await acme.crypto.createCsr({
    //   altNames: domains
    // });

    // console.log("privateRsaKey: " + privateRsaKey);
    // console.log("privateEcdsaKey: " + privateEcdsaKey);

    
    // const [keyPem, csrPem] = await Promise.all([key.export(), csr.export()]);

    // // Save the CSR and key to the SSL certs directory
    // const certDir = `${cache.config.sslCertsDir}/${domain}`;
    // const csrFile = `${certDir}/${domain}.csr`;
    // const keyFile = `${certDir}/${domain}.key`;

    // await fs.mkdir(certDir, { recursive: true });
    // await fs.writeFile(csrFile, csrPem);
    // await fs.writeFile(keyFile, keyPem);

    // Generate the certificate
    // const cert = await client.auto({
    //   csr: certificateCsr,
    //   email: cache.config.emailAddress,
    //   termsOfServiceAgreed: true,
    //   challengePriority: ["dns-01"],
    //   challengeCreateFn,
    //   challengeRemoveFn
    // });

    // // Save the certificate
    // const certFile = `${certDir}/${domain}.crt`;
    // await fs.writeFile(certFile, cert);

    console.log("Creating certificate...");

    createCert(db, domains, cache.config.emailAddress, dnsProfile);

  });

  return router;
}