const { PoolConnection } = require("mysql2/promise");
const globalCache = require("./cache");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("path");
const ejs = require("ejs");

// Define the cache
let cache = {
  releasedVersions: ["v1"],
  dbPool: null
}

/**
 * Generate a secure ID
 * @param {number} length The length of the ID
 * @returns {string} The generated ID
 */
function generateId(length) {
  const dictionary = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += dictionary[crypto.randomInt(0, dictionary.length)];
  }
  return result;
}

let globalFunctions = {
  /**
   * Define the database pool
   * @param {PoolConnection} dbPool The database pool
   */
  defineDB: async function(dbPool) {
    if (dbPool)
      cache.dbPool = dbPool;
  },
  /**
   * Get a database connection
   * @returns {Promise<PoolConnection>} The database pool
   */
  getDB: async function() {
    const pool = cache.dbPool;

    // Get a database connection
    const db = await pool.getConnection();
    if (!db) return null;

    return db;
  },
  /**
   * Generate a secure ID
   * @param {number} length The length of the ID
   * @returns {string} The generated ID
   */
  generateId: generateId,

  /**
   * Validate an email address
   * @param {string} email The email address
   * @returns {boolean} Whether the string is a valid email address
   */
  validateEmail: function(email) {
    const regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return regex.test(email);
  },
  /**
   * Test whether a string contains a number
   * @param {string} string The string to test
   * @returns Whether or not a string contains a number
   */
  hasNumber: function(string) {
    return /\d/.test(string);
  },
  /**
   * Test whether a string contains an uppercase character
   * @param {string} string The string to test
   * @returns Whether the string contains an uppercase character
   */
  stringHasUppercase: function(string) {
    // return /^[A-Z]*$/g.test(string);
    return /[A-Z]/g.test(string);
  },

  /**
   * Format text for console logging
   * @param {string} type The type of log
   * @param {string} text The text to log
   * @returns {string} The formatted log
   */
  formatLog(type, text) {
    let logType = type || "";
    const colorCodes = {
      blue: "\x1b[34m",
      orange: "\x1b[38;5;214m",
      red: "\x1b[31m",
      reset: "\x1b[0m"
    }

    if (colorCodes[type]) type = type;
    else if (type.toUpperCase() === "ERROR") {
      type = "red";
    } else if (type.toUpperCase() === "WARNING" || type.toUpperCase() === "WARN") {
      type = "orange";
    } else if (type.toUpperCase() === "INFO") {
      type = "blue";
    } else type = "reset";

    return `[${colorCodes[type]}${logType}${colorCodes.reset}] ${text}`;
  },

  /**
   * Check if a user is allowed to access an endpoint
   * @param {request} req The incoming HTTP request
   * @param {response} res The HTTP response
   * @param options The endpoints options
   */
  checkRequest: async function(req, res, options={ authCookie: true, authType: "Authorized", redirectAccountAlterations: true }, returnUser) {
    const authTypes = {
      "Authorized" : 1,
      "Pre-Authorization": 2,
      "Email-Authentication": 3
    }

    // Ensure an authorization cookie exists
    if (!req.cookies?.auth && options.authCookie) {
      res.status(401).redirect(`/auth/login?redirect=${encodeURIComponent(Object.keys(req.query).length < 1 ? req.baseUrl + req.path : req.baseUrl + req.path + "?" + (req.originalUrl).split("?")[1])}`);
      return false;
    }

    if (req.cookies?.auth && options.authCookie) {
      const token = req.cookies.auth;
      const user = await globalFunctions.users.findByOauth(token);

      if (!user || user.error) {
        res.status(401).redirect(`/auth/login?redirect=${encodeURIComponent(Object.keys(req.query).length < 1 ? req.baseUrl + req.path : req.baseUrl + req.path + "?" + (req.originalUrl).split("?")[1])}`);
        return false;
      }

      if (!authTypes[options.authType])
        throw new TypeError("Invalid authType provided");

      if (user.auth_type !== authTypes[options.authType]) {
        res.status(401).redirect(`/auth/login?redirect=${encodeURIComponent(Object.keys(req.query).length < 1 ? req.baseUrl + req.path : req.baseUrl + req.path + "?" + (req.originalUrl).split("?")[1])}`);
        return false;
      }

      // Ensure the token isn't expired
      let expiryDate = new Date(user.auth_expires);

      if (isFinite(+expiryDate) && new Date().getTime() > expiryDate.getTime()) {
        res.status(401).redirect(`/auth/login?redirect=${encodeURIComponent(Object.keys(req.query).length < 1 ? req.baseUrl + req.path : req.baseUrl + req.path + "?" + (req.originalUrl).split("?")[1])}`);
        return false;
      }

      if (user.disabled === 1) {
        res.status(401).redirect(`/auth/login?redirect=${encodeURIComponent(Object.keys(req.query).length < 1 ? req.baseUrl + req.path : req.baseUrl + req.path + "?" + (req.originalUrl).split("?")[1])}`);
        return false;
      }
      if (user.reset_password === 1 && options.redirectAccountAlterations) {
        res.status(401).redirect(`/auth/login/alterations?redirect=${encodeURIComponent(Object.keys(req.query).length < 1 ? req.baseUrl + req.path : req.baseUrl + req.path + "?" + (req.originalUrl).split("?")[1])}`);
        return false;
      }

      return returnUser ? { user, bool: true } : true;
    }

    return true;
  },

  /**
   * Send a HTML response to an incoming HTTP request
   * @param {request} req The request object to the incoming HTTP request
   * @param {response} res The response to the incoming HTTP request
   * @param {string} page The page to render
   * @param {object} options The render options
   */
  sendPage: async function(req, res, page, options) {
    // Ensure required parameters have been provided
    if (typeof req !== "object")
      throw new TypeError("Request expected object, received " + typeof res);
    if (typeof res !== "object")
      throw new TypeError("Response expected object, received " + typeof res);
    if (typeof page !== "string")
      throw new TypeError("Page expected string, received " + typeof page);
    if (typeof options !== "object" && typeof options !== "undefined")
      throw new TypeError("Options expected object, received " + typeof options);

    // Correct the path
    if (!page.endsWith("ejs"))
      page = page + ".ejs";

    // Ensure there isn't a double slash in the path
    if (page.startsWith("/"))
      page = page.substring(1);

    let pageOpts = {
      options: {
        theme: req.cookies.theme || "system",
        NODE_ENV: ["DEV", "DEVELOPMENT"].includes(process.env.NODE_ENV) ? "DEVELOPMENT" : "PRODUCTION"
      },
      ...options
    }

    await ejs.renderFile(
      path.join(__dirname, "../", `${options?.directory ? (options.directory += "/" + page) : ("/views/" + page)}`),
      pageOpts,
      async function(err, result) {
        // If a custom status has been provided, set it here
        if (typeof options?.status == "number" || typeof options?.statusCode == "number")
          res.status(options?.status || options?.statusCode || 200);

        // If an error is present, use the default 'render' function
        if (err)
          return res.render(`${options?.directory ? ("../" + options.directory + "/" + page) : page}`, pageOpts);

        // Set the 'Content-Type' header
        res.setHeader("Content-Type", "text/html");
        // Send the rendered code
        res.send(result);
      }
    );
  },

  /**
   * Send an email
   * @param {string} to The email address to send the email to
   * @param {string} subject The email subject
   * @param {string} content The email content
   * @param {string} filePath The file path to a HTML email template
   * @param {object} options The email options
   */
  sendEmail: async function(to, subject, content, filePath, options={ body: "plain", directory: null, templateVariables: null, bccEnabled: false }) {
    if (!to || !to.includes("@") || !to.includes("."))
      return { error: true, msg: "A valid email address must be provided" }
    if (options?.body === "plain" && !content)
      return { error: true, msg: "An email content must be provided if the body is plain text" }
    if (!options?.body === "html" && (!content && !path))
      return { error: true, msg: "An email content or file path is required if the body is set to HTML" }
    if (!["plain", "html"].includes(options?.body))
      return { error: true, msg: "An invalid body type has been provided" }

    let emailOpts = {
      host: process.env.EMAIL_SERVER,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SSL_ENABLED === "true" ? true : false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        ciphers: "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256",
        rejectUnauthorized: false
      }
    }

    const transporter = nodemailer.createTransport(emailOpts);

    let conf = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: to,
      subject: subject || ""
    }

    if (options?.body === "plain" && content)
      conf.text = content;
    if (options?.body === "html" && content)
      conf.html = content;
    if (options?.body === "html" && filePath) {
      let absolutePath = path.join(__dirname, "../" + (options?.directory || "views/email-templates/") + filePath);
      // Ensure the file path exists
      if (!fs.existsSync(absolutePath)) return { error: true, msg: "File path does not exist" }

      let emailTemplate = await ejs.renderFile(absolutePath, options?.templateVariables || {});
      if (!emailTemplate)
        return { error: true, msg: "Unable to find email template" };

      conf.html = emailTemplate;
    }
    if (options?.bccEnabled) {
      conf.bcc = conf.to;
      delete conf.to;
    }

    if (!conf.text && !conf.html)
      return { error: true, msg: "No HTML body has been provided" }

    const email = await transporter.sendMail(conf);

    if ((email.response).toLowerCase().includes("ok:"))
      return { error: false };
    else if ((email.response).toLowerCase() === ("250 message received"))
      return { error: false };

    return { error: true, msg: "Something went wrong - " + email.response };
  },
  /**
   * Send an email to all site administrators
   * @param {string} emailType The type of email being sent out
   * @param {string} subject The email subject
   * @param {string} content The email content
   * @param {string} filePath The file path to a HTML email template
   * @param {object} options The email options
   * @returns {boolean} Whether the function was successful
   */
  sendEmailToAdmins: async function(emailType, subject, content, filePath, options) {
    let emails = await globalFunctions.users.getAdministratorEmails(emailType, true);
    let error = false;

    emails.forEach(async (obj) => {
      if (options?.templateVariables && Object.keys(options?.templateVariables).length > 0) {
        Object.keys(options.templateVariables).forEach((key) => {
          let value = options.templateVariables[key];
          
          if (!value) value = "";
          if (typeof value === "string") {
            if (value.includes("{inserts.name}"))
              options.templateVariables[key] = value.replace("{inserts.name}", obj.name);
            if (value.includes("{inserts.email}"))
              options.templateVariables[key] = value.replace("{inserts.email}", obj.email);
          }
        });
      }
      
      let x = await globalFunctions.sendEmail(obj.email, subject, content, filePath, options);

      if (!x || x.error)
        error = true;

      console.log("sendEmailToAdmins11:");
      console.log(x);
      console.log("email sent? (8845):")
      console.log(error);
      console.log("value returned:");
      console.log(!error);

      return !error;
    });
  },

  /**
   * Functions related to API
   */
  API: {
    /**
     * Get the authorization headers
     * @param {object} headers The HTTP headers
     * @returns The authorization token & type
     */
    getAuth: function(headers) {
      return typeof headers == "object" && headers["authorization"] ?
        {
          type: headers["authorization"].split(/ +/g)[0],
          token: headers["authorization"].split(/ +/g)[1]
        } : {};
    },
    /**
     * Check if a user is allowed to access an endpoint & the server is ready
     * @param {request} req The incoming HTTP request
     * @param {response} res The HTTP response
     * @param {object} options The endpoints options
     * @param {boolean} returnAdvancedData Return database queries
     */
    checkRequest: async function(req, res, options = { authCookie: false, authHeader: false, versionEnabled: true, allowVersions: [], allowedAuthTypes: ["Bearer"] }, returnAdvancedData) {
      function getAuth(headers) {
        return typeof headers == "object" && headers["authorization"] ? { type: headers["authorization"].split(/ +/g)[0], token: headers["authorization"].split(/ +/g)[1] } : {};
      }

      // Ensure the provided API version is valid
      if (options.versionEnabled && ((!(cache.releasedVersions).includes(req.params?.version)) && !(options.allowVersions || []).includes(req.params?.version))) {
        res.status(403).json({ error: "Unrecognized version", code: 4009 });
        return false;
      } else if (options.versionEnabled && !(cache.releasedVersions).includes(req.params?.version) && (!options.allowVersions || options.allowVersions.length < 1)) {
        res.status(403).json({ error: "Unrecognized version", code: 4009 });
        return false;
      }
      // Ensure HTTP method matches allowed methods
      if (Array.isArray(options.allowedMethods) && [...options.allowedMethods].filter((method) => method.toUpperCase() === (req.method).toUpperCase()).length < 1) {
        res
          .status(405)
          .setHeader("Accept", (options.allowedMethods).join(", "))
          .json({ error: "Method not allowed", code: 4008 });
        return false;
      }
      // Ensure an authorization cookie exists
      if (!req.cookies?.auth && options.authCookie) {
        res.status(401).json({ error: "Unauthorized request", code: 4010 });
        return false;
      }
      // Ensure an authorization header exists
      if (!getAuth(req.headers)?.token && options.authHeader) {
        res.status(401).json({ error: "Unauthorized request", code: 4010 });
        return false;
      }

      if (options?.authHeader) {
        // Ensure the authorization header is valid
        const authType = getAuth(req.headers)?.type;
        const token = getAuth(req.headers)?.token;

        const db = await globalFunctions.getDB();
        if (!db) {
          res.status(500).json({ error: "Something went wrong, please try again later", code: 5004 });
          return false;
        }

        let [user] = await db.query(`
          SELECT 
            users.*,
            user_authentication_codes.auth_token,
            user_authentication_codes.auth_type,
            user_authentication_codes.auth_timestamp,
            user_authentication_codes.auth_expires
          FROM user_authentication_codes
          JOIN users ON user_authentication_codes.user_id = users.user_id
          WHERE user_authentication_codes.auth_token = ?
          LIMIT 1
        `, [token]);

        db.release();

        if (!user || (user.length || 0) < 1) {
          res.status(401).json({ error: "Unauthorized request", code: 4010 });
          return false;
        }
        user = user[0];

        if (user.auth_type !== 1) {
          res.status(401).json({ error: "Unauthorized request", code: 4010 });
          return false;
        }

        // Ensure the token isn't expired
        let expiryDate = new Date(user.auth_expires);

        if (isFinite(+expiryDate) && new Date().getTime() > expiryDate.getTime()) {
          res.status(401).json({ error: "Unauthorized request", code: 4011 });
          return false;
        }

        // Ensure the authentication type is valid
        if (options.authHeader && !(options?.allowedAuthTypes || ["Bearer"]).find((x) => x.toLowerCase() === authType.toLowerCase())) {
          res.status(401).json({ error: "Unauthorized request", code: 4010 });
          return false;
        }

        return returnAdvancedData ? { user, bool: true } : true;
      }

      return true;
    }
  },

  users: {
    /**
     * Find all users
     * @returns {Array<Object>} The user accounts
     */
    getUsers: async function() {
      // Ensure the database exists
      if (!cache.db) return [];

      const db = await globalFunctions.getDB();
      if (!db) return [];

      // Search all users
      const [users] = await db.query(`
        SELECT 
          users.*,
          user_preferences.*
        FROM users
        JOIN user_preferences ON users.user_id = user_preferences.user_id
      `);

      db.release();

      if (!users || users.length < 1) return [];

      return users;
    },

    /**
     * Find all user email addresses based on email preferences
     * @param {string} emailType The email preference type
     * @param {boolean} includeNames Return an array of objects including user emails and names
     * @returns {Array<string>} The user email addresses
     */
    getUserEmails: async function(emailType, includeNames) {
      const db = await globalFunctions.getDB();
      // Ensure the database exists
      if (!db) return [];

      // Search all users
      const [users] = await db.query(`
        SELECT 
          users.*,
          user_preferences.*
        FROM users
        JOIN user_preferences ON users.user_id = user_preferences.user_id
      `);

      db.release();

      if (!users || users.length < 1) return [];

      if (includeNames) {
        return users.map((user) => user[emailType] === 1 ? { email: user.email, name: `${user.fName} ${user.sName}` } : null).filter((x) => x);
      } else {
        return users.map((user) => user[emailType] === 1 ? user.email : null).filter((x) => x);
      }
    },
    findByOauth: async function(oauth, options={ ignoreInvalidVariables: false, returnAdvancedErrors: false }) {
      let oauthExpiredFlag = false;

      // Ensure essential variables are provided
      if (!oauth) return null;

      const db = await globalFunctions.getDB();
      if (!db) return null;

      let user;

      try {
        [user] = await db.query(`
          SELECT 
            users.*,
            user_authentication_codes.auth_token,
            user_authentication_codes.auth_type,
            user_authentication_codes.auth_timestamp,
            user_authentication_codes.auth_expires
          FROM user_authentication_codes
          JOIN users ON user_authentication_codes.user_id = users.user_id
          WHERE user_authentication_codes.auth_token = ?
          LIMIT 1
        `, [oauth]);
      } catch(e) {
        console.log("Error caught:", e);
      }

      if (!user || (user.length || 0) < 1) {
        db.release();
        return options?.returnAdvancedErrors ? { error: true, msg: "Invalid OAuth Token", code: 4011 } : null;
      }

      user = user[0];

      if (user.auth_expires) {
        let expiryDate = new Date(user.auth_expires);
        let creationDate = new Date(user.auth_timestamp);
        let currentTimestamp = new Date().getTime();

        if (isFinite(+expiryDate) && currentTimestamp > expiryDate.getTime())
          oauthExpiredFlag = true;
        else if (!isFinite(+expiryDate) && isFinite(+creationDate) && currentTimestamp > creationDate.getTime() + (24 * 60 * 60 * 1000))
          oauthExpiredFlag = true;
      } else if (user.auth_timestamp) {
        let creationDate = new Date(user.auth_timestamp);
        let currentTimestamp = new Date().getTime();

        if (isFinite(+creationDate) && currentTimestamp > creationDate.getTime() + (24 * 60 * 60 * 1000))
          oauthExpiredFlag = true;
      }

      if (oauthExpiredFlag) {
        await db.query(`
          DELETE FROM user_authentication_codes
          WHERE auth_token = ?
        `, [oauth]);

        db.release();

        return options?.returnAdvancedErrors ? { error: true, msg: "OAuth Token Expired", code: 4011 } : null;
      }

      db.release();

      if (user.disabled === 1 && !options.ignoreInvalidVariables)
        return options?.returnAdvancedErrors ? { error: true, msg: "Account Suspended", code: 4205 } : null;

      return user;
    },
    findByLogin: async function(username, password, options={ ignoreInvalidVariables: false, returnAdvancedErrors: false }) {
      // Ensure required variables are required
      if (!username || !password) return null;

      // Get a database connection
      const db = await globalFunctions.getDB();
      if (!db) return null;

      let [user] = await db.query(`
        (SELECT * FROM users WHERE users.email = ? LIMIT 1)
        UNION
        (SELECT * FROM users WHERE users.username = ? LIMIT 1)
        LIMIT 1
      `, [username, username]);

      db.release();

      if (!user || (user.length || 0) < 1)
        return options?.returnAdvancedErrors ? { error: true, msg: "Username or password incorrect", code: 4201 } : null;

      user = user[0];

      if (!this.validatePassword(user.password, password))
        return options?.returnAdvancedErrors ? { error: true, msg: "Username or Password Incorrect", code: 4201 } : null;
      if (user.disabled === 1 && !options.ignoreInvalidVariables)
        return options?.returnAdvancedErrors ? { error: true, msg: "Account Suspended", code: 4205 } : null;

      return user;
    },
    findById: async function(userId, options={ ignoreInvalidVariables: true, returnAdvancedErrors: false }) {
      // Ensure required variables are required
      if (!userId) return null;

      // Get a database connection
      const db = await globalFunctions.getDB();
      if (!db) return null;

      let [user] = await db.query("SELECT * FROM users WHERE users.user_id = ? LIMIT 1", [userId]);

      db.release();

      if (!user || (user.length || 0) < 1)
        return options?.returnAdvancedErrors ? { error: true, msg: "Cannot find user", code: 4004 } : null;

      user = user[0];

      if (user.disabled === 1 && !options.ignoreInvalidVariables)
        return options?.returnAdvancedErrors ? { error: true, msg: "Account Suspended", code: 4205 } : null;

      return user;
    },
    create: async function(fName, sName, username, email, password, permissions, additionalOpts={ resetPassword: true }) {
      if (!fName || !sName || !username) return false;
      if (!permissions || typeof permissions !== "bigint") permissions = globalCache.config?.defaultUserPermissions || 0;
      if (!password) generateId(8);

      const db = await globalFunctions.getDB();
      if (!db) return false;

      const salt = bcrypt.genSaltSync(8);
      const hashedPassword = bcrypt.hashSync(password, salt);

      permissions = parseInt(permissions);

      const newUserId = generateId(25);

      // Create the user in the database
      await db.execute(`
        INSERT INTO logins (
          \`user_id\`, \`joined_at\`, \`fName\`, \`sName\`, \`username\`, \`email\`, \`password\`, \`permissions\`, \`reset_password\`
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `, [newUserId, new Date(), fName, sName, username, email, hashedPassword, permissions, (additionalOpts?.resetPassword ? 1 : 0)]);

      // Define email preferences for the new user
      await db.query(`INSERT INTO user_preferences (user_id) VALUES (?)`, [newUserId]);

      db.release();

      return newUserId;
    },
    validatePassword: function(hashedPassword, password) {
      return bcrypt.compareSync(password, hashedPassword);
    },
    createAuthenticationToken: async function(userId, type) {
      // Ensure required variables are provided
      if (!userId || typeof type !== "number") return false;

      let token = generateId(37);

      // Get a database connection
      const db = await globalFunctions.getDB();
      if (!db) return token;
      
      await db.execute(`
        INSERT INTO \`user_authentication_codes\` (
          \`user_id\`, \`auth_token\`, \`auth_type\`, \`auth_timestamp\`, \`auth_expires\`
        )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      `, [userId, token, type, new Date(new Date().getTime() + (24 * 60 * 60 * 1000))]);

      db.release();

      return token;
    }
  }
}

module.exports = globalFunctions;