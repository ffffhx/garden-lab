import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const itemJson = JSON.parse(
  execFileSync(
    "op",
    [
      "item",
      "get",
      "drfe65irqz653wdj2gwdxyfa3u",
      "--vault",
      "m3l267jrexhwt6bzvns4z4pyzy",
      "--format",
      "json",
    ],
    {
      encoding: "utf8",
    }
  )
);

const privKeyField = itemJson.fields.find(
  (f) => f.id === "private_key" || f.label === "private key"
);
const keyVal = privKeyField.value;

const keyPath = path.join(os.tmpdir(), `tc_rsa_${Date.now()}`);
fs.writeFileSync(keyPath, keyVal.replace(/\r\n/g, "\n"), { encoding: "utf8" });

const user = process.env.USERNAME;
execSync(`icacls "${keyPath}" /inheritance:r /grant:r "${user}:(R)"`);

try {
  console.log("Checking remote containers...");
  const containers = execFileSync(
    "ssh",
    ["-i", keyPath, "-o", "StrictHostKeyChecking=no", "ubuntu@124.221.36.36", "sudo docker ps"],
    { encoding: "utf8" }
  );
  console.log(containers);

  console.log("Ensuring remote staging directory exists...");
  execFileSync(
    "ssh",
    [
      "-i",
      keyPath,
      "-o",
      "StrictHostKeyChecking=no",
      "ubuntu@124.221.36.36",
      "mkdir -p /home/ubuntu/garden-api-data/private-blog",
    ],
    { encoding: "utf8" }
  );

  console.log("Syncing private-blog files to remote server...");
  const localDataDir = path.resolve("apps/garden-api/data/private-blog");
  const files = fs.readdirSync(localDataDir);

  for (const file of files) {
    const localFile = path.join(localDataDir, file);
    console.log(`Uploading ${file}...`);
    execFileSync(
      "scp",
      [
        "-i",
        keyPath,
        "-o",
        "StrictHostKeyChecking=no",
        localFile,
        `ubuntu@124.221.36.36:/home/ubuntu/garden-api-data/private-blog/${file}`,
      ],
      { encoding: "utf8" }
    );
  }

  console.log("Copying into container volume if needed...");
  execFileSync(
    "ssh",
    [
      "-i",
      keyPath,
      "-o",
      "StrictHostKeyChecking=no",
      "ubuntu@124.221.36.36",
      "sudo docker cp /home/ubuntu/garden-api-data/private-blog/. garden-lab-api:/data/private-blog/ && sudo docker restart garden-lab-api",
    ],
    { encoding: "utf8" }
  );

  console.log("Successfully synced all private blog files to Tencent Cloud and restarted container!");
} finally {
  try {
    fs.unlinkSync(keyPath);
  } catch {}
}
