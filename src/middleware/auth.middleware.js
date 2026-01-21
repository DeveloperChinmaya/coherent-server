import jwt from "jsonwebtoken"

export const authenticate = (req, res, next) => {
 const authHeader = req.headers.authorization; // 👈 lowercase
  // console.log("Authorization header:", authHeader);

  const token = authHeader?.split(" ")[1];
  // console.log("Extracted token:", token);
  if (!token) return res.sendStatus(401);

  req.user = jwt.verify(token, process.env.JWT_SECRET);
  next();
};

