// Paris Ward, Lucas Moraes, Parker Sandstrom, and Joshua Ethington
// This code will help owners of food pantrys manage customers, emplolyees and orders.

// REQUIRE LIBRARIES AND STORE IN VARIABLE (if applicable):
require("dotenv").config(); // DOTENV: loads ENVIROMENT VARIABLES from .env file; Allows you to use process.env
const express = require("express"); // EXPRESS: helps with web development
const session = require("express-session"); // EXPRESS SESSION: needed for session variable. Stored on the server to hold data; Essentially adds a new property to every req object that allows you to store a value per session.
let path = require("path"); // PATH: helps create safe paths when working with file/folder locations
let bodyParser = require("body-parser"); // BODY-PARSER: Allows you to read the body of incoming HTTP requests and makes that data available on req.body
const { error } = require("console");
const knex = require("knex")({
  // KNEX: allows you to work with SQL databases
  client: "pg",
  connection: {
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DB_NAME,
    port: process.env.RDS_PORT,
    ssl: { rejectUnauthorized: false },
  },
});

// CREATE VARIABLES:
let app = express(); // creates an express object called app
const port = process.env.PORT || 3000; // Creates variable to store port. Uses .env variable "PORT". You can also just leave that out if aren't using .env

// PATHS:
app.set("view engine", "ejs"); // Allows you to use EJS for the web pages - requires a views folder and all files are .ejs
app.use("/photos", express.static(path.join(__dirname, "photos"))); // allows you to create path for images (in folder titled "images")
app.use("/css", express.static(path.join(__dirname, "css"))); // serve shared stylesheet assets
app.get("/css/styles.css", (req, res) =>
  res.sendFile(path.join(__dirname, "css", "styles.css"))
); // explicit CSS route for reliability

// MIDDLEWARE: (Middleware is code that runs between the time the request comes to the server and the time the response is sent back. It allows you to intercept and decide if the request should continue. It also allows you to parse the body request from the html form, handle errors, check authentication, etc.)
app.use(express.urlencoded({ extended: true })); // Makes working with HTML forms a lot easier. Takes inputs and stores them in req.body (for post) or req.query (for get).

// SESSION MIDDLEWARE: (Needed for login functionality)
app.use(
  // allows you to use session variables?
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret-key", // only required parameter. Used to sign session cookies. Prevents tampering and session hijacking
    resave: false, // true (default): save session on every request; false (reccomended): only save if modfied
    saveUninitialized: false, // true (default): create session for every request; false (reccomended): only create when data is stored
  })
);

// Content Security Policy middleware - allows localhost connections for development
// This fixes the CSP violation error with Chrome DevTools (fixes chrome errors)
app.use((req, res, next) => {
  // Set a permissive CSP for development that allows localhost connections
  // This allows Chrome DevTools to connect to localhost:3000
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' http://localhost:* ws://localhost:* wss://localhost:*; " +
      "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*; " +
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' https://cdn.jsdelivr.net;"
  );
  next();
});

// Global authentication middleware - runs on EVERY request (Needed for login functionality)
app.use((req, res, next) => {
  // Skip authentication for login routes
  const publicPaths = ["/", "/login", "/logout", "/signUp"];
  const isStaticAsset =
    req.path.startsWith("/css") ||
    req.path.startsWith("/photos") ||
    req.path === "/favicon.ico";

  if (publicPaths.includes(req.path) || isStaticAsset) {
    //continue with the request path
    return next();
  }

  // Check if user is logged in for all other routes
  if (req.session.isLoggedIn) {
    //notice no return because nothing below it
    next(); // User is logged in, continue
  } else {
    res.render("login", { error_message: "Please log in to access this page" });
  }
});

// CREATE ROUTES:

// HOME PAGE
app.get("/", (req, res) => {
  res.render("home");
});

// SIGN UP PAGE
app.get("/signUp", (req, res) => {
  res.render("signUp", { id: null, selectedLocation: null });
});
app.post("/signUp", (req, res) => {
  knex("customers")
    .insert(req.body)
    .returning(["customer_id", "location"]) // return both fields
    .then(([newCustomer]) => {
      res.render("signUp", {
        id: newCustomer.customer_id,
        selectedLocation: newCustomer.location,
      });
    })
    .catch((err) => {
      console.error("Error during sign-up:", err);
      res.status(500).send("Error creating new customer");
    });
});

// LOGIN PAGE
app.get("/login", (req, res) => {
  // route to display login page
  res.render("login", { error_message: " " });
});
app.post("/login", (req, res) => {
  // route that occurs when login button is pressed
  let sName = req.body.username;
  let sPassword = req.body.password;

  knex("employees") // fetch all session attributes
    .select("employee_id", "username", "password", "level")
    .where({ username: sName, password: sPassword })
    .first()
    .then((user) => {
      if (user) {
        // if user is in list, then gather info
        req.session.isLoggedIn = true;
        req.session.username = user.username;
        req.session.userId = user.employee_id;
        req.session.userLevel = user.level;
        res.redirect("/database");
      } else {
        // if not, display error
        res.render("login", { error_message: "Invalid login" });
      }
    })
    .catch((err) => {
      // catch errors if needed
      console.error("Login error:", err);
      res.render("login", { error_message: "Invalid login" });
    });
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});

