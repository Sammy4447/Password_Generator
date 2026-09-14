# Password Generator — Deploying a Next.js Static Export on AWS EC2 (No Nginx)

This guide shows how to deploy a **Next.js static export** app on an **AWS EC2 instance running Amazon Linux 2023**,

The app is built into a static `out/` folder and served directly with `npx serve out` on **port 3000**.

Example repository used in this guide: <https://github.com/Sammy4447/Password_Generator.git>

---

## 1. Prerequisites

Before you start, make sure you have:

- An **AWS account** with permission to create EC2 instances.
- An **EC2 key pair** (`.pem` file) downloaded to your computer.
- A terminal with an **SSH client** (built into macOS, Linux, and Windows 10+).
- Basic familiarity with the command line.
- A Next.js project configured for static export, i.e. `next.config.ts` contains:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
```

This setting tells Next.js to generate plain HTML, CSS, and JavaScript files into an `out/` folder during the build. No Node.js server is needed to render pages — only a simple static file server.

---

## 2. Step 1 — Launch EC2 Instance

In the AWS Console, go to **EC2 → Instances → Launch instances** and use these settings:

| Setting | Value |
| --- | --- |
| Name | `password-generator` |
| AMI | Amazon Linux 2023 |
| Architecture | 64-bit (x86) |
| Instance type | `t2.micro` or `t3.micro` (Free Tier eligible) |
| Key pair | Select or create one, then download the `.pem` file |
| Network settings | Allow SSH; create a new security group |
| Storage | 8 GiB gp3 (default is fine) |

Click **Launch instance**, then open the instance page and copy its **Public IPv4 address**. You will use that address for SSH and for viewing the app in a browser.

---

## 3. Step 2 — Security Group Inbound Rules

The security group is the firewall for your instance. Open **EC2 → Instances → your instance → Security → Security groups → Edit inbound rules** and add the rules below.

| Type | Protocol | Port range | Source | Purpose |
| --- | --- | --- | --- | --- |
| SSH | TCP | 22 | My IP | Lets you connect to the server from your computer |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | Lets anyone open the app in a browser |

Click **Save rules**. Without the port 3000 rule, the app will run on the server but the browser will just keep loading and eventually time out.

> **Tip:** Restricting SSH to **My IP** instead of `0.0.0.0/0` is safer, because only your current network can attempt to log in.

---

## 4. Step 3 — SSH into EC2

On your local machine, go to the folder containing your `.pem` key file and run:

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

The first command fixes the key file permissions — SSH refuses to use a key that other users can read. The second command logs you in as the default Amazon Linux user, `ec2-user`.

The first time you connect, type `yes` when asked about the host's authenticity. When you are connected, your prompt will look like:

```
[ec2-user@ip-172-31-0-10 ~]$
```

---

## 5. Step 4 — Install Dependencies

Update the system and install Git and Node.js 20:

```bash
sudo dnf update -y
sudo dnf install -y git
sudo dnf install -y nodejs20 nodejs20-npm
```

`dnf` is the package manager on Amazon Linux 2023. Git is needed to download your code, and Node.js is needed to build the app and run the static server.

On Amazon Linux 2023, the `nodejs20` package may install the binaries as `node-20` / `npm-20`. If plain `node` is not found, link them once:

```bash
sudo ln -sf /usr/bin/node-20 /usr/bin/node
sudo ln -sf /usr/bin/npm-20 /usr/bin/npm
```

Now verify the installed versions:

```bash
node -v
npm -v
git --version
```

You should see a Node version starting with `v20`, an npm version, and a Git version. If any command says "command not found", re-run the matching install step above.

---

## 6. Step 5 — Clone the Repository

Download the project source code onto the server:

```bash
cd ~
git clone https://github.com/Sammy4447/Password_Generator.git
cd Password_Generator
```

This creates a `Password_Generator` folder in the home directory (`/home/ec2-user`) and moves you into it. Replace the URL with your own repository if you are deploying a different project.

Confirm the files are there:

```bash
ls
```

You should see `package.json`, `next.config.ts`, and the `src` folder.

---

## 7. Step 6 — Install Packages

Install the project's dependencies:

```bash
npm install
```

This reads `package.json` and downloads every required package into a `node_modules` folder. It may take one to two minutes on a small instance.

If you want a faster, exact install that matches the lock file, you can use:

```bash
npm ci
```

---

## 8. Step 7 — Build the App

Create the production build:

```bash
npm run build
```

Because `output: "export"` is set in `next.config.ts`, Next.js generates a folder named `out/` containing the finished static site.

Check that the folder exists:

```bash
ls out
```

You should see `index.html` along with a `_next` folder. If `out` does not exist, the export setting is missing from `next.config.ts` — add it and build again.

---

## 9. Step 8 — Serve the App using nohup

Start the static file server in the background so it keeps running after you close your SSH session:

```bash
cd ~/Password_Generator
nohup npx serve out -l 3000 > server.log 2>&1 &
```

What each part does:

- `npx serve out` — runs the `serve` package on the `out` folder (downloads it automatically the first time).
- `-l 3000` — listens on port 3000.
- `nohup ... &` — keeps the process alive in the background after logout.
- `> server.log 2>&1` — writes all output and errors into `server.log`.

Confirm it is running:

```bash
ps aux | grep serve
curl http://localhost:3000
```

The `ps` command should list a `serve` process, and `curl` should print HTML. If `curl` fails, check `server.log` for the error.

---

## 10. Step 9 — Open in Browser

Open your app using the instance's public IP address:

```
http://YOUR_EC2_PUBLIC_IP:3000
```

For example: `http://54.210.15.22:3000`

