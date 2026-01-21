import {WebSocketServer} from "ws";
import jwt from "jsonwebtoken";
import Session from "./src/models/Session.model.js"
import AttendanceMark from "./src/models/AttendanceMark.model.js"

// Store mapping of session_id to professor's socket
const session_socket_map = new Map();
// Store all connected sockets for cleanup
const connected_sockets = new Set();

let wss;

/**
 * Setup WebSocket server with authentication and session validation
 * @param {Object} server - HTTP server instance
 */
function setupWebSocketServer(server) {
   wss = new WebSocketServer({ 
    server,
    clientTracking: true,
    perMessageDeflate: false
  });
  
  if(wss){
  wss.on('listening', () => {
      console.log('✅ 📞WebSocket server listening');
      
    });
  }

  wss.on("connection", async (ws, req) => {
    try {
      // Extract token from URL query params or headers
      const url = new URL(req.url, `https://${req.headers.host}`);
     

       const encodedToken = url.searchParams.get("token");

      
     

      
      if (!encodedToken) {
        ws.close(1008, "Authentication token required");
        return;
      }

      // Decode URI component (if token was encoded)
    const token = decodeURIComponent(encodedToken);

      // Verify JWT token
      let user;
      try {
        user = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtError) {
        ws.close(1008, "Invalid token");
        return;
      }

      // Only professors can connect (based on your user model)
      if (user.role !== "prof") {
        ws.close(1008, "Only professors can connect");
        return;
      }

      // Get session_id from query params
      const session_id = url.searchParams.get("ssn_id");
      if (!session_id) {
        ws.close(1008, "session_id is required");
        return;
      }

      // Validate session exists and belongs to this professor
      const session = await Session.findOne({
        ssn_id: session_id,
        owner_id: user.id,
        active: true
      });

      if (!session) {
        ws.close(1008, "Invalid or inactive session");
        return;
      }

      // Check if session is expired
      if (new Date() > session.expires_at) {
        ws.close(1008, "Session has expired");
        return;
      }

      // Store socket connection
      ws.user = user;
      ws.session_id = session_id;
      connected_sockets.add(ws);

      // Remove previous socket for this session if exists
      const existingSocket = session_socket_map.get(session_id);
      if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
        existingSocket.close(1000, "New connection established");
      }

      // Map session_id to this socket
      session_socket_map.set(session_id, ws);

      // Send connection success message
      ws.send(JSON.stringify({
        type: "connection_established",
        data: {
          session_id,
          user: user.name || user.email,
          expires_at: session.expires_at,
          connected_at: new Date().toISOString()
        }
      }));

      // Send existing attendance count for this session
      // const AttendanceMark = await import("./src/models/AttendanceMark.model.js");
      const attendanceCount = await AttendanceMark.countDocuments({ 
      ssn_id: session_id 
    });

      ws.send(JSON.stringify({
        type: "session_info",
        data: {
          session_id,
          total_entries: attendanceCount,
          session_created: session.createdAt,
          expires_in: Math.max(0, session.expires_at - new Date())
        }
      }));

      // Handle incoming messages
      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data);
          
          switch (message.type) {
            case "ping":
              ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
              break;
              
            case "get_entries":
              // Send recent entries
              // const AttendanceMark = await import("../models/attendance_mark.model.js");
              const entries = await AttendanceMark.find({ 
                ssn_id: session_id 
              })
              .sort({ createdAt: -1 })
              .limit(20)
              .lean();

              ws.send(JSON.stringify({
                type: "entries_list",
                data: entries.map(entry => ({
                  name: entry.name,
                  regd_no: entry.regd_no,
                  created_at: entry.createdAt,
                  user_id: entry.user_id
                }))
              }));
              break;
              
            case "end_session":
              // End the session
              await Session.findOneAndUpdate(
                { ssn_id: session_id },
                { active: false },
                {expiry_time: Date.now}
              );
              ws.send(JSON.stringify({ 
                type: "session_ended",
                data: { ended_at: new Date().toISOString() }
              }));
              ws.close(1000, "Session ended by professor");
              break;
              
            default:
              ws.send(JSON.stringify({ 
                type: "error", 
                message: "Unknown message type" 
              }));
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Invalid message format" 
          }));
        }
      });

      // Handle connection close
      ws.on("close", (code, reason) => {
        console.log(`WebSocket closed: ${code} - ${reason}`);
        connected_sockets.delete(ws);
        
        // Remove from mapping if this socket is still mapped
        if (session_socket_map.get(session_id) === ws) {
          session_socket_map.delete(session_id);
        }
        
        // Notify about disconnection (optional)
        console.log(`Professor disconnected from session: ${session_id}`);
      });

      // Handle errors
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        connected_sockets.delete(ws);
        if (session_socket_map.get(session_id) === ws) {
          session_socket_map.delete(session_id);
        }
      });

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      ws.on("close", () => clearInterval(heartbeatInterval));

    } catch (error) {
      console.error("WebSocket connection setup error:", error);
      ws.close(1011, "Internal server error");
    }
  });

  // Graceful shutdown handling
  const cleanup = () => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, "Server shutting down");
      }
    });
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  console.log("WebSocket server initialized");
  return wss;
}

/**
 * Broadcast attendance entry to professor
 * @param {string} session_id - Session ID
 * @param {Object} data - Attendance data to send
 */
function broadcastAttendance(session_id, data) {
  const ws = session_socket_map.get(session_id);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: "attendance_marked",
        data: {
          ...data,
          timestamp: new Date().toISOString()
        }
      }));
      return true;
    } catch (error) {
      console.error("Failed to broadcast attendance:", error);
      return false;
    }
  }
  
  return false;
}

/**
 * Get all active sessions
 */
function getActiveSessions() {
  return Array.from(session_socket_map.keys());
}

/**
 * Check if a session has an active WebSocket connection
 */
function isSessionActive(session_id) {
  const ws = session_socket_map.get(session_id);
  return ws && ws.readyState === WebSocket.OPEN;
}

/**
 * Close connection for a specific session
 */
function closeSessionConnection(session_id) {
  const ws = session_socket_map.get(session_id);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, "Session closed");
    session_socket_map.delete(session_id);
    return true;
  }
  return false;
}


async function closeWebSocketServer() {
  if (!wss) {
    console.log("No WebSocket server to close");
    return;
  }

  return new Promise((resolve) => {
    console.log(`Closing ${wss.clients.size} WebSocket connections...`);
    
    // Close all client connections
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, "Server shutting down");
      }
    });
    
    // Close the server
    wss.close(() => {
      console.log("WebSocket server closed successfully");
      wss = null;
      session_socket_map.clear();
      connected_sockets.clear();
      resolve();
    });
    
    // Force close after 5 seconds if not closed gracefully
    setTimeout(() => {
      if (wss) {
        wss.close();
        console.log("WebSocket server force-closed");
        resolve();
      }
    }, 5000);
  });
}


export { 
  setupWebSocketServer, 
  broadcastAttendance, 
  session_socket_map,
  getActiveSessions,
  isSessionActive,
  closeSessionConnection,
  closeWebSocketServer 
};

export default setupWebSocketServer;