// Paris Ward, Lucas Moraes, Parker Sandstrom, and Joshua Ethington
// This code will help owners of food pantrys manage customers, emplolyees and orders.

// require libraries
const express = require("express"); // require express library
let path = require("path"); // require path library
const knex = require("knex")({ // require knex library
    client: "pg", // connect to pg admin
    connection: { // connect to the database info:
        host: "localhost",
        user: "postgres",
        password: "admin",
        database: "foodpantry",
        port: 5432
    }
});

// create variables
let app = express(); // creates express object (stored in app variable)
const port = 3000; // creates a variable to store port

// extra
app.set("view engine", "ejs"); // allows us to use ejs
app.use(express.urlencoded({extended:true})); // helps with html form outputs

// CREATE ROUTES:
// Create route for home/root page 
app.get("/", (req, res) => {
    res.render("home");
});

// Create route for customer sign up page 
app.get("/signUp", (req, res) => {
    res.render("signUp")
});

// Create route for employee login page 
app.get("/login", (req, res) => {
    res.render("login",{ error: null })
});

// Create route for database page 
app.post("/database", (req, res) => {
    res.render("database")
});

// Tells server to start listening for user & display text in command line
app.listen(port,() => console.log("the server has started to listen")); 