// DATABASE PAGE
app.get("/database", async (req, res) => {
  try {
    const {
      table = "customers",
      search = "",
      col = "",
      sortColumn = "",
      sortOrder = "asc",
    } = req.query;

    // get table data
    let records = await knex(table).modify((qb) => {
      if (search && col) {
        qb.whereILike(col, `%${search}%`);
      }
      if (sortColumn) {
        qb.orderBy(sortColumn, sortOrder === "desc" ? "desc" : "asc");
      }
    });

    
    // format date objects for display (e.g., Sun Jan 07 2024)
    const formattedRecords = records.map((record) => {
        return Object.fromEntries(
            Object.entries(record).map(([key, value]) => {
                if (value instanceof Date) {
                    return [key, value.toDateString()];
                }
                return [key, value];
            })
        );
    });

    res.render("database", {
      currentTable: table,
      records,
      user: { role: req.session.userLevel },
      error_message: "",
      searchTerm: search,
      col,
      currentSortColumn: sortColumn,
      currentSortOrder: sortOrder,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data from database");
  }
});

// SEARCHING USER
app.post("/search", (req, res) => {
  const searchInput = req.body.search;
  const searchPattern = `%${searchInput}%`;
  const table = req.body.table;
  const col = req.body.col;

  knex(table)
    .whereRaw(`"${col}"::text ILIKE ?`, [searchPattern])
    .then((searchTable) => {
      res.render("database", {
        currentTable: table,
        records: searchTable,
        user: { role: req.session.userLevel },
        error_message: "",
        searchTerm: searchInput,
      });
    })
    .catch((err) => {
      console.error("Error searching user", err);
      res.status(500).json({ err });
    });
});

// DELETING USER
app.post("/delete/:table/:id", async (req, res) => {
  const { table, id } = req.params;

  const primaryKeyByTable = {
    customers: "customer_id",
    employees: "employee_id",
    orders: "order_id",
  };

  const primaryKey = primaryKeyByTable[table];

  try {
    await knex(table).where(primaryKey, id).del();
    res.status(200).json({ success: true });
  } catch (err) {
    console.log("Error deleting record:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ADD USER
app.get("/add/:table", (req, res) => {
  res.render("add", { table: req.params.table, error_message: "" });
});
app.post("/add/:table", (req, res) => {
  // button that adds the user
  const table = req.params.table;

  const primaryKeyByTable = {
    customers: "customer_id",
    employees: "employee_id",
    orders: "order_id",
  };

  const primaryKey = primaryKeyByTable[table];

  const newData = req.body; // form inputs must match column names

  knex(table)
    .insert(newData)
    .then(() => {
      res.redirect(`/database?table=${table}`);
    })
    .catch((err) => {
      console.log("Error adding record:", err.message);
      res.status(500).json({ error: err.message });
    });
});

// EDIT USER
app.get("/edit/:table/:id", async (req, res) => {
  const userId = req.params.id;
  const table = req.params.table;

  const primaryKeyByTable = {
    customers: "customer_id",
    employees: "employee_id",
    orders: "order_id",
  };
  const primaryKey = primaryKeyByTable[table];

  knex
    .select()
    .from(table)
    .where(primaryKey, userId)
    .first()
    .then((user) => {
      if (!user) {
        return res.status(404).render("database", {
          currentTable: table,
          records: searchTable,
          user: { role: req.session.userLevel },
          error_message: "Could not find user to edit.",
          searchTerm: searchInput,
        });
      }
      res.render("edit", { table: table, user, error_message: "", id: userId });
    })
    .catch((err) => {
      console.error("Error fetching user:", err.message);
      res.status(500).render("displayUsers", {
        users: [],
        error_message: "Unable to load user for editing.",
      });
    });
});
app.post("/edit/:table/:id", (req, res) => {
  const table = req.params.table;
  const userId = req.params.id;

  const primaryKeyByTable = {
    customers: "customer_id",
    employees: "employee_id",
    orders: "order_id",
  };

  const primaryKey = primaryKeyByTable[table];

  const updateData = req.body; // form inputs must match column names

  knex(table)
    .where(primaryKey, userId)
    .update(updateData)
    .then(() => {
      res.redirect(`/database?table=${table}`);
    })
    .catch((err) => {
      console.log("Error updating record:", err.message);
      res.status(500).json({ error: err.message });
    });
});

// Tells server to start listening for user & display text in command line
const server = app.listen(port, () => {
  console.log("the server has started to listen");
});

// Log and keep visibility if the server encounters errors or closes unexpectedly
server.on("error", (err) => {
  console.error("Server error:", err);
});
server.on("close", () => {
  console.log("Server closed");
});
