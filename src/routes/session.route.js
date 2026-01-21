// routes/session.routes.js
import express from "express";
import { 
  create_session, 
  stop_session,
  
} from "../controllers/session.controller.js";

import { get_session_history, get_session_entries } from "../controllers/sessionHistory.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const sessionRouter = express.Router();

// All routes require authentication
sessionRouter.use(authenticate);

// Create a new session
sessionRouter.post("/create", create_session);

// Stop an active session
sessionRouter.post("/:ssn_id/stop", stop_session);

// Get session history with pagination
sessionRouter.get("/history", get_session_history);

// Get all entries for a specific session
sessionRouter.get("/:ssn_id/entries", get_session_entries);

export default sessionRouter;