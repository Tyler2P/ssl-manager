const axios = require("axios");
const { getDB } = require("./functions");

module.exports = {
  updateDNS: async function(db, dnsProfile, record, value) {
    let dbProvided = true;
    // Ensure a database connection can be found
    if (!db) {
      db = await getDB();
      dbProvided = false;
    }
    if (!db) return false;

    // Fetch the DNS profile
    if (typeof dnsProfile === "string") {
      [dnsProfile] = await db.query("SELECT * FROM dns_profiles WHERE id = ?", [dnsProfile]);
      if (!dnsProfile[0])
        return false;
    }
    if (!dnsProfile)
      return false;

    // Ensure the DNS profile has required parameters
    if (!dnsProfile["zone_id"])
      return false;
    if (!dnsProfile["api_key"])
      return false;

    console.log("DNS Value (2): " + value);
  
    // const url = `https://api.cloudflare.com/client/v4/zones/${dnsProfile["zone_id"]}/dns_records`;
    let url = value === null ? (dnsProfile["api_delete_url"] || dnsProfile["api_create_url"]) : dnsProfile["api_create_url"];
    let headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${dnsProfile["api_key"]}`
    }
    console.log("Headers:");
    console.log(headers);

    value = [null, "", " "].includes(value) ? null : value;

    // Replace variables in URL
    url = url.replaceAll("{domain.name}", );
    url = url.replaceAll("{zone.id}", dnsProfile["zone_id"]);
    url = url.replaceAll("{record.name}", record);
    url = url.replaceAll("{record.value}", value);

    console.log(url);

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

      console.log(response.data);

      if (!(response.status || 0).toString().startsWith("2"))
        return false;
    } catch (err1) {
      // console.log(err1);
      console.log(err1?.response?.data);
      console.log(err1?.response?.data?.errors);
      return false;
    }
    console.log("DNS has returned true!");
    return true;
  },
}