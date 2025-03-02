const cache = require("./cache");
const acme = require("acme-client");
const fs = require("fs/promises");
const { existsSync } = require("fs");
const path = require("path");
const { updateDNS } = require("./dns-handler");
const { getDB, formatLog } = require("./functions");

module.exports = {
  createCert: async function(db, domains, emailAddr, dnsProfile, type) {
    // Ensure a database connection has been established
    if (!db) await getDB();
    if (!db) return null;

    // Ensure domain is valid
    if (!Array.isArray(domains) && typeof domains === "string")
      domains = [domains];

    const domainRegex =  /^(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}\.)*(xn--)?([a-z0-9][a-z0-9\-]{0,60}|[a-z0-9-]{1,30}\.[a-z]{2,})$/;
    const validDomains = domains.filter(domain => domain.match(domainRegex));
    if (validDomains.length !== domains.length) throw new Error("Invalid domains provided");

    // Ensure email address is valid
    if (!emailAddr)
      emailAddr = cache.config.emailAddress;
    if (!emailAddr)
      return null;

    // Get the profile ID
    if (typeof dnsProfile === "string") {
      [dnsProfile] = await db.query("SELECT * FROM dns_profiles WHERE id = ?", [dnsProfile]);
      if (!dnsProfile[0])
        return null;
      dnsProfile = dnsProfile[0];
    }
    if (!dnsProfile)
      return null;

    // Ensure the DNS profile has required parameters
    if (!dnsProfile["api_key"])
      return null;
    if (!dnsProfile["api_create_url"])
      return null;

    const client = new acme.Client({
      directoryUrl: (type || "PRODUCTION").toUpperCase() === "STAGING" ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production,
      accountKey: await acme.forge.createPrivateKey()
    });
    
    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${emailAddr}`]
    });

    // Create the certificate
    const [certKey, certCsr] = await acme.crypto.createCsr({
      altNames: domains
    });

    // Generate the certificate
    const cert = await client.auto({
      csr: certCsr,
      email: emailAddr,
      termsOfServiceAgreed: true,
      challengePriority: ["dns-01"],
      challengeCreateFn: async (authz, _challenge, keyAuthorization) => {
        const dnsRecord = `_acme-challenge.${authz.identifier.value}`;
        const dnsValue = keyAuthorization;

        // Update the DNS records
        await updateDNS(db, dnsProfile, dnsRecord, dnsValue);
      },
      // challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
      //   const dnsRecord = `_acme-challenge.${authz.identifier.value}`;

      //   // Remove the DNS records
      //   await updateDNS(db, dnsProfile, dnsRecord, null);
      // }
    }).catch((e) => {
      console.log(formatLog("ERROR", "Failed to generate SSL certificate for: " + domains[0]));
      console.log(e);
    });

    // Ensure cert was generated
    if (!cert) {
      console.log(formatLog("ERROR", "Certificate generation failed for: " + domains[0]));
      return null;
    } else {
      console.log(formatLog("SUCCESS", "Certificate generated successfully for: " + domains[0]));
    }

    // Split the cert string into two parts: Server Certificate & CA Chain
    const certParts = cert.split(/(?=-----BEGIN CERTIFICATE-----)/g);
    if (certParts.length < 2) {
      console.log(formatLog("ERROR", "Unexpected certificate format returned from acme-client:"));
      console.log(cert);
      return null;
    }

    const [serverCert, caCert] = certParts;  // First is the domain cert, second is the CA chain

    // Define certificate directory
    const certDir = path.join(process.env.SSL_DIRECTORY, domains[0].replace("*.", ""));

    if (!existsSync(certDir))
    await fs.mkdir(certDir, { recursive: true });

    // Save the private key
    await fs.writeFile(path.join(certDir, "privkey.pem"), certKey);

    // Save the server certificate
    await fs.writeFile(path.join(certDir, "cert.pem"), serverCert);

    // Save the CA chain
    await fs.writeFile(path.join(certDir, "chain.pem"), caCert);

    console.log(formatLog("INFO", "Certificate for: " + domains[0] + ". Has been saved in" + certDir));
  },
  renewCert: async function(db, id) {

  },
}