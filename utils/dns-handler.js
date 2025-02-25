const axios = require("axios");
const { getDB } = require("./functions");

module.exports = {
  updateDNS_Cloudflare: async function(db, dnsProfileId, record, value) {
    // https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/
    
    let dbProvided = true;
    // Ensure a database connection can be found
    if (!db) {
      db = await getDB();
      dbProvided = false;
    }
    if (!db) return false;

    // Fetch the DNS profile
    const [dnsProfile] = await db.query("SELECT * FROM dns_profiles WHERE id = ?", [dnsProfileId]);
    if (!dnsProfile[0])
      return false;
    dnsProfile = dnsProfile[0];

    // Ensure the DNS profile has required parameters
    if (!dnsProfile["zone_id"])
      return false;
    if (!dnsProfile["api_key"])
      return false;
  
    const url = `https://api.cloudflare.com/client/v4/zones/${dnsProfile["zone_id"]}/dns_records`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${dnsProfile["api_key"]}`
    }

    
  },
  updateDNS_Porkbun: async function(domain, record, value) {

  },
}