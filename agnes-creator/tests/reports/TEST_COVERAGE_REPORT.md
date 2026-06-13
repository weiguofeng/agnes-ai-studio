# Audit Phase 3: Coverage Report

## 审计日期
2026-06-13 16:31

## 执行命令
npx vitest run tests/unit/ --coverage

## 覆盖率结果
- Statements: 0% (0/0)
- Branches: 0% (0/0)
- Functions: 0% (0/0)
- Lines: 0% (0/0)

---

## 根因分析

**覆盖率 0% 的原因是: 测试文件未导入实际源码模块。**

测试文件使用内联复制的函数定义 (inline copy), 而非从 src/ 导入。

### 影响
- 测试与源码解耦: 高
- 源码变更测试不感知: 高
- 无法验证源码行覆盖率: 高
- 重构无安全网: 中

### 具体问题文件
| 测试文件 | 内联复制的函数 | 应测试的源文件 |
|----------|---------------|----------------|
| pipelineImageDownloader.test.ts | mapErrorToProductionStatus, getImageFetchErrorLabel | src/services/pipelineImageDownloader.ts |
| errorHandler.test.ts | classifyError | src/lib/errorHandler.ts |
| productionQueueStore.test.ts | 所有状态管理逻辑 | src/stores/productionQueueStore.ts |

---

## 结论
- 测试逻辑正确, 47/47 通过
- **覆盖率工具显示 0%, 因为测试未导入源码**
- 需要重构测试以直接导入源码模块
