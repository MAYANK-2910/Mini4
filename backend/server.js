// Load environment variables from .env file
// lets us set up port without changing code

require("dotenv").config()

const express = require("express")
const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json())

// In-memory datastore(simulate database )
// In a real application, you would use a database like MongoDB, PostgreSQL, etc.
// this is just for demonstration purposes and will not persist data across server restarts
let datastore =[]
let nextId = 1

// Routes

app.get("/", (req, res) => {
    res.send("Welcome to the Express server! Use /health for health check and /data for data operations.")
})

//health check endpoint
app.get("/health", (req, res) => {
    res.json(
        {
            status: "ok",
            port: PORT,
            uptime: process.uptime().toFixed(2) + " seconds",
            timestamp: new Date().toISOString()
        }
    )
})


app.get("/data", (req, res) => {
    res.json({
        Source: "server", // this is just an example, you can replace it with actual data
        port: PORT,
        count: datastore.length,
        timestamp: new Date().toISOString()

    })
}
)

app.post("/data", (req, res) => {
    const { name } = req.body
    if(!name){
        return res.status(400).json({ error: "Name is required" })
    }
    const item = {
        id: nextId++,
        name: name,
        createdAt: new Date().toISOString(),
        server: PORT // tells us which instance it was created on, useful for load balancing scenarios
    };

    datastore.push(item)
    res.status(201).json({ message: "Item created successfully", item: item })
})

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    console.log(`Health check endpoint available at http://localhost:${PORT}/health`)
    console.log(`data endpoint available at http://localhost:${PORT}/data`)
    console.log(`post items endpoint available at http://localhost:${PORT}/data (POST)`)
});





