// routes/attendance.routes.js
import express from "express";
import { 
  mark_attendance,
  check_timeout 
} from "../controllers/studentAttendance.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const studentRouter = express.Router();

// All routes require authentication
studentRouter.use(authenticate);

// Mark attendance for a session
studentRouter.post("/mark", mark_attendance);

// Check if student is in cooldown timeout
studentRouter.get("/timeout-check", check_timeout);

export default studentRouter;