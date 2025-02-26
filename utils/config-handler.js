const { formatLog, getDB } = require("./functions");
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const cache = require("./cache");

async function syncDatabase(config, file, existingFile) {
  if (config.rootUser && (!existingFile || cache.firstSetup)) {
    const db = await getDB();
    if (!db) return console.log(formatLog("ERROR", "Unable to sync new root user details. A restart may be required to resolve this issue"));

    await db.execute(`
      INSERT INTO users (
        user_id, username, joined_at, permissions, perms_read_only, password
      )
      VALUES (
        ?, ?, CURRENT_TIMESTAMP, ?, 1, ?
      )
    `, [file.rootUser?.id, file.rootUser?.username, file.maximumUserPermissions || 0, file.rootUser.password]);
    console.log(formatLog("INFO", "Root user account has been created in the database"));
    db.release();
  } else if (config.rootUser) {
    const db = await getDB();
    if (!db) return console.log(formatLog("ERROR", "Unable to sync new root user details. A restart may be required to resolve this issue"));

    let [user] = await db.execute("SELECT * FROM users WHERE user_id = ?", [file.rootUser?.id]);

    if (!user || (user.length || 0) < 1) {
      console.log(formatLog("INFO", "Root user account has been created in the database"));
      await db.execute(`
        INSERT INTO users (
          user_id, username, joined_at, permissions, perms_read_only, password
        )
        VALUES (
          ?, ?, CURRENT_TIMESTAMP, ?, 1, ?
        )
      `, [file.rootUser?.id, file.rootUser?.username, file.maximumUserPermissions || 0, file.rootUser?.password]);
      db.release();
      return;
    }
    user = user[0];

    await db.execute("UPDATE users SET username=?, password=? WHERE user_id=? LIMIT 1", [file.rootUser?.username, file.rootUser?.password, file.rootUser?.id]);
    console.log(formatLog("INFO", "Root user account has been synced with the database"));
    db.release();
  }
}

module.exports = {
  /**
   * Test whether the config file is setup properly
   * @returns {boolean} Whether the config file is setup
   */
  test: function() {
    const configFile = path.join(process.env.CONFIG_DIRECTORY, "/config.yml");
    const fileExists = fs.existsSync(configFile);
    if (!fileExists) {
      cache.firstSetup = true;
      console.log(formatLog("WARN", "Site configuration file has failed tests. Reason: Configuration file cannot be found"));
      return false;
    }

    const file = this.load();
    if (!file) {
      cache.firstSetup = true;
      console.log(formatLog("WARN", "Site configuration file has failed tests. Reason: Configuration file contains no data"));
      return false;
    }

    // Ensure the administrator doesn't intend to reset the default root user
    if (file.resetDefaults === true) {
      cache.firstSetup = true;
      console.log(formatLog("WARN", "Site configuration file has failed tests. Reason: 'resetDefaults' parameter has been altered"));
      return false;
    }
    // If the password is not set, mark the site has not been setup
    // This allows for easier root password resets
    if (!file.rootUser?.password || ["", " "].includes(file.rootUser?.password)) {
      cache.firstSetup = true;
      console.log(formatLog("WARN", "Site configuration file has failed tests. Reason: Root user's password has been altered"));
      return false;
    }
    // If the username is not set, mark the site has not been setup
    if (!file.rootUser?.username || ["", " "].includes(file.rootUser?.username)) {
      cache.firstSetup = true;
      console.log(formatLog("WARN", "Site configuration file has failed tests. Reason: Root user's username has been altered"));
      return false;
    }

    // Ensure the root account matches with database
    (async function() {
      const db = await getDB();
      let accChanged = false;

      let [user] = await db.execute("SELECT * FROM users WHERE user_id = ?", [file.rootUser?.id]);

      if (!user || (user.length || 0) < 1) {
        await db.execute(`
          INSERT INTO users (
            user_id, username, joined_at, permissions, perms_read_only, password
          )
          VALUES (
            ?, ?, CURRENT_TIMESTAMP, ?, 1, ?
          )
        `, [file.rootUser?.id, file.rootUser?.username, file.maximumUserPermissions || 0, file.rootUser?.password]);
        console.log(formatLog("INFO", "Root user account has been created in the database"));
        return;
      }
      user = user[0];

      if (user.username !== file.rootUser?.username)
        accChanged = true;
      if (user.password !== file.rootUser?.password)
        accChanged = true;
      if (user.permissions !== file.maximumUserPermissions)
        accChanged = true;

      if (accChanged) {
        await db.execute("UPDATE users SET username=?, password=? WHERE user_id=? LIMIT 1", [file.rootUser?.username, file.rootUser?.password, file.rootUser?.id]);
        console.log(formatLog("INFO", "Root user account has been altered in the configuration file. Database has been updated to reflect changes"));
      }

      db.release();
    }());

    console.log(formatLog("INFO", "Site configuration file passed tests"));
    cache.firstSetup = false;

    // Load file contents into cache
    cache.config = file;
    // If the config file passes, mark the site as setup
    return true;
  },
  /**
   * Check whether the config file exists
   * @returns {boolean} Whether the config file exists
   */
  exists: function() {
    const configFile = path.join(process.env.CONFIG_DIRECTORY, "/config.yml");
    return fs.existsSync(configFile);
  },
  /**
   * Load contents of the config file into an object
   * @returns {object} The config file
   */
  load: function() {
    const configFile = path.join(process.env.CONFIG_DIRECTORY, "/config.yml");
    if (!fs.existsSync(configFile)) return null;

    return yaml.load(fs.readFileSync(configFile));
  },
  /**
   * Write the config file
   * @param {object} config The configuration object
   */
  async write(config) {
    if (!config || Object.keys(config).length < 1) return;

    // Ensure the directory exists
    const configFile = path.join(process.env.CONFIG_DIRECTORY, "/config.yml");
    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let newFile = {};
    const existingFile = this.load();

    if (!existingFile || cache.firstSetup) {
      newFile = {
        resetDefaults: false,
        defaultProfile: 0,
        defaultUserPermissions: 0,
        maximumUserPermissions: 0,
        allowRegistrations: false,
        forceMFA: false,
        emailAddress: null,
        rootUser: {},
        ...config
      }
    } else {
      newFile = {
        ...existingFile,
        ...config
      }
    }

    fs.writeFileSync(configFile, yaml.dump(newFile), { encoding: "utf8" });

    // Sync database with configuration file
    syncDatabase(config, newFile, existingFile);
    // Detect whether this was the site being initially setup
    if (cache.firstSetup === true) {
      console.log(formatLog("INFO", "Site configuration file has been written. Site marked as setup"));
      cache.firstSetup = false;
    }
    // Update local cache
    cache.config = newFile;
  }
}