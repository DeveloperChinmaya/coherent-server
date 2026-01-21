import Session from "../models/Session.model.js";
import { generate_ssn_id } from "../utils/ssn.util.js";

export const create_session = async (req, res) => {
  const ssn_id = generate_ssn_id();

  const ssn_name= req.body.name;
  console.log(ssn_name);

  const session = await Session.create({
    ssn_id,
    ssn_name,
    owner_id: req.user.id,
    expiry_time: new Date(Date.now() + 10 * 60 * 1000), // 10 min
  });

  res.json({
    ssn_id: session.ssn_id,
    expiry_time: session.expires_at,
  });
};




export const stop_session = async (req, res) => {
  try {
    const { ssn_id } = req.params;

    // Validate input
    if (!ssn_id) {
      return res.status(400).json({
        success: false,
        message: "ssn_id is required in request body"
      });
    }

    // Find and update the session
    const updatedSession = await Session.findOneAndUpdate(
      { 
        ssn_id, 
        active: true  // Only update if it's currently active
      },
      {
        $set: {
          active: false,
          expires_at: new Date(Date.now()), // Set to current time
          updatedAt: new Date()  // Update timestamp
        }
      },
      {
        new: true,  // Return the updated document
        runValidators: true  // Run schema validators
      }
    );

    // Check if session was found
    if (!updatedSession) {
      return res.status(404).json({
        success: false,
        message: "Active session not found or already stopped"
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Session stopped successfully",
      session: {
        ssn_id: updatedSession.ssn_id,
        active: updatedSession.active,
        expires_at: updatedSession.expires_at,
        stopped_at: new Date() // Optional: add when it was stopped
      }
    });

  } catch (error) {
    console.error("Error stopping session:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};