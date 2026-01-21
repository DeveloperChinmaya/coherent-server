import mongoose from "mongoose"


const config = {
  development: {
    dbName: 'attendance_app_dev'
  },
  production: {
    dbName: 'attendance_app_prod'
  }
};


const env= process.env.NODE_ENV||"development"
const currConfig= config[env];

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI,{ dbName: currConfig.dbName });
    console.log("✅ ⚓️ MongoDB connected");
  } catch (err) {
    console.error("⚠️ MongoDB connection error:", err);
    process.exit(1);
  }
};

export const disconnectDB= async ()=>{
  try {
    await mongoose.connection.close();
    console.log("✅ Database connection closed");
  } catch (error) {
    console.log("⚠️ MongoDB connection close error:", err)
    
  }
}


 