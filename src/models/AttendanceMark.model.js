import mongoose from "mongoose";

const AttendanceMarkSchema = new mongoose.Schema({
  ssn_id: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true },

  name: { type: String, required: true },
  regd_no: { type: String, required: true },
}, {
  timestamps: true  // Adds createdAt and updatedAt automatically
});

AttendanceMarkSchema.index({ ssn_id: 1 });
AttendanceMarkSchema.index({ user_id: 1, ssn_id: 1 }, { unique: true });

export default mongoose.model("AttendanceMark", AttendanceMarkSchema);