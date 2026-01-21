import mongoose from "mongoose"

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  regd_no: String,
  password: String,
  role: { type: String, enum: ["student", "prof"] },
  lastAttendanceAt: Date
});

export default mongoose.model("User", UserSchema);