const { sendPage, formatLog } = require("./utils/functions");
const express = require("express");
const cookies = require("cookie-parser");
const cors = require("cors");
const ejs = require("ejs");
const path = require("path");
const setupDatabase = require("./utils/database").setup;
const configHandler = require("./utils/config-handler");
const app = express();

if (!process.env.NODE_ENV || ["DEV", "DEVELOPMENT"].includes(process.env.NODE_ENV)) {
  // Load ENV variables
  require("dotenv").config();
  console.log(formatLog("INFO", "Environment variables have been set"));

  if ((process.env.MAX_DB_CONNECTIONS || 5) < 3) {
    console.log(formatLog("WARN", "Environment variable 'MAX_DB_CONNECTIONS' needs to be greater than 2 for this application to work correctly. Defaulting to 5"));
    process.env.MAX_DB_CONNECTIONS = 5;
  }
}

(async () => {
  // Ensure the database is setup correctly and grab a connection
  const dbPool = await setupDatabase();

  // Test global configuration file
  configHandler.test();

  // Set views
  app.set("view engine", "ejs");
  app.engine("ejs", ejs.renderFile);
  app.set("views", path.join(__dirname, "./views"));
  // Parse the cookies
  app.use(cookies());
  // Parse body information
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ extended: true }));
  // Enable CORS
  let origins = "*";
  if (["PROD", "PRODUCTION"].includes(process.env.NODE_ENV) && process.env.WEBSITE_DOMAINS) {
    origins = (process.env.WEBSITE_DOMAINS).replaceAll(" ", "").split(";");
  } else if (["PROD", "PRODUCTION"].includes(process.env.NODE_ENV) && process.env.PRIMARY_DOMAIN) {
    origins = process.env.PRIMARY_DOMAIN;
  }
  app.use(cors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "PATCH" , "DELETE"],
    optionsSuccessStatus: 200 // Support for older browsers such as IE
  }));

  // Handle static files
  app.use("/assets", express.static("assets"));

  app.use("/",
    require("./server/root")(dbPool),
    require("./server/first-setup")(dbPool)
  );
  app.use("/auth", require("./server/login")(dbPool));
  app.use("/api",
    require("./server/api/v1/account")(dbPool),
    require("./server/api/v1/authentication")(dbPool),
    require("./server/api/v1/certificates")(dbPool),
    require("./server/api/v1/first-setup")(dbPool),
    require("./server/api/v1/settings")(dbPool)
  );

  app.all("*", function(req, res) {
    if (req.path.includes("/api")) {
      res.status(404).json({ error: "Resource not found", code: 4012 });
    } else {
      sendPage(req, res, "errors/404.ejs", { status: 404 });
    }
  });

  app.listen(process.env.SERVER_PORT || 6007, () => console.log(formatLog("INFO", "Server is online on port " + (process.env.SERVER_PORT || 6007))));
})();