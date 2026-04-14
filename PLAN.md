# 实施计划：领域对象接入 Svelte

## 🎯 目标
将 `code_yuri/` 中的 OO 领域对象接入 Svelte UI，通过 Store Adapter 实现响应式更新。

---

## ✅ 阶段 1：建立领域对象入口

- [x] 创建 `src/domain/index.js`
- [x] 创建 `src/domain/sudoku.js`
- [x] 创建 `src/domain/game.js`
- [x] 从 `code_yuri/` 复制文件

---

## ✅ 阶段 2：创建 Store Adapter

- [x] 创建 `src/stores/gameStore.js`
- [x] 实现操作方法：`startNew()`, `guess()`, `undo()`, `redo()`
- [x] 实现工具函数：`computeInvalidCells()`, `checkWon()`
- [x] 验证：19 个手动测试全部通过（运行 `node verify-gameStore.mjs`）

---

## ✅ 阶段 3：修改 UI 组件

- [x] 修改 `Board/index.svelte`：使用 `$gameStore.grid` 和 `$gameStore.invalidCells`
- [x] 修改 `Controls/Keyboard.svelte`：使用 `gameStore.guess()`
- [x] 修改 `Controls/ActionBar/Actions.svelte`：绑定 undo/redo 按钮
- [x] 修改 `@sudoku/game.js`：使用 `gameStore.startNew()`

---

## ✅ 阶段 4：调试响应式

- [x] 验证 `updateAllStores()` 使用 `.set()` 创建新引用
- [x] 验证领域对象内部深拷贝（`getGrid()` 返回新数组）
- [x] 验证 `invalidCells` 每次操作后重新计算
- [x] 验证 `canUndo/canRedo` 正确更新
- [x] 同步旧 `userGrid` 保持向后兼容（hint、gameWon 等仍依赖它）

---

## ⏳ 阶段 5：编写 DESIGN.md

- [ ] 说明领域对象如何被消费
- [ ] 说明响应式机制原理
- [ ] 说明相比 HW1 的改进
- [ ] 回答作业要求的所有问题

---

## ✅ 完成标准

| 标准 | 状态 |
|:---|:---|
| 测试通过 | ✅ 19 个手动测试通过 |
| UI 正确渲染 | ⏳ 需浏览器验证 |
| 用户输入生效 | ⏳ 需浏览器验证 |
| Undo/Redo 可用 | ⏳ 需浏览器验证 |
| 自动刷新 | ⏳ 需浏览器验证 |
| DESIGN.md 完成 | ❌ 未开始 |

---

## 📝 本地验证命令

```bash
# 验证领域对象测试
npm test

# 验证 gameStore 逻辑
node verify-gameStore.mjs

# 启动开发服务器（浏览器手动验证 UI）
npm run dev
```
