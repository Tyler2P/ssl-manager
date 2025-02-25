const mysql = require("mysql2/promise");
const chalk = require("chalk");
const { defineDB } = require("./functions");
const { formatLog } = require("./functions");

const maxDBConnections = process.env.MAX_DB_CONNECTIONS || 5;

module.exports = {
  /**
   * Ensure the database is correctly configured
   * @param {mysql.PoolConnection} db The database pool
   */
  setup: async function() {
    let dbPool;

    try {
      dbPool = await mysql.createPool({
        connectionLimit: maxDBConnections,
        host: process.env.MYSQL_SERVER,
        user: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB_NAME
      });
    } catch {
      dbPool = null;
    }

    // Ensure the pool exists
    if (!dbPool) throw new Error("Unable to get a connection to the database pool");

    // Get a database connection
    let db = await dbPool.getConnection().catch(() => null);
    if (!db) {
      console.log(formatLog("WARN", "No database found. Attempting to create the database"));

      const dbConnection = await mysql.createConnection({
        host: process.env.MYSQL_SERVER,
        user: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
      });
      await dbConnection.connect();
      // Ensure the database exists
      await dbConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.MYSQL_DB_NAME}\``);

      // Close the connection
      dbConnection.end();

      dbPool.end();

      // Retry the pool connection
      dbPool = await mysql.createPool({
        host: process.env.MYSQL_SERVER,
        user: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB_NAME
      });

      // Retry fetching a database connection
      db = await dbPool.getConnection().catch(() => null);

      // Ensure the database connection exists
      if (db) console.log(formatLog("INFO", "Database created successfully"));
    }

    if (!dbPool || !db) throw new Error("Unable to get a connection to the database");

    // Define the database pool
    defineDB(dbPool);
    
    // Login data
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`user_id\` char(25) NOT NULL COMMENT 'The users ID',
        \`last_seen\` timestamp COMMENT 'When the user last logged in',
        \`joined_at\` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT 'When the user joined the site',
        \`fName\` varchar(255) COMMENT 'The user\\'s first name',
        \`sName\` varchar(255) COMMENT 'The user\\'s second name',
        \`username\` varchar(320) NOT NULL COMMENT 'The user\\'s username',
        \`email\` varchar(320) COMMENT 'The user\\'s email address',
        \`phone_num\` varchar(15) COMMENT 'The user\\'s phone number',
        \`password\` char(60) NOT NULL COMMENT 'The user\\'s password',
        \`reset_password\` tinyint(1) DEFAULT '0' COMMENT 'Change the user\\'s password on next login?',
        \`password_update_date\` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT 'When the user\\'s password was last changed',
        \`permissions\` bigint NOT NULL DEFAULT '0' COMMENT 'The user\\'s custom site permissions. Represented as a BigInt',
        \`perms_read_only\` tinyint(1) DEFAULT '0' COMMENT 'Whether the users permissions can be changed in the admin panel',
        \`second_verification_enabled\` tinyint(1) DEFAULT '0' NOT NULL COMMENT 'Whether second verification is enabled',
        \`second_verification_token\` varchar(255) COMMENT 'The user\\'s second verification token',
        \`disabled\` tinyint(1) DEFAULT '0' COMMENT 'Whether the user\\'s account has been disabled',
        \`controlled_by\` tinyint DEFAULT '0' COMMENT 'What service controls authentication to this user. For example, either Local Authentication or Active Directory',
        \`third_party_id\` text COMMENT 'If this user is controlled by a third party authentication service, their provided user ID',
        KEY \`user_id\` (\`user_id\`)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`groups\` (
        \`group_id\` char(32) NOT NULL COMMENT 'The group\\'s ID',
        \`created_at\` timestamp COMMENT 'When the group was created',
        \`created_by\` varchar(25) COMMENT 'Who the group was created by',
        \`name\` varchar(255) NOT NULL COMMENT 'The group\\'s name',
        \`description\` varchar(320) COMMENT 'The group\\'s description',
        \`notes\` TEXT COMMENT 'The group\\'s private notes',
        \`permissions\` bigint NOT NULL DEFAULT '0' COMMENT 'The group\\'s site permissions',
        \`disabled\` tinyint(1) DEFAULT '0' COMMENT 'Whether the user\\'s account has been disabled',
        \`controlled_by\` tinyint DEFAULT '0' COMMENT 'What service controls this group. For example, either Local Authentication or Active Directory',
        \`third_party_id\` text COMMENT 'If this group is controlled by a third party authentication service, their provided group ID',
        KEY \`group_id\` (\`group_id\`),
        UNIQUE (\`group_id\`)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`user_groups\` (
        \`user_id\` char(25) NOT NULL COMMENT 'The user\\'s ID',
        \`group_id\` char(32) NOT NULL COMMENT 'The group\\'s ID',
        \`joined_at\` timestamp COMMENT 'When the user joined the group',
        PRIMARY KEY (\`user_id\`, \`group_id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`),
        FOREIGN KEY (\`group_id\`) REFERENCES \`groups\`(\`group_id\`)
      )
    `);

    // User preferences
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`user_preferences\` (
        \`user_id\` char(25) NOT NULL COMMENT 'The user\\'s ID this column refers to',
        \`ssl_expiry_email\` tinyint(1) DEFAULT '0' COMMENT 'Receive email notifications when a SSL certificate is about to expire',
        \`ssl_renewed_email\` tinyint(1) DEFAULT '1' COMMENT 'Receive email notifications when a SSL certificate is renewed',
        \`ssl_error_email\` tinyint(1) DEFAULT '1' COMMENT 'Receive email notifications when a SSL related issue occurs',
        \`dns_error_email\` tinyint(1) DEFAULT '1' COMMENT 'Receive email notifications when a DNS related issue occurs',
        \`user_create_email\` tinyint(1) DEFAULT '0' COMMENT 'Receive email notifications when a new user creates an account',
        \`user_delete_email\` tinyint(1) DEFAULT '0' COMMENT 'Receive email notifications when a new user deletes an account',
        \`user_update_email\` tinyint(1) DEFAULT '0' COMMENT 'Receive email notifications when a new user profile is updated',
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);

    // User OAuth codes
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`user_authentication_codes\` (
        \`user_id\` char(25) NOT NULL COMMENT 'The user\\'s ID this column refers to',
        \`auth_token\` varchar(60) NOT NULL COMMENT 'The OAuth token',
        \`auth_type\` tinyint NOT NULL COMMENT 'The token type',
        \`auth_timestamp\` timestamp COMMENT 'The timestamp of when the token was created',
        \`auth_expires\` timestamp COMMENT 'The expiration time of the token',
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);

    // Authentication Services
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`auth_services\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` varchar(255) NOT NULL COMMENT 'The custom name of the authentication service',
        \`description\` text COMMENT 'A description of the authentication service',
        \`notes\` text COMMENT 'Admin notes for the authentication service',

        \`provider\` varchar(255) NOT NULL COMMENT 'The authentication service provider\\'s name',
        \`api_key\` text COMMENT 'The API key for the authentication service',
        \`url\` text COMMENT 'The URL for the authentication service',
        \`bk_url\` text COMMENT 'A backup URL for the authentication service',
        \`username\` text COMMENT 'The username for the authentication service',
        \`password\` text COMMENT 'The password for the authentication service',

        \`use_start_tls\` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether to use StartTLS for the authentication service',
        \`use_tls\` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether to use TLS for the authentication service',
        \`skip_tls_verification\` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether to skip verification of a server certificate',
        \`username_format\` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'How to display usernames throughout the site. For example <username> or <username>@<domain>',

        \`user_search_filter\` longtext COMMENT 'LDAP search filter for users',
        \`group_search_filter\` longtext COMMENT 'LDAP search filter for groups',

        KEY (\`id\`),
        UNIQUE (\`id\`)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`auth_services_groups\` (
        \`id\` INT AUTO_INCREMENT,
        \`auth_service\` INT NOT NULL COMMENT 'The ID of the authentication service',
        \`name\` varchar(255) NOT NULL COMMENT 'The name of the group',
        \`group_search_filter\` longtext COMMENT 'LDAP search filter for groups',
        PRIMARY KEY (\`id\`),
        FOREIGN KEY (auth_service) REFERENCES auth_services(id)
      )
    `);

    // DNS Profiles
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`dns_profiles\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` varchar(255) NOT NULL COMMENT 'The name of the DNS profile',
        \`description\` text COMMENT 'A description of the DNS profile',
        \`provider\` varchar(255) NOT NULL COMMENT 'The DNS provider',
        \`api_key\` text COMMENT 'The API key for the DNS provider',
        \`api_url\` text COMMENT 'The API URL for the DNS provider',
        \`zone_id\` text COMMENT 'The zone ID for the DNS provider (Cloudflare)',
        UNIQUE (\`id\`)
      )
    `);

    // DNS Profiles
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`certs\` (
        \`id\` char(25) NOT NULL COMMENT 'The certs ID',
        \`created_at\` timestamp COMMENT 'When the cert was created',
        \`created_by\` varchar(25) COMMENT 'Who the cert was created by',
        \`name\` varchar(255) NOT NULL COMMENT 'The name of the certificate',
        \`description\` text COMMENT 'A description of the certificate',
        \`domains\` MEDIUMTEXT NOT NULL COMMENT 'The domains on this certificate',
        \`dns_profile\` INT NOT NULL COMMENT 'The DNS profile associated with this certificate',
        UNIQUE (\`id\`)
      )
    `);
    
    /**
     * Status:
     *   1 - Pending
     *   2 - Sent
     *   3 - Failed
     */
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`archived_emails\` (
        \`email_id\` char(32) NOT NULL COMMENT 'The email ID',
        \`created_at\` varchar(255) NOT NULL COMMENT 'The date that the email was added to the queue',
        \`sent_at\` varchar(255) COMMENT 'The timestamp that the email successfully sent',
        \`status\` tinyint NOT NULL DEFAULT '1' COMMENT 'The current status of the email',
        \`fail_reason\` text COMMENT 'The reason that the email failed to send',
        \`attempts\` int NOT NULL DEFAULT '1' COMMENT 'Number of attempts it takes for the email to send',
        UNIQUE (\`email_id\`)
      )
    `);
    /**
     * Status:
     *   1 - Pending
     *   2 - Sent
     *   3 - Failed
     */
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`scheduled_emails\` (
        \`email_id\` char(32) NOT NULL COMMENT 'The email ID',
        \`created_at\` varchar(255) NOT NULL COMMENT 'The date that the email was added to the queue',
        \`scheduled_at\` varchar(255) COMMENT 'The date that the email is scheduled to send',
        \`sent_at\` varchar(255) COMMENT 'The timestamp that the email successfully sent',
        \`status\` tinyint NOT NULL DEFAULT '1' COMMENT 'The current status of the email',
        \`fail_reason\` text COMMENT 'The reason that the email failed to send',
        \`retries\` int NOT NULL DEFAULT '1' COMMENT 'Number of attempts it takes for the email to send',
        UNIQUE (\`email_id\`)
      )
    `);

    db.release();

    return dbPool;
  }
}