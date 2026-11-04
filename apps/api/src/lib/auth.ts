import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { JwtUser } from "../types";

const SECRET = process.env.JWT_SECRET || "mercado-library-dev-secret-change-me";

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function checkPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(user: JwtUser) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): JwtUser {
  const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
  return {
    id: String(payload.sub),
    email: String(payload.email),
    role: String(payload.role),
    name: String(payload.name || ""),
  };
}

export function publicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
