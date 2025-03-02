const axios = require("axios");
const { getDB, formatLog } = require("./functions");

module.exports = {
  /**
   * Update DNS records for a domain
   * @param {object | string} dnsProfile The DNS Profile to update
   * @param {string} record The name of the DNS record
   * @param {string} value The value of the DNS record
   * @param {string?} primaryDomainName The primary domain name for the SSL certificate
   * @returns Whether the function was successful
   */
  updateDNS: async function(dnsProfile, record, value, primaryDomainName) {
    // Get a database connection
    const db = await getDB();

    // Fetch the DNS profile
    if (typeof dnsProfile === "string") {
      [dnsProfile] = await db.query("SELECT * FROM dns_profiles WHERE id = ?", [dnsProfile]);
      if (!dnsProfile[0]) {
        db.release();
        return false;
      }
    }
    if (!dnsProfile) {
      db.release();
      return false;
    }

    // Ensure the DNS profile has required parameters
    if (!dnsProfile["zone_id"]) {
      db.release();
      return false;
    }
    if (!dnsProfile["api_key"]) {
      db.release();
      return false;
    }
  
    let url = value === null ? (dnsProfile["api_delete_url"] || dnsProfile["api_create_url"]) : dnsProfile["api_create_url"];
    let headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${dnsProfile["api_key"]}`
    }

    value = [null, "", " "].includes(value) ? null : value;

    // Replace variables in URL
    if (primaryDomainName)
      url = url.replaceAll("{domain.name}", primaryDomainName);
    url = url.replaceAll("{zone.id}", dnsProfile["zone_id"]);
    url = url.replaceAll("{record.name}", record);
    url = url.replaceAll("{record.value}", value);

    // Update the DNS record
    try {
      const response = await axios.request({
        method: (function() {
          if (value === null)
            return "DELETE";
          else
            return dnsProfile.api_create_dns_method ? (dnsProfile.api_create_dns_method).toUpperCase() : "POST";
        }()),
        url,
        headers,
        data: {
          type: "TXT",
          name: record,
          content: value,
          ttl: 60
        }
      });

      if (!(response.status || 0).toString().startsWith("2")) {
        db.release();
        return false;
      }
    } catch (err1) {
      console.log(formatLog("ERROR", `Something went wrong updating DNS in profile ${dnsProfile.id}, domain: ${domains[0]}:`));
      console.log(err1?.response?.data);
      db.release();
      return false;
    }

    db.release();
    return true;
  },
  dnsCleanup: async function(dnsProfile) {

  }
}