Use **http://**, not `https://` — no SSL certificate is installed in this setup, and a browser forcing HTTPS will fail to connect.

---

## 11. Useful Commands

### Start the app

```bash
cd ~/Password_Generator
nohup npx serve out -l 3000 > server.log 2>&1 &
```

Starts the server in the background.

### Stop the app

```bash
pkill -f "serve out"
```

Stops the running server. To stop whatever is holding port 3000 instead:

```bash
sudo fuser -k 3000/tcp
```

### Check if the app is running

```bash
ps aux | grep serve
sudo ss -tulpn | grep 3000
```

The first command shows the process; the second shows whether port 3000 is being listened on.

### View logs

```bash
tail -f ~/Password_Generator/server.log
```

Shows the log file live. Press `Ctrl + C` to stop watching (this does **not** stop the server).

---

## 12. Redeploy After Code Change

After you push new code to GitHub, update the server with these commands:

```bash
cd ~/Password_Generator
pkill -f "serve out"
git pull origin main
npm install
npm run build
nohup npx serve out -l 3000 > server.log 2>&1 &
```

Step by step, this stops the old server, pulls the latest code, installs any new packages, rebuilds the static files, and starts the server again.

Then reload `http://YOUR_EC2_PUBLIC_IP:3000` in your browser. If you still see the old page, do a hard refresh (`Ctrl + Shift + R`, or `Cmd + Shift + R` on macOS) to clear the cached files.

---

## 13. Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Browser keeps loading, then times out | Port 3000 is not open in the security group | Add an inbound rule: Custom TCP, port 3000, source `0.0.0.0/0` |
| `Permission denied (publickey)` on SSH | Wrong key, wrong username, or loose key permissions | Run `chmod 400 your-key.pem` and connect as `ec2-user` |
| `node: command not found` | Node.js not installed or not linked | Re-run the install step, then `sudo ln -sf /usr/bin/node-20 /usr/bin/node` |
| `out` folder missing after build | `output: "export"` missing in `next.config.ts` | Add the setting, then run `npm run build` again |
| App stops when you close the terminal | Server started without `nohup` | Restart with `nohup npx serve out -l 3000 > server.log 2>&1 &` |
| `EADDRINUSE: port 3000 already in use` | An old server is still running | Run `pkill -f "serve out"` or `sudo fuser -k 3000/tcp`, then start again |
| Build fails with "JavaScript heap out of memory" | Instance has too little RAM | Use a larger instance, or add swap space |
| Site shows old content after redeploy | Browser cache | Hard refresh with `Ctrl + Shift + R` |
| `npx serve` hangs asking to install | First run needs confirmation | Run `npm install -g serve` once, then use `serve out -l 3000` |

---

## Notes

- This setup serves plain **HTTP on port 3000**. For a production site with a domain name and HTTPS, put the app behind a reverse proxy or an AWS load balancer with an SSL certificate.
- `nohup` is the simplest way to keep the app running. For automatic restarts after a reboot or crash, consider **PM2** or a **systemd** service.
- The public IP changes every time you stop and start the instance. Attach an **Elastic IP** to keep the address stable.
