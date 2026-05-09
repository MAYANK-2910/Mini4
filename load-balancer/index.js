require('dotenv').config()

const express = require('express')
const axios = require('axios')
const app = express()

// Load configuration from environment variables
app.use(express.json())

//Server registory
//this is the list of servers 
//in a real application server would register but here we are using env variable to simulate that
const SEVERS = (process.env.SEVERS || 'http://localhost:3001,http://localhost:3002,http://localhost:3003').split(',').map(s=>({ url: s.trim() , healthy: true}))

// round robin container
//we check which server to use next and return that server url
//0,1,2,0,1,2,0,1,2... and so on
let currentIndex = 0

function getNextServer() {
    const healthy= SEVERS.filter(s=> s.healthy)
      if(healthy.length === 0) // all servers are down {
        return null}

// pick next server in round robin fashion
    const server = healthy[currentIndex % healthy.length]
    currentIndex = (currentIndex + 1) % healthy.length
    return server


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

    setTimeout(healthCheck, 10000);
}

healthCheck(); 


//main proxy route
//catch all requests and forward to the next healthy server
app.all("*", async (req , res) => {
    const server =getNextServer()
    if(!server){
        return res.status(503).json({error: "No healthy servers available"})
    }
    const targetUrl = server.url + req.originalUrl;
    console.log(`[LB] ${req.method} ${req.originalUrl} → ${server.url}`);

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: { "Content-Type": "application/json" },
            timeout: 5000
        });
        res.status(response.status).json(response.data); // forward response from server to client
    } catch (error) {
        server.healthy = false; // mark server as unhealthy if request fails
        console.error(`[LB] Error proxying to ${server.url}:`, error.message);
        res.status(502).json({ error: "Backend server error" });
    }
});
// status endpoint to check which servers are healthy
app.get("/__status", (req, res) => {
    res.json({
        servers: SERVERS.map(s=> ({ url: s.url, healthy: s.healthy }))

    })
})

const lb_port = process.env.LB_PORT || 8030;
app.listen(lb_port, () => {
    console.log(`Load balancer is running on port ${lb_port}`)
    console.log(`balacing between servers: ${SERVERS.map(s=> s.url).join(", ")}`)
});

