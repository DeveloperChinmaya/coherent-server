import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import User from "../models/User.model.js"

const authRouter = Router()

authRouter.post("/signup", async (req, res) => {
  const { name, email, password, regd_no, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await User.create({ name, email, password: hash, regd_no, role });
  res.json({ ok: true });
});

authRouter.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  const user = await User.findOne({ email, role });
  if (!user) return res.sendStatus(401);

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.sendStatus(401);

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  console.log(token);
  res.json({ token, user });
});

export default authRouter;