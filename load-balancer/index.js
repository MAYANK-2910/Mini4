require('dotenv').config()

const express = require('express')
const axios = require('axios')
const app = express()

// Load configuration from environment variables
app.use(express.json())

//Server registry
//this is the list of servers 
//in a real application servers would register but here we are using env variable to simulate that
const SERVERS = (process.env.SERVERS || 'http://localhost:3001,http://localhost:3002,http://localhost:3003')
  .split(',')
  .map(s => ({ url: s.trim(), healthy: true }))

// round robin container
//we check which server to use next and return that server url
//0,1,2,0,1,2,0,1,2... and so on
let currentIndex = 0;

function getNextServer() {

    for (let i = 0; i < SERVERS.length; i++) {

        const server =
            SERVERS[currentIndex % SERVERS.length];

        currentIndex++;

        if (server.healthy) {
            return server;
        }
    }

    return null;
}

// health check loop 
// we check every 10 seconds if the servers are healthy or not
async function healthCheck() {
    for (const server of SERVERS) {
        try {
            await axios.get(`${server.url}/health`, {
                timeout: 3000
            });

            if (!server.healthy) {
                console.log(`Server recovered: ${server.url}`);
            }

            server.healthy = true;

        } catch (error) {

            if (server.healthy) {
                console.log(`Server failed: ${server.url}`);
            }

            server.healthy = false;
        }
    }

}
healthCheck()
setInterval(healthCheck, 10000);

app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
});
// status endpoint to check which servers are healthy
app.get("/__status", (req, res) => {
    res.json({
        servers: SERVERS.map(s=> ({ url: s.url, healthy: s.healthy }))

    })
})

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
    console.log(`balacing between servers: ${SERVERS.map(s=> s.url).join(", ")}`)
});

