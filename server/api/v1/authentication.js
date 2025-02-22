const { users } = require("../../../utils/functions");
const { checkRequest } = require("../../../utils/functions").API;
const OTPAuth = require("otpauth");
const router = require("express").Router();

module.exports = function(dbPool) {
  router.all("/:version/login/validate", async function(req, res) {
    if (!(await checkRequest(req, res, { versionEnabled: true, allowedMethods: ["POST"] }))) return;

    let username = req.body.username;
    let password = req.body.password;
    let mfa = req.body.mfa;

    // Whether the client is trying to authorize a pre-login, or login
    //   0 - Unknown
    //   1 - Login
    //   2 - 2FA required
    let type = 0;

    if (username && password)
      type = 1;
    else if (mfa)
      type = 2;
    
    if (type === 0)
      return res.status(400).json({ error: "Invalid arguments have been provided", code: 4002 });
      
    if (type === 1) {
      let user = await users.findByLogin(username, password, { returnAdvancedErrors: true });

      // Ensure the user was found
      if (!user) return res.status(400).json({ error: "Invalid username or password", code: 4201 });
      if (user.error) return res.status(400).json({ error: user.msg || "Invalid username or password", code: user.code || 4201 });

      if (user.second_verification_enabled === 1 && user.second_verification_token) {
        return res.status(200).json({ code: 2201, userAuth: (await users.createAuthenticationToken(user.user_id, 2)) });
      }

      // Get a database connection
      const db = await dbPool.getConnection();
      if (!db) return res.status(500).json({ error: "Something went wrong, please try again later", code: 5004 });
      
      if (user.reset_password) {
        await db.query("UPDATE users SET last_seen = ? WHERE user_id = ? LIMIT 1", [new Date(), user.user_id]);
        db.release();
        return res.status(200).json({ code: 2202, userAuth: (await users.createAuthenticationToken(user.user_id, 1)) });
      }

      await db.query("UPDATE users SET last_seen = ? WHERE user_id = ? LIMIT 1", [new Date(), user.user_id]);
      db.release();
      return res.status(200).json({ code: 2203, userAuth: (await users.createAuthenticationToken(user.user_id, 1)) });
    } else if (type === 2) {
      if (!req.body.token) return res.status(400).json({ error: "You must provide a valid authentication token", code: 4007 });

      const user = await users.findByOauth(req.body.token);

      // Ensure the authentication token is correct
      if (!user || user.error || user.type !== 2)
        return res.status(400).json({ error: "Invalid authentication code provided", code: 4010 });

      // Ensure 2 factor authentication is enabled for the user
      if (user.second_verification_enabled === 0 || !user.second_verification_token)
        return res.status(200).json({ code: 2203, userAuth: (await users.createAuthenticationToken(user.user_id, 1)) });

      const totp = OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(user.second_verification_token),
        algorithm: "SHA1",
        digits: 6,
        period: 30
      });

      const mfaIsValid = totp.validate({ token: userInputCode });

      if (mfaIsValid) {
        // Get a database connection
        const db = await dbPool.getConnection();
        if (!db) return res.status(500).json({ error: "Something went wrong, please try again later", code: 5004 });
        
        await db.query("UPDATE users SET last_seen = ? WHERE user_id = ? LIMIT 1", [new Date(), user.user_id]);
        db.release();

        return res.status(200).json({ code: 2203, userAuth: (await users.createAuthenticationToken(user.user_id, 1)) });
      }
      
      return res.status(400).json({ error: "An invalid MFA code has been provided", code: 4203 });
    }

    res.status(400).json({ error: "Invalid arguments have been provided", code: 4002 });
  });

  return router;
}