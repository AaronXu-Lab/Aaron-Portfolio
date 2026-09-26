// Generates an initial fixed administrator account without printing secrets.
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
const dir = join(homedir(), ".config", "formyson");
await mkdir(dir, { recursive: true, mode: 0o700 });
const path = join(dir, "admin.json");
let account;
try {
  account = JSON.parse(await readFile(path, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  account = {
    username: "admin",
    password: randomBytes(24).toString("base64url"),
    url: "https://www.xuweinan.com/formyson/admin/",
  };
  await writeFile(path, JSON.stringify(account, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
}
const salt = randomBytes(24).toString("hex");
const secrets = {
  ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: pbkdf2Sync(
    account.password,
    salt,
    100000,
    32,
    "sha256",
  ).toString("hex"),
};
await writeFile(join(dir, "secrets.json"), JSON.stringify(secrets), {
  mode: 0o600,
});
await writeFile(
  ".dev.vars",
  Object.entries({ ...secrets, ADMIN_USERNAME: account.username })
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
console.log(`Administrator credentials saved privately to ${path}.`);
console.log(`Deployment secret bundle: ${join(dir, "secrets.json")}`);
