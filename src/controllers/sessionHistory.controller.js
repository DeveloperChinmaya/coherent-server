import Session from "../models/Session.model.js";
import AttendanceMark from "../models/AttendanceMark.model.js";



export const get_session_history = async (req, res) => {
  try {
    const user_id = req.user.id;
    const limit = 15;
    const { cursor } = req.query; // cursor is the createdAt date of last item
    
    // Build base query
    const query = { owner_id: user_id };
    
    // Add cursor condition if exists
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    // Fetch sessions
    const sessions = await Session.find(query)
      .select('ssn_id ssn_name createdAt ')
      .sort({ createdAt: -1 })
      .limit(limit + 1); // Fetch one extra to check for more

    // Check if more sessions exist
    const hasMore = sessions.length > limit;
    
    // If we fetched extra, remove it
    const sessionsToReturn = hasMore ? sessions.slice(0, limit) : sessions;

    // Get last returned index/ID for reference
    const lastIndex = sessionsToReturn.length - 1;
    

    res.json({
      success: true,
      sessions: sessionsToReturn.map(session => ({
        ssn_id: session.ssn_id,
        ssn_name:session.ssn_name,
        
        created_at: session.createdAt,
        
      })),
      hasMore,
      lastReturnedIndex: lastIndex,
     
      nextCursor: hasMore ? sessionsToReturn[lastIndex].createdAt : null,
      count: sessionsToReturn.length
    });

  } catch (error) {
    console.error("Error fetching session history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch session history"
    });
  }
};





export const get_session_entries = async (req, res) => {
  try {
    const { ssn_id } = req.params; // Assuming session_id in URL params
    
    // Validate input
    if (!ssn_id) {
      return res.status(400).json({
        success: false,
        message: "session_id is required"
      });
    }

    // Fetch attendance entries for the session
    const attendanceEntries = await AttendanceMark.find({ 
      ssn_id: ssn_id 
    })
    .select('name regd_no createdAt') // Only select required fields
    .sort({ createdAt: -1 }) // Latest entries first
    .lean(); // Return plain JavaScript objects for better performance

    // If no entries found
    if ( attendanceEntries?.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No attendance entries present in this session",
        entries: [],
        count: 0
      });
    }

     if (!attendanceEntries) {
      return res.status(404).json({
        success: false,
        message: "No attendance entries found for this session",
        entries: [],
        count: 0
      });
    }

    // Format response
    res.json({
      success: true,
      ssn_id,
      entries: attendanceEntries.map(entry => ({
        name: entry.name,
        regd_no: entry.regd_no,
        created_at: entry.createdAt, // or entry.createdAt based on your field name
        // If you want to include _id for reference
        // entry_id: entry._id
      })),
      count: attendanceEntries.length,
     
    });

  } catch (error) {
    console.error("Error fetching session entries:", error);
    res.status(500).json({
      success: false,
      message: "server error, failed to fetch session entries",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};