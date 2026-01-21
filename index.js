import "dotenv/config"
import app from "./app.js"

import http from "http"
import {connectDB, disconnectDB} from "./src/config/db.js"
import { closeWebSocketServer } from "./ws.js"
import setupWS from "./ws.js"









const server = http.createServer(app);
setupWS(server);

server.keepAliveTimeout = 65000;   // MUST be > ping interval
server.headersTimeout = 66000; 


// Graceful shutdown function
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // 1. Close WebSocket server first
   
      console.log("🔄 Closing WebSocket server...");
      await closeWebSocketServer();
      console.log("✅ WebSocket server closed");
    
    
    // 2. Close HTTP server
    console.log("🔄 Closing HTTP server...");
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log("✅ HTTP server closed");
    
    // 3. Close database connection
    console.log("🔄 Closing database connection...");
    await disconnectDB();
    
    
    console.log("👋 Shutdown complete");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};


process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // For nodemon

server.listen(process.env.PORT||4000, () => {
    console.log(`✅ 🔱 server is running on port: ${process.env.PORT}`);
    connectDB();
});