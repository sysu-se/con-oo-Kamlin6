# con-oo-Kamlin6 - Review

## Review 结论

当前实现已经不再是“领域对象只存在于测试里”的状态，主输入、开局、Undo/Redo 与棋盘渲染都开始经过 `Game/Sudoku + gameStore`。但设计上仍存在两个根本问题：一是数独业务规则没有真正内聚进领域模型，二是 Svelte 层仍保留旧 `userGrid/gameWon` 状态链路，导致领域层和 UI 之间出现双源状态，接入并不彻底。综合来看，这是一次部分成功的接入，但离高质量 OOP/OOD 和稳定的 Svelte 架构还有明显距离。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | poor |
| OOD | poor |

## 缺点

### 1. Hint 与胜负流程仍绕过领域层，形成双源状态

- 严重程度：core
- 位置：src/components/Controls/ActionBar/Actions.svelte:14-22; src/components/Board/index.svelte:40-51; src/App.svelte:12-17; src/node_modules/@sudoku/stores/game.js:7-18
- 原因：棋盘渲染读取的是 `$gameStore.grid`，但 Hint 直接调用旧 `userGrid.applyHint(...)`，胜利弹窗又订阅旧的 `gameWon`。这意味着 Hint 后领域对象、棋盘显示、胜负判定可能不再一致，Undo/Redo 也无法覆盖 Hint 造成的变化，说明 Svelte 主流程并未完全消费 `Game/Sudoku`。

### 2. 数独核心业务约束没有建模进 Sudoku/Game

- 严重程度：core
- 位置：src/domain/sudoku.js:13-32; src/domain/game.js:29-49; src/stores/gameStore.js:101-103,171-176; src/node_modules/@sudoku/stores/keyboard.js:6-10
- 原因：`Sudoku` 只保存二维数组并直接写值，不校验坐标、数字范围、是否为初始 givens、是否允许修改固定格，也不提供领域级合法性判断。当前“不能改题面”主要依赖旧 `grid` store 的 `keyboardDisabled` 和 UI 调用路径，而不是领域对象本身维护约束，导致模型可以进入违背数独业务的非法状态。

### 3. 校验与胜利判定堆在 store adapter 中，领域对象退化为贫血模型

- 严重程度：major
- 位置：src/stores/gameStore.js:6-67,107-121; src/domain/sudoku.js:17-32
- 原因：作业要求里 `Sudoku` 至少应提供校验能力，但现在 `computeInvalidCells` 与 `checkWon` 都写在 `gameStore` 内。结果是领域层只像一个带封装的数组容器，真正的业务规则留在 Svelte 适配层，职责边界模糊，也削弱了领域对象的可复用性。

### 4. Game 暴露可变 Sudoku 实例，允许绕过历史机制

- 严重程度：major
- 位置：src/domain/game.js:21-23; src/domain/sudoku.js:30-31
- 原因：`getSudoku()` 返回的是活的 `Sudoku` 对象，而 `Sudoku.guess()` 又可直接修改内部状态。任何调用方只要拿到这个对象，就能跳过 `Game.guess()` 的历史记录与 Undo/Redo 管理，这破坏了 `Game` 作为聚合根/统一操作入口的封装性。

### 5. 重复输入或无效输入也会进入历史

- 严重程度：minor
- 位置：src/domain/game.js:29-49
- 原因：`Game.guess()` 在记录历史前没有判断 `previousValue === move.value` 等 no-op 情况，因此重复填入同一个数字也会产生一条新的历史记录。这样会污染撤销栈，使 Undo/Redo 语义偏离“恢复有效操作”的业务直觉。

## 优点

### 1. 主输入、渲染、Undo/Redo 已接入 store adapter

- 位置：src/stores/gameStore.js:97-196; src/components/Controls/Keyboard.svelte:24-25; src/components/Controls/ActionBar/Actions.svelte:28-35; src/components/Board/index.svelte:40-51
- 原因：相比“领域对象只在测试中存在”的情况，这里已经做到：棋盘从 `$gameStore.grid` 渲染，数字输入调用 `gameStore.guess(...)`，撤销/重做调用 `gameStore.undo/redo()`，说明领域层确实进入了主要 UI 回路。

### 2. 开局流程有统一的应用服务入口

- 位置：src/node_modules/@sudoku/game.js:15-37
- 原因：`startNew/startCustom` 统一负责生成题目、创建新局、重置 cursor/timer/hints，避免把这些编排逻辑散落到多个 `.svelte` 组件里，应用层职责相对清晰。

### 3. Redo 分支截断语义是正确的

- 位置：src/domain/game.js:36-49,55-85
- 原因：在 Undo 之后重新 `guess` 会先截断旧 redo 历史，再追加新操作；`undo/redo` 使用记录的 delta 恢复前值/后值，基本符合编辑历史的常见设计。

### 4. 领域对象具备外表化和重建能力

- 位置：src/domain/sudoku.js:22-24,46-49,56-82; src/domain/game.js:107-128
- 原因：`getGrid()` 返回副本，`toJSON()/fromJSON()` 支持序列化恢复，`toString()` 也便于调试检查，这些接口对持久化、调试和测试都比较友好。

## 补充说明

- 本结论仅基于静态阅读 `src/domain/*`、`src/stores/gameStore.js`、相关 `.svelte` 文件，以及直接参与接入链路的 `src/node_modules/@sudoku/*` 文件；未运行测试，也未实际启动应用。
- 关于“Hint 后棋盘与胜利态可能不同步”等判断，来自静态数据流分析：`Board` 读取 `$gameStore.grid`，而 Hint/胜利判定读取并修改的是旧 `userGrid`/`gameWon`。
- 本次审查按要求只覆盖领域对象及其 Svelte 接入，不扩展评价无关目录或纯样式实现。
