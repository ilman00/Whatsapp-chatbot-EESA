import bcrypt from "bcryptjs";

async function run() {
  const hash = await bcrypt.hash("me3339461010", 12);
  console.log(hash);
}

run();