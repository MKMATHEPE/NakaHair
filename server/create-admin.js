// Run with: npm run create-admin
// Creates the admin account the first time, or resets the password if the
// username already exists. Password is hashed with bcrypt before storage —
// the plain text is never saved anywhere.
const readline = require("readline");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const bcrypt = require("bcryptjs");
const { db } = require("./db");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

// Hides password input in the terminal so it isn't echoed to the screen.
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    let input = "";
    const onData = (charBuf) => {
      const char = charBuf.toString("utf8");
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "\u0003") {
        process.exit(1); // Ctrl+C
      } else if (char === "\u007f") {
        input = input.slice(0, -1); // backspace
      } else {
        input += char;
      }
    };
    stdin.on("data", onData);
  });
}

(async () => {
  console.log("── Bono Hair: create or reset the admin account ──");
  const username = (await ask("Username: ")).trim();
  const password = await askHidden("Password: ");

  if (!username || !password) {
    console.log("Username and password are both required.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.log("Use a password of at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO admins (username, passwordHash) VALUES (?, ?)
     ON CONFLICT(username) DO UPDATE SET passwordHash = excluded.passwordHash`,
  ).run(username, passwordHash);

  console.log(`Admin account "${username}" is ready. You can log in on the site now.`);
  process.exit(0);
})();
