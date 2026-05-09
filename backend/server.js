// Load environment variables from .env file
// lets us set up port without changing code

require("dotenv").config()

const express = require("express")
const app = express()
const port = process.env.PORT || 3001

// Middleware
app.use(express.json())

// In-memory datastore(simulate database )
// In a real application, you would use a database like MongoDB, PostgreSQL, etc.
// this is just for demonstration purposes and will not persist data across server restarts
let datastore =[]
let nextId = 1

// Routes

// Get all items
app.get("/api/items", (req, res) => {
  res.json(datastore)
})