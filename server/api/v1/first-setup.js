const { users, generateId, hasNumber } = require("../../../utils/functions");
const { checkRequest } = require("../../../utils/functions").API;
const cache = require("../../../utils/cache");
const configHandler = require("../../../utils/config-handler");
const bcrypt = require("bcrypt");
const router = require("express").Router();

module.exports = function(dbPool) {
  router.all("/:version/first-setup/create-account", async function(req, res) {
    if (!(await checkRequest(req, res, { versionEnabled: true, allowedMethods: ["POST"],  }))) return;
    if (cache.firstSetup === false)
      return res.status(400).json({ error: "This site has already been setup. If you have forgotten a local account's password, please refer to the official documentation", code: 5008 });

    const username = req.body.username;
    const password = req.body.password;
    let errors = [];

    if (!username || ["", " "].includes(username))
      errors.push({ type: "password", error: "An invalid username was provided" });
    if (!password || ["", " "].includes(password))
      errors.push({ type: "password", error: "An invalid password was provided" });

    if (errors.length > 0)
      return res.status(400).json({ errors, code: 4015 });

    if (password.length < 5)
      return res.status(400).json({ errors: [{ type: "password", error: "Password must be at least 5 characters in length" }], code: 4015 });
    if (password.length > 255)
      return res.status(400).json({ errors: [{ type: "password", error: "Password must be under 255 characters in length" }], code: 4015 });
    if (!hasNumber(password))
      return res.status(400).json({ errors: [{ type: "password", error: "Password must contain a number" }], code: 4015 });

    const salt = bcrypt.genSaltSync(8);
    const hashedPassword = bcrypt.hashSync(password, salt);
    
    let result = configHandler.write({ rootUser: { id: generateId(25), username, password: hashedPassword } });

    if (!result) return res.status(500).json({ error: "Something went wrong. please try again", code: 5001 });

    res.status(204).send();
  });

  return router;
}