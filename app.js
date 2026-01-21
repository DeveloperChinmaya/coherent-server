import express from "express"

import authRouter from "./src/routes/auth.route.js"
import studentRouter from "./src/routes/student.route.js";
import sessionRouter from "./src/routes/session.route.js";


const app = express();
app.use(express.json());

app.use("/auth", authRouter);

// Session management routes (requires auth)
app.use("/sessions", sessionRouter);

// Attendance marking routes (requires auth)
app.use("/student", studentRouter);


export default app;