import crypto from "crypto";

export function generate_ssn_id() {
  return crypto.randomUUID(); // UUID v4
}