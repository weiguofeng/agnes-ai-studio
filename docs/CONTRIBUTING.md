# 贡献指南

> [English](CONTRIBUTING_EN.md) · [API](API.md) · [架构](ARCHITECTURE.md)

## 开发流程
1. 阅读 README.md / AGENTS.md / docs/
2. `cd agnes-creator && npm install && npm run dev`
3. 在 src/app/ 下创建页面
4. 添加 i18n 支持
5. 实现 UI 组件 + Zustand Store
6. 调用 SDK 方法

## 规范
- TypeScript 严格模式
- 所有 UI 中英文双语
- 硬编码字符串提取到 i18n
- 提交前 npm run build

## 测试
```bash
npm run build        # 必须通过
npm test
npm run qa:closed-loop
```

## 核心原则
1. 角色一致性优先
2. 根因优先
3. 流水线稳定性优先
4. 国际化
