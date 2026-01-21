

import Session from "../models/Session.model.js";
import AttendanceMark from "../models/AttendanceMark.model.js";
import User from "../models/User.model.js"; // Import User model
import { session_socket_map } from "../../ws.js";

export const mark_attendance = async (req, res) => {
  try {
    const { ssn_id } = req.body;
    const user = req.user; // This contains user ID from JWT


     const session = await Session.findOne({ ssn_id }).lean();
    if (!session) {
      console.log(`❌ Session not found: ${ssn_id} for user ${user.name}`);
      return res.status(400).json({ 
        success: false, 
        message: "ssn_id is required" 
      });
    }

     res.json({ 
      success: true, 
      message: "Attendance request received" 
    });

    // Quick validation
    // if (!ssn_id) {
    //   return res.status(400).json({ 
    //     success: false, 
    //     message: "ssn_id is required" 
    //   });
    // }

    // Send immediate response to user
   

    // Asynchronous processing - pass user ID
    processAttendanceAsync(ssn_id, user.id || user._id);

  } catch (error) {
    console.error("Attendance marking error:", error);
  }
};

// Separate async function for background processing
const processAttendanceAsync = async (ssn_id, userId) => {
  try {
    // 1. Get user from database
    const user = await User.findById(userId).select('name regd_no');
    
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return;
    }

    // 2. Quick session validation
   

    

    // 3. Quick cooldown check
    const recent = await AttendanceMark.findOne({
      user_id: userId,
      ssn_id: ssn_id,
      createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) }
    }).select('_id').lean();

    if (recent) {
      console.log(`⏰ Cooldown violation: ${user.name} (${user.regd_no}) tried to mark attendance again`);
      notifyProfessor(ssn_id, user, true);
      return;
    }

    // 4. Create attendance mark
    let mark;
    try {
      mark = await AttendanceMark.create({
        ssn_id,
        user_id: userId,
        name: user.name,
        regd_no: user.regd_no,
      });
      console.log(`✅ Attendance marked: ${user.name} (${user.regd_no}) for session ${ssn_id}`);
    } catch (dbError) {
      console.error("❌ DB Error:", dbError.message);
      console.log(`User: ${user.name}, Session: ${ssn_id}`);
      notifyProfessor(ssn_id, user, false);
      return;
    }

    // 5. Notify professor via WebSocket
    notifyProfessor(ssn_id, user, false, mark);

  } catch (error) {
    console.error("❌ Background processing error:", error.message);
    if (user) {
      console.log(`User: ${user.name}, Session: ${ssn_id}`);
    } else {
      console.log(`User ID: ${userId}, Session: ${ssn_id}`);
    }
  }
};

// Helper function to notify professor
const notifyProfessor = (ssn_id, user, isCooldown = false, mark = null) => {
  try {
    const prof_socket = session_socket_map.get(ssn_id);
    if (prof_socket && prof_socket.readyState === 1) {
      const message = {
        type: isCooldown ? "attendance_cooldown" : "attendance_marked",
        data: {
          name: user.name,
          regd_no: user.regd_no,
          created_at: mark?.createdAt || new Date(),
          is_cooldown: isCooldown
        },
        timestamp: new Date().toISOString()
      };
      prof_socket.send(JSON.stringify(message));
      console.log(`📡 WebSocket notification sent: ${isCooldown ? 'Cooldown violation' : 'Attendance marked'} for ${user.name}`);
    } else {
      console.log(`⚠️  Professor not connected to session: ${ssn_id}`);
    }
  } catch (wsError) {
    console.error("❌ WebSocket notification error:", wsError.message);
  }
};





export const check_timeout = async (req, res) => {
  try {
    const user_id = req.user._id;
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

    // Find most recent attendance within cooldown period
    const recent = await AttendanceMark.findOne({
      user_id,
      createdAt: { 
        $gt: new Date(Date.now() - COOLDOWN_MS - 60000) // Check slightly wider window
      }
    })
    .sort({ createdAt: -1 })
    .lean();

    const now = new Date();
    let response = {
      success: true,
      is_active: false,
      can_mark_attendance: true,
      timestamp: now.toISOString()
    };

    if (recent) {
      const lastMarkTime = new Date(recent.createdAt);
      const timeElapsed = now.getTime() - lastMarkTime.getTime();
      const timeRemaining = COOLDOWN_MS - timeElapsed;

      if (timeRemaining > 0) {
        // Still in cooldown
        response.is_active = true;
        response.can_mark_attendance = false;
        response.cooldown = {
          total_minutes: 15,
          remaining_ms: timeRemaining,
          remaining_formatted: {
            minutes: Math.floor(timeRemaining / 60000),
            seconds: Math.floor((timeRemaining % 60000) / 1000)
          },
          expires_at: new Date(lastMarkTime.getTime() + COOLDOWN_MS),
          expires_in: Math.ceil(timeRemaining / 1000) // seconds
        };
        response.last_marked = lastMarkTime;
      } else {
        // Cooldown expired
        response.is_active = false;
        response.can_mark_attendance = true;
        response.cooldown_expired_since = Math.abs(timeRemaining);
      }
    }

    // Add cooldown policy info
    response.cooldown_policy = {
      minutes: 15,
      milliseconds: COOLDOWN_MS,
      description: "15 minutes between attendance marks"
    };

    res.json(response);

  } catch (error) {
    console.error("Timeout check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check cooldown status"
    });
  }
};