# 部署指南

> [English](DEPLOYMENT_EN.md) · [API](API.md) · [架构](ARCHITECTURE.md)

## 前提条件
- Node.js 20+
- npm 10+
- Agnes API Key (https://agnes-ai.com 注册)

## 本地开发
```bash
cd agnes-creator
npm install
npm run dev    # 端口 3000
npm run build  # 生产构建
npm start      # 生产启动
```

## 环境变量
| 变量 | 说明 |
|------|------|
| AGNES_API_KEY | 服务端 API Key (可选) |
| NEXT_PUBLIC_AGNES_API_KEY | 客户端 API Key (可选) |
优先级: env > localStorage > 默认值

## 端口配置
默认 3000。清除占用: `netstat -ano | findstr :3000` 然后 `Stop-Process -Id <PID> -Force`

## 缓存清理
```bash
Remove-Item -Recurse -Force .next
```

## Vercel 部署
1. 推送代码到 GitHub
2. Vercel 导入项目
3. 设置环境变量
4. 自动部署
