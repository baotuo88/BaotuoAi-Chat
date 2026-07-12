import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/security/passwordHash";

describe("password hashing", () => {
  it("produces a self-describing pbkdf2 hash string", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const parts = hash.split(":");

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(Number.parseInt(parts[1], 10)).toBe(210_000);
    expect(parts[2]).toBeTruthy();
    expect(parts[3]).toBeTruthy();
  });

  it("verifies a correct password and rejects an incorrect one", async () => {
    const hash = await hashPassword("s3cret-password");

    await expect(verifyPassword("s3cret-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces different salts (and hashes) for the same password", async () => {
    const first = await hashPassword("same-password");
    const second = await hashPassword("same-password");

    expect(first).not.toBe(second);
    await expect(verifyPassword("same-password", first)).resolves.toBe(true);
    await expect(verifyPassword("same-password", second)).resolves.toBe(true);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
    await expect(
      verifyPassword("anything", "pbkdf2:210000:onlythreeparts"),
    ).resolves.toBe(false);
    await expect(
      verifyPassword("anything", "bcrypt:210000:salt:hash"),
    ).resolves.toBe(false);
    await expect(
      verifyPassword("anything", "pbkdf2:not-a-number:salt:hash"),
    ).resolves.toBe(false);
    await expect(
      verifyPassword("anything", "pbkdf2:0:salt:hash"),
    ).resolves.toBe(false);
    await expect(
      verifyPassword("anything", "pbkdf2:210000:not base64!!:hash"),
    ).resolves.toBe(false);
  });
});
