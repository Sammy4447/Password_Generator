# Deploy a Next.js App on AWS EC2 (Full Guide)

**Goal:** open the EC2 public IP in a browser and see the site — no `:3000` in the URL.

```
Browser  →  :80 Nginx  →  static files (or Node on :3000)
```

> **Which path do you need?**
> - `next.config.ts` has `output: "export"` → the build produces a static `out/` folder.
>   Nginx serves those files directly. **This project uses this path.** → [Path A](#path-a--static-export-recommended-here)
> - No `output: "export"` → you need a running Node server and Nginx as a reverse proxy.
>   → [Path B](#path-b--node-server--reverse-proxy)

---

## 1. Launch the EC2 Instance

- AMI: Amazon Linux 2023 (or Ubuntu — swap `dnf` for `apt` below)
- Instance type: `t2.micro` (free tier)
- Download the `.pem` key file and keep it safe

---

## 2. Security Group — Inbound Rules

`EC2 → Security Groups → Inbound rules → Edit`

| # | Purpose | Type | Port | Source | Notes |
|---|---------|------|------|--------|-------|
| 1 | SSH login | SSH | 22 | My IP | `0.0.0.0/0` works but is less safe |
| 2 | **Website** | HTTP | 80 | `0.0.0.0/0` | **Required** — this is what makes `http://IP` work |
| 3 | Dev testing (optional) | Custom TCP | 3000 | `0.0.0.0/0` | Only to test `http://IP:3000`; remove later |
| 4 | HTTPS (future) | HTTPS | 443 | `0.0.0.0/0` | For Certbot / SSL |

---

## 3. SSH into the Instance

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ec2-user@<ec2-public-ip>
```

`ec2-user` is for Amazon Linux. On Ubuntu use `ubuntu@<ip>`.

---

## 4. Install Dependencies

> ⚠️ **Node version matters.** Next.js 16 requires **Node >= 20.9.0**. The plain
> `nodejs` package on Amazon Linux 2023 installs **Node 18**, which fails the build with
> `You are using Node.js 18.x. For Next.js, Node.js version >= v20.9.0 is required.`
> Install Node 20 (or 22) explicitly.

```bash
sudo dnf update -y
sudo dnf install git nginx -y
sudo dnf install nodejs20 nodejs20-npm -y      # AL2023: nodejs22 also available
```

If `node` still points at 18 (or isn't found), select the right binary:

```bash
sudo alternatives --install /usr/bin/node node /usr/bin/node-20 90
sudo alternatives --install /usr/bin/npm  npm  /usr/bin/npm-20  90
```

**Verify before building — `node -v` must print `v20.x` or higher:**

```bash
node -v
npm -v
git --version
nginx -v
```

<details>
<summary>Alternative: install Node via nvm (works on any distro, no sudo)</summary>

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm alias default 20
node -v
```

Note: nvm installs Node into your user's home directory. If you later run the app under
`sudo`, `systemd`, or another user, that shell won't see the nvm-installed `node` —
use the `dnf` packages above for anything running as a service.
</details>

<details>
<summary>Ubuntu instead of Amazon Linux</summary>

`apt install nodejs` also ships an old version — use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
node -v
```
</details>

---

## 5. Clone and Build

```bash
git clone https://github.com/Sammy4447/Password_Generator.git
cd Password_Generator
npm install
npm run build
```

- With `output: "export"` → output is in `./out` → continue with **Path A**
- Without it → `.next` build for a Node server → continue with **Path B**

---

## Path A — Static Export (recommended here)

### A1. Copy the build to a web root

```bash
sudo mkdir -p /var/www/app
sudo cp -r out/* /var/www/app/
sudo chown -R nginx:nginx /var/www/app
sudo chmod -R 755 /var/www
```

### A2. Nginx config

```bash
sudo nano /etc/nginx/conf.d/app.conf
```

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/app;
    index index.html;

    location / {
        try_files $uri $uri.html $uri/index.html /index.html;
    }
}
```

### A3. Disable the default Nginx site

Nginx ships with its own `server` block on port 80 (the "Welcome to nginx!" page) inside
`/etc/nginx/nginx.conf`. Two blocks on the same port conflict, and the built-in one wins —
so you must switch it off, otherwise you keep seeing the welcome page instead of your site.

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak   # backup first
sudo nano /etc/nginx/nginx.conf
```

Find the block that looks like this (inside `http { ... }`, roughly line 40-60):

```nginx
    server {
        listen       80;
        listen       [::]:80;
        server_name  _;
        root         /usr/share/nginx/html;

        include /etc/nginx/default.d/*.conf;

        error_page 404 /404.html;
        location = /404.html {
        }

        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
        }
    }
```

Put a `#` at the start of **every line of that block**, from `server {` down to its closing
`}`:

```nginx
#    server {
#        listen       80;
#        listen       [::]:80;
#        server_name  _;
#        root         /usr/share/nginx/html;
#
#        include /etc/nginx/default.d/*.conf;
#
#        error_page 404 /404.html;
#        location = /404.html {
#        }
#
#        error_page 500 502 503 504 /50x.html;
#        location = /50x.html {
#        }
#    }
```

Do **not** comment out anything else — leave `user`, `worker_processes`, `events { }`,
the `http {` line, the `include /etc/nginx/conf.d/*.conf;` line, and the final `}`
untouched. That `include` line is what loads your `app.conf`.

Save and exit: `Ctrl+O`, `Enter`, `Ctrl+X`.

Then always verify before restarting:

```bash
sudo nginx -t
```

`syntax is ok` + `test is successful` means the block is closed correctly. If it errors,
restore the backup with `sudo cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf` and try again.

<details>
<summary>Don't want to edit nginx.conf? Use this instead</summary>

Add `default_server` to your own block in `/etc/nginx/conf.d/app.conf` so it takes priority:

```nginx
listen 80 default_server;
```

This works only if the built-in block does **not** also say `default_server` — if it does,
Nginx refuses to start with `duplicate default server`, and you're back to commenting it out.
</details>

### A4. Start Nginx

```bash
sudo nginx -t                      # config must say "syntax is ok"
sudo systemctl enable --now nginx
sudo systemctl restart nginx
```

### A5. Redeploy after a code change

```bash
cd ~/Password_Generator
git pull
npm install
npm run build
sudo rm -rf /var/www/app/*
sudo cp -r out/* /var/www/app/
sudo chown -R nginx:nginx /var/www/app
```

No Nginx restart needed — the files are read on every request.

---

## Path B — Node Server + Reverse Proxy

Use this only when `output: "export"` is **not** set. (`next start` fails on a static export build.)

### B1. Run the app with PM2

```bash
sudo npm install -g pm2
pm2 start npm --name "nextjs-app" -- start
pm2 startup          # run the command it prints
pm2 save             # survives reboot
```

Useful commands: `pm2 logs`, `pm2 restart nextjs-app`, `pm2 status`

### B2. Nginx reverse proxy

```bash
sudo nano /etc/nginx/conf.d/app.conf
```

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then disable the built-in default server block exactly as described in
[step A3](#a3-disable-the-default-nginx-site) — otherwise Nginx keeps showing its welcome
page instead of proxying to your app. Then:

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl restart nginx
```

### B3. Redeploy after a code change

```bash
cd ~/Password_Generator
git pull
npm install
npm run build
pm2 restart nextjs-app
```

---

## 6. Result

Open in a browser:

```
http://<ec2-public-ip>
```

- No port number needed
- Nginx on port 80 is the entry point
- Production-ready setup

---

## 7. (Optional) HTTPS with a Free SSL Certificate

Needs a domain pointed at the EC2 IP (A record) and port 443 open.

```bash
sudo dnf install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl enable --now certbot-renew.timer
```

---

## Troubleshooting

| Problem | Cause / Fix |
|---------|-------------|
| Browser just spins, then times out | Port 80 missing in the security group inbound rules |
| **502 Bad Gateway** | App isn't running on :3000 → `pm2 status`, `pm2 logs` |
| **403 Forbidden** | Wrong permissions on the web root → `sudo chown -R nginx:nginx /var/www/app` |
| Nginx welcome page shows instead of the site | Built-in `server` block in `nginx.conf` still active — see [A3](#a3-disable-the-default-nginx-site) |
| `nginx: [emerg] duplicate default server for 0.0.0.0:80` | Two blocks marked `default_server` — keep only one |
| `nginx: [emerg] ... conflicting server name` | Two `server` blocks on port 80 — keep only one |
| `next start` errors out | The build used `output: "export"` → use Path A, not Path B |
| `Node.js version >= v20.9.0 is required` on `npm run build` | Node 18 installed — see [step 4](#4-install-dependencies), install `nodejs20` |
| Build killed / out of memory on `t2.micro` | Add swap: `sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Site works on `:3000` but not on `:80` | Nginx not running or not restarted → `sudo systemctl status nginx` |

Handy log commands:

```bash
sudo tail -f /var/log/nginx/error.log
sudo systemctl status nginx
pm2 logs
```
