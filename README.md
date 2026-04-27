# Deploy Next.js App on AWS EC2 (Full Guide)

## Goal
Run Next.js app on EC2 so that:
Opening EC2 Public IP shows website (without :3000)

---

## 1. EC2 Setup
- Launch EC2 instance (Amazon Linux 2023 / Ubuntu)
- Instance type: t2.micro (free tier ok)
- Download `.pem` key file

---

## 2. Security Group Configuration

Go to:
EC2 -> Security Groups -> Inbound Rules

### Required Rules

#### 1. SSH (Login)
- Type: SSH
- Port: 22
- Source: My IP (recommended) OR 0.0.0.0/0

---

#### 2. HTTP (Website Access) IMPORTANT
- Type: HTTP
- Port: 80
- Source: 0.0.0.0/0

This enables:
http://EC2-PUBLIC-IP

---

#### 3. (Optional) Next.js Dev Port
- Type: Custom TCP
- Port: 3000
- Source: 0.0.0.0/0

Only for testing:
http://EC2-PUBLIC-IP:3000

---

#### 4. (Future) HTTPS
- Type: HTTPS
- Port: 443
- Source: 0.0.0.0/0

---

## 3. SSH into EC2

```bash
ssh -i your-key.pem ec2-user@your-ec2-public-ip
```

## 4. Install Dependencies

Update system:

```bash
sudo dnf update -y
```

Install Git:

```bash
sudo dnf install git -y
```

Install Node.js:

```bash
sudo dnf install nodejs -y
```

Check versions:

```bash
node -v
npm -v
git --version
```

## 5. Clone GitHub Repo

```bash
git clone https://github.com/your-username/your-nextjs-repo.git
cd your-nextjs-repo
```

## 6. Install Project Dependencies

```bash
npm install
```

## 7. Build Next.js App

```bash
npm run build
```

## 8. Run App (Production Mode)

```bash
npm start
```

OR using PM2 (recommended):

```bash
npm install -g pm2
pm2 start npm --name "nextjs-app" -- start
```

## 9. Install Nginx (Reverse Proxy)

```bash
sudo dnf install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 10. Configure Nginx

```bash
sudo nano /etc/nginx/nginx.conf
```

Replace server block with:

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
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 11. Restart Nginx

```bash
sudo systemctl restart nginx
```

## Final Result

Now open in browser:

http://EC2-PUBLIC-IP

- No port required
- Fully working Next.js app
- Production ready setup
