const axios = require("axios")

//SYSTERM REGISTRY 
// instead of plain array , each server entry has rich mata data for bettter tracking

const registry = new Map();

function MakeServerEntry(url){
    return{
        url ,
        healthy: true,
        failureCount: 0,
        lastChecked: null,
        lastseen: null,
        registeredAt: new Date().toDateString()
    }
};

//register / deregister servers
//register on startup and deregister on shutdown

function registerServer(url){
    if(!registry.has(url)){
        registry.set(url, MakeServerEntry(url));
        console.log(`[Registry] Server registered : ${url}`);
    }
}
function deregisterServer(url){
    if(registry.has(url)){
        registry.delete(url);
        console.log(`[Registry] Server deregistered : ${url}`);
    }}

//get healthy servers
function getHealthyServers(){
    return [...registry.values()].filter(server => server.healthy);
}    
function getALLservers(){
    return [...registry.values()];
}

//health check logic
//health check loop that runs at regular intervals to check the health of each registered server
const threshold = 2; //failure threshold
const HEALTH_CHECK_INTERVAL = 10000; //10 seconds
async function checkServer(server){
    try{
        const wasHealthy = server.healthy;
        const startTime = Date.now();
        const response = await axios.get(server.url + "/health", { timeout: 3000 });
        const responseTime = Date.now() - startTime;
        const wasDown = response.status !== 200;

        server.lastChecked = new Date().toDateString();
        server.lastseen = new Date().toDateString();
        server.healthy = response.status === 200;
        server.failureCount = 0;
        server.responseTime = responseTime + "ms";

        if (wasDown && server.healthy) {
            console.log(`[Health Check] Server ${server.url} is back online.`);
        } else if (!server.healthy && wasHealthy) {
            console.log(`[Health Check] Server ${server.url} responded with status ${response.status}.`);
        }

    } catch (error) {
        const wasHealthy = server.healthy;
        server.failureCount++;
        server.lastChecked = new Date().toDateString();

        if (server.failureCount >= threshold) {
            server.healthy = false;
            if (wasHealthy) {
                console.log(`[Health Check] Server ${server.url} is marked as unhealthy.`);
            } else {
                console.log(`[Health Check] Server ${server.url} is still unhealthy. Failure count: ${server.failureCount}`);
            }
        }
    }
}

async function checkAllServers(){
    const servers =[...registry.values()];
   // check all servers in parallel
    await Promise.all(servers.map(server => checkServer(server)));

}
async function startHealthCheck(){
    console.log("[Health Checker] Starting health check loop...");
    setInterval(checkAllServers, HEALTH_CHECK_INTERVAL);
}

module.exports = {
    registerServer,
    deregisterServer,
    getHealthyServers,
    getALLservers,
    startHealthCheck
}
