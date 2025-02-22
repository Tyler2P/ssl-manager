const { users, hasNumber } = require("../../../utils/functions");
const { checkRequest, getAuth } = require("../../../utils/functions").API;
const bcrypt = require("bcrypt");
const router = require("express").Router();

module.exports = function(dbPool) {
  router.all("/:version/users/:id/reset-password", async function(req, res) {
    const checkReq = await checkRequest(req, res, { versionEnabled: true, authHeader: true, allowedMethods: ["POST"] }, true);
    if (!checkReq?.bool) return;

    // Find the client that made the request
    const requester = checkReq.user || (await users.findByOauth(req.cookies.auth, { ignoreInvalidVariables: true }));
    if (!requester) return res.status(401).json({ error: "Unauthorized request", code: 4010 });

    // Find the user
    const user = await users.findById(req.params.id);
    if (!user) return res.status(400).json({ error: "User doesn't exist", code: 4004 });

    const password = req.body.password;
    const promptPasswordReset = req.body.promptPasswordReset;

    // Ensure required variables have been provided
    if (!password || ["", " "].includes(password)) return res.status(400).json({ error: "A new password must be provided", code: 4007 });

    if (password.length < 5)
      return res.status(400).json({ error: "Password must be at least 5 characters in length", code: 4005 });
    if (password.length > 255)
      return res.status(400).json({ error: "Password must be under 255 characters in length", code: 4005 });
    if (!hasNumber(password))
      return res.status(400).json({ error: "Password must contain a number", code: 4303 });

    const salt = bcrypt.genSaltSync(8);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Get a database connection
    const db = await dbPool.getConnection();
    if (!db) return res.status(500).json({ error: "Something went wrong, please try again later", code: 5004 });

    // Update user password
    db.execute("UPDATE users SET password=?,reset_password=?,password_update_date=? WHERE user_id=? LIMIT 1", [hashedPassword, [false, "false"].includes(promptPasswordReset) ? 0 : 1, new Date(), user.user_id]);
    // Delete all authentication keys generated from previous password
    db.query("DELETE FROM user_authentication_codes WHERE user_id = ?", [user.user_id]);

    db.release();

    res.status(204).send();
  });
  router.all("/:version/users/:id/permissions", async function(req, res) {
    const checkReq = await checkRequest(req, res, { versionEnabled: true, authHeader: true, allowedMethods: ["POST", "PUT"] }, true);
    if (!checkReq?.bool) return;

    // Find the client that made the request
    const requester = checkReq.user || (await users.findByOauth(req.cookies.auth, { ignoreInvalidVariables: true }));
    if (!requester) return res.status(401).json({ error: "Unauthorized request", code: 4010 });

    // Find the user
    const user = await users.findById(req.params.id);
    if (!user) return res.status(400).json({ error: "User doesn't exist", code: 4004 });

    // TODO: Finish function
  });

  return router;
}