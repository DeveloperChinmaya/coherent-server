import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  ssn_id: { type: String, unique: true, required: true },
  owner_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  ssn_name:{type: String},

  active: { type: Boolean, default: true },
  expiry_time: { type: Date, required: true },


}, {
  timestamps: {
    createdAt: true, 
     updatedAt: false  
  } 
});



export default mongoose.model("Session", SessionSchema);