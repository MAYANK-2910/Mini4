require('dotenv').config()

const express = require('express')
const axios = require('axios')
const app = express()
const { registerServer, deregisterServer , getHealthyServers, getALLservers , startHealthCheck } = require("./heakth-checker")
// Load configuration from environment variables
app.use(express.json())

//Server registry
//this is the list of servers 
//in a real application servers would register but here we are using env variable to simulate that
const InitialServers = (process.env.SERVERS || 'http://localhost:3001,http://localhost:3002,http://localhost:3003')
  .split(',')
  .map(s => s.trim())

// register initial servers on startup
InitialServers.forEach(registerServer);
startHealthCheck(); // start the health check loop


// round robin container
//we check which server to use next and return that server url
//0,1,2,0,1,2,0,1,2... and so on
let current = 0;

function getNextServer() {

    const healthyServers = getHealthyServers();
    if (healthyServers.length === 0) {
        return null; // no healthy servers available
    }
    const server = healthyServers[current % healthyServers.length];
    current = (current + 1) % healthyServers.length; // move to the next server for the next request
    return server;
}


//dynamic registration and deregistration endpoints
//these endpoints allow servers to register and deregister themselves with the load balancer
//in a real application, you would want to add authentication and validation to these endpoints to prevent abuse

app.post("/register", (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }
    registerServer(url);
    res.json({ message: `Server registered: ${url}` });
});

app.post("/deregister", (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }
    deregisterServer(url);
    res.json({ message: `Server deregistered: ${url}` });
});


app.get("/__status", (req, res) => {
    const servers = getALLservers();
    const healthyCount = servers.filter(s => s.healthy).length; 
    res.json({
        summary: {
            total: servers.length,
            healthy: healthyCount,
            unhealthy: servers.length - healthyCount
        },
        servers: servers    });

        });

//main proxy route
//catch all requests and forward to the next healthy server
app.use(async (req , res) => {

    const server = getNextServer()
    if (!server) {

        return res.status(503).json({error: "No healthy servers available"})
    }

    const targetUrl = server.url + req.originalUrl;

    console.log(`[LB] ${req.method} ${req.originalUrl} → ${server.url}`);

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: req.headers,
            timeout: 5000
        });
     
        res.status(response.status).send(response.data); // forward response from server to client
    }
     catch (error) {
        server.healthy = false; // mark server as unhealthy if request fails
        console.error(`[LB] Error proxying to ${server.url}:`, error.message);
        res.status(502).json({ error: "Backend server error" });
    
    }
});


const lb_port = process.env.LB_PORT || 8080;
app.listen(lb_port, () => {
    console.log(`Load balancer is running on port ${lb_port}`)
});

