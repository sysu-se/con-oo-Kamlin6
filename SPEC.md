# Homework 1.1 SPEC：领域对象接入 Svelte

## 一、项目现状分析

### 1.1 已有的领域对象 (code_yuri/)

| 模块 | 导出函数 | 核心方法 |
|------|---------|----------|
| `sudoku.js` | `createSudoku(grid)`, `createSudokuFromJSON(json)` | `getGrid()`, `guess(move)`, `clone()`, `toJSON()`, `toString()` |
| `game.js` | `createGame({sudoku, history, historyIndex})`, `createGameFromJSON(json)` | `getSudoku()`, `guess(move)`, `undo()`, `redo()`, `canUndo()`, `canRedo()`, `toJSON()` |

### 1.2 现有的 UI 层状态管理

| Store | 来源 | UI 消费方式 |
|-------|------|-------------|
| `grid` (谜题) | `@sudoku/stores/grid` | `$grid[y][x]` |
| `userGrid` (用户填写) | `@sudoku/stores/grid` | `$userGrid[y][x]` |
| `invalidCells` (冲突) | `derived(userGrid)` | `$invalidCells.includes(...)` |
| `cursor` | `@sudoku/stores/cursor` | `$cursor.x`, `$cursor.y` |
| `gamePaused` | `@sudoku/stores/game` | `$gamePaused` |

### 1.3 现有的游戏控制逻辑 (`@sudoku/game.js`)

- `startNew(diff)` — 直接调用 `grid.generate()`, `cursor.reset()`, `timer.reset()` 等
- `startCustom(sencode)` — 直接调用 `grid.decodeSencode()`
- 特点：**函数式风格，直接操作多个 store，无 OO 封装**

### 1.4 关键问题

```
❌ 领域对象 (code_yuri/) 只存在于测试中
❌ UI 仍然走旧逻辑（直接操作 userGrid store）
❌ Undo/Redo 按钮没有实现功能（Actions.svelte 中只有空按钮）
❌ 没有 src/domain/index.js（测试期望的入口不存在）
```

---

## 二、作业目标

### 核心目标

> **让 Svelte UI 真正消费领域对象，而不是只保留"独立可测试但未接入"的实现。**

### 必须接入的流程

| 流程 | 当前状态 | 目标状态 |
|------|----------|----------|
| 开始游戏 | `game.startNew()` → 操作旧 store | `gameStore.startNew()` → 创建 Game/Sudoku → 更新 store |
| 界面渲染 | 读取 `$userGrid` | 读取 `gameStore.grid`（来自领域对象） |
| 用户输入 | `userGrid.set($cursor, num)` | `gameStore.guess($cursor, num)` |
| Undo | ❌ 未实现 | `gameStore.undo()` |
| Redo | ❌ 未实现 | `gameStore.redo()` |
| 界面自动更新 | ✅ Svelte 响应式 | ✅ 继续保持 |

---

## 三、技术方案

### 3.1 架构设计

```
┌──────────────────────────────────────────────────────┐
│                    Svelte UI                         │
│  Board / Keyboard / Actions 组件                      │
│  读取：$gameStore.grid  调用：gameStore.guess()       │
└──────────────┬────────────────────────────┬───────────┘
               │ 订阅                        │ 调用
               ▼                            ▼
┌──────────────────────────────────────────────────────┐
│               Store Adapter 层                        │
│  createGameStore() — 唯一桥接点                        │
│  - writable: grid, invalidCells, canUndo, canRedo     │
│  - 方法: guess(), undo(), redo(), startNew()          │
│  - 内部持有: Game → Sudoku                            │
└──────────────┬────────────────────────────┬───────────┘
               │ 调用                        │ 读取
               ▼                            ▼
┌──────────────────────────────────────────────────────┐
│              领域对象 (Domain Layer)                   │
│  Game (history, undo/redo)                           │
│    └→ Sudoku (grid, guess, clone)                    │
│  来源: code_yuri/ → 迁移到 src/domain/               │
└──────────────────────────────────────────────────────┘
```

### 3.2 文件结构变更

```
src/
├── domain/                          ← 新增：领域对象入口
│   ├── index.js                     ← 从 code_yuri/ 复制
│   ├── sudoku.js                    ← 从 code_yuri/ 复制
│   └── game.js                      ← 从 code_yuri/ 复制
│
├── stores/                          ← 新增：Adapter 层
│   └── gameStore.js                 ← 核心：createGameStore()
│
├── node_modules/@sudoku/            ← 现有（部分保留）
│   ├── game.js                      ← 修改：内部改用 gameStore
│   ├── stores/                      ← 保留：cursor, timer, hints 等辅助 store
│   │   ├── cursor.js                ← 保留
│   │   ├── timer.js                 ← 保留
│   │   ├── hints.js                 ← 保留
│   │   ├── notes.js                 ← 保留
│   │   ├── candidates.js            ← 保留
│   │   ├── settings.js              ← 保留
│   │   ├── difficulty.js            ← 保留
│   │   ├── modal.js                 ← 保留
│   │   └── keyboard.js              ← 保留
│   └── stores/grid.js               ← 废弃/修改：不再作为主数据源
│
└── components/                      ← 修改：接入 gameStore
    ├── Board/index.svelte           ← 修改：读取 $gameStore.grid
    ├── Controls/Keyboard.svelte     ← 修改：调用 gameStore.guess()
    └── Controls/ActionBar/Actions.svelte ← 修改：调用 gameStore.undo/redo
```

---

## 四、实施步骤

### Phase 1：建立领域对象入口

**任务**：创建 `src/domain/` 并迁移 `code_yuri/` 的代码

- [ ] 创建 `src/domain/index.js`
- [ ] 创建 `src/domain/sudoku.js`
- [ ] 创建 `src/domain/game.js`
- [ ] 验证测试通过：`npm test`

### Phase 2：创建 Store Adapter

**任务**：创建 `src/stores/gameStore.js`

- [ ] 实现 `createGameStore()` 函数
- [ ] 内部持有 `Game` → `Sudoku` 实例
- [ ] 对外暴露 writable stores：
  - `grid` (2D array)
  - `invalidCells` (array of "x,y" strings)
  - `canUndo` (boolean)
  - `canRedo` (boolean)
  - `won` (boolean)
- [ ] 对外暴露操作方法：
  - `startNew(grid)` — 创建新游戏
  - `startCustom(grid)` — 自定义谜题
  - `guess(pos, value)` — 用户输入
  - `undo()` — 撤销
  - `redo()` — 重做
  - `reset()` — 重置当前游戏
- [ ] 每次操作后手动更新所有相关 store

### Phase 3：修改 UI 组件

**任务**：让组件消费 gameStore 而非旧 store

- [ ] **Board/index.svelte**
  - 改为读取 `$gameStore.grid` 而非 `$userGrid`
  - 改为读取 `$gameStore.invalidCells` 而非旧的 `$invalidCells`

- [ ] **Controls/Keyboard.svelte**
  - `handleKeyButton(num)` 改为调用 `gameStore.guess($cursor, num)`
  - 保留 notes/candidates 逻辑（领域对象不处理这些）

- [ ] **Controls/ActionBar/Actions.svelte**
  - Undo 按钮绑定 `gameStore.undo()`
  - Redo 按钮绑定 `gameStore.redo()`
  - 按钮 disabled 状态绑定 `$gameStore.canUndo` / `$gameStore.canRedo`

- [ ] **@sudoku/game.js**
  - `startNew(diff)` 改为调用 `gameStore.startNew(generateSudoku(diff))`
  - `startCustom(sencode)` 改为调用 `gameStore.startCustom(decodeSencode(sencode))`

### Phase 4：处理响应式细节

**任务**：确保 UI 正确刷新

- [ ] 确认 `grid` 更新后 Svelte 能检测到变化（需要创建新数组引用，不能 mutate）
- [ ] 确认 `invalidCells` 在每次 guess/undo/redo 后重新计算
- [ ] 确认 `won` 状态正确触发（userGrid 全满且无冲突）

### Phase 5：编写 DESIGN.md

**任务**：完成文档要求

- [ ] 说明 View 层消费的是什么（gameStore）
- [ ] 说明响应式机制原理（writable store + 手动 set）
- [ ] 说明相比 HW1 的改进
- [ ] 回答作业要求中的所有问题

---

## 五、关键设计决策

### 5.1 为什么 gameStore 使用 writable 而非 derived？

- `writable` 可以附加自定义方法（guess, undo, redo）
- `writable` 可以主动 `set()` 更新状态
- `derived` 是只读的，不能响应外部命令

### 5.2 哪些状态留在领域对象内部？

- `Game` 的 `_history` 数组和 `_historyIndex` — 不需要暴露给 UI
- `Sudoku` 的 `_grid` — 通过 `getGrid()` 暴露，不直接暴露

### 5.3 哪些状态暴露给 UI？

- `grid` — 当前棋盘状态
- `invalidCells` — 冲突格子列表
- `canUndo` / `canRedo` — 按钮启用状态
- `won` — 游戏完成状态

### 5.4 Notes/Candidates 如何处理？

- 这些是**纯 UI 功能**，不属于领域模型
- 继续保留原有 store 实现
- 在 `gameStore.guess()` 中不清理 candidates（由 UI 层决定）

---

## 六、测试要求

### 6.1 领域对象测试（已有）

```bash
npm test
```

- `01-contract.test.js` — 接口契约
- `02-sudoku-basic.test.js` — Sudoku 基础功能
- `03-clone.test.js` — clone 功能
- `04-game-undo-redo.test.js` — Undo/Redo
- `05-serialization.test.js` — 序列化

### 6.2 集成测试（建议新增）

- [ ] gameStore.startNew() 后 grid 正确初始化
- [ ] gameStore.guess() 后 grid 更新
- [ ] gameStore.undo() / gameStore.redo() 正确恢复状态
- [ ] gameStore 状态变化后 UI 能正确渲染

---

## 九、Contract（接口契约）与写法标准

### 9.1 领域对象接口契约

#### Sudoku 对象接口

```javascript
const sudoku = createSudoku(grid);  // grid: number[][]

// 必须暴露的方法：
sudoku.getGrid()        // → number[][]  返回 9x9 数字网格的深拷贝
sudoku.guess(move)      // → void        move = { row: number, col: number, value: number }
sudoku.clone()          // → Sudoku      返回独立的深拷贝对象
sudoku.toJSON()         // → { grid: number[][] }  返回可序列化的纯数据
sudoku.toString()       // → string      返回可读的调试字符串（不能是 [object Object]）

// 从 JSON 恢复：
const sudoku2 = createSudokuFromJSON(json);  // json: { grid: number[][] }
```

#### Game 对象接口

```javascript
const game = createGame({ sudoku, history = [], historyIndex = -1 });

// 必须暴露的方法：
game.getSudoku()        // → Sudoku      返回当前持有的 Sudoku 对象
game.guess(move)        // → void        move = { row: number, col: number, value: number }
game.undo()             // → void        撤销最近一次操作
game.redo()             // → void        重做被撤销的操作
game.canUndo()          // → boolean     是否可以撤销
game.canRedo()          // → boolean     是否可以重做
game.toJSON()           // → { sudoku: any, history: Array, historyIndex: number }

// 从 JSON 恢复：
const game2 = createGameFromJSON(json);
```

### 9.2 测试用例覆盖（必须全部通过）

| 测试文件 | 测试内容 | 运行命令 |
|----------|----------|----------|
| `01-contract.test.js` | 导出函数存在性 + 方法完整性 | `npm run test:contract` |
| `02-sudoku-basic.test.js` | 防御性拷贝 + guess + toJSON + toString | `npm run test:sudoku` |
| `03-clone.test.js` | clone 独立性 + 多 clone 不污染 | `npm run test:clone` |
| `04-game-undo-redo.test.js` | guess → undo → redo 流程 + 多步 undo + redo 历史清除 | `npm run test:game` |
| `05-serialization.test.js` | Sudoku/Game 序列化/反序列化往返 | `npm run test:serialization` |

**全部运行**：`npm test`

### 9.3 写法标准

#### 9.3.1 模块导出风格

```javascript
// ✅ 正确：使用命名导出（工厂函数模式）
export function createSudoku(grid) { ... }
export function createSudokuFromJSON(json) { ... }

// ❌ 错误：不使用默认导出或 class
// export default class Sudoku { ... }
```

#### 9.3.2 私有状态封装

```javascript
// ✅ 正确：使用 let + 闭包封装私有状态
export function createSudoku(grid) {
  let _grid = deepCopyGrid(grid);  // 私有状态，外部无法直接访问
  
  return {
    getGrid() { return deepCopyGrid(_grid); },  // 返回深拷贝
    guess(move) { _grid[move.row][move.col] = move.value; }
  };
}

// ❌ 错误：直接暴露可变状态
// return { grid: grid, ... };  // 外部可以直接修改 grid
```

#### 9.3.3 JSDoc 注释规范

```javascript
/**
 * 修改指定位置的值
 * @param {{row: number, col: number, value: number}} move
 */
guess(move) { ... }

/**
 * 返回当前 grid 的深拷贝
 * @returns {number[][]}
 */
getGrid() { ... }
```

#### 9.3.4 防御性拷贝要求

```javascript
// ✅ 正确：创建时深拷贝输入
let _grid = deepCopyGrid(grid);

// ✅ 正确：返回时深拷贝输出
getGrid() { return deepCopyGrid(_grid); }

// ✅ 正确：clone 时深拷贝
clone() { return createSudoku(_grid); }

// ✅ 正确：toJSON 时深拷贝
toJSON() { return { grid: deepCopyGrid(_grid) }; }

// ❌ 错误：直接返回引用
// getGrid() { return _grid; }  // 外部可以直接修改内部状态
```

#### 9.3.5 深拷贝工具函数

```javascript
// 项目统一使用的深拷贝函数（9x9 grid 专用）
function deepCopyGrid(grid) {
  return grid.map(row => [...row]);
}

// Game 的 history 序列化/反序列化
let _history = JSON.parse(JSON.stringify(history));  // 创建时深拷贝
toJSON() { return { history: JSON.parse(JSON.stringify(_history)) }; }
```

#### 9.3.6 坐标系统约定

```javascript
// move 对象使用 row/col 命名（与 UI 的 x/y 不同）
game.guess({ row: 0, col: 2, value: 4 });

// 对应关系：
// row = y (垂直方向，0-8)
// col = x (水平方向，0-8)
```

### 9.4 Store Adapter 写法标准

#### 9.4.1 基本结构

```javascript
// src/stores/gameStore.js
import { writable, derived } from 'svelte/store';
import { createGame, createSudoku } from '../domain/index.js';

export function createGameStore(initialGrid) {
  // 1. 内部持有领域对象
  const sudoku = createSudoku(initialGrid);
  const game = createGame({ sudoku });
  
  // 2. 创建 writable stores
  const grid = writable(sudoku.getGrid());
  const invalidCells = writable(computeInvalidCells(sudoku.getGrid()));
  const canUndo = writable(game.canUndo());
  const canRedo = writable(game.canRedo());
  const won = writable(false);
  
  // 3. 返回适配器对象（符合 Svelte Store Contract）
  return {
    // 订阅接口（Svelte 用 $gameStore 消费）
    subscribe: derived(
      [grid, invalidCells, canUndo, canRedo, won],
      ([$grid, $invalidCells, $canUndo, $canRedo, $won]) => ({
        grid: $grid,
        invalidCells: $invalidCells,
        canUndo: $canUndo,
        canRedo: $canRedo,
        won: $won
      })
    ).subscribe,
    
    // 操作方法（UI 调用）
    startNew(newGrid) { ... },
    guess(pos, value) { ... },
    undo() { ... },
    redo() { ... }
  };
}
```

#### 9.4.2 响应式更新要求

```javascript
// ✅ 正确：每次操作后手动更新所有相关 store
guess(pos, value) {
  game.guess({ row: pos.y, col: pos.x, value });  // 调用领域对象
  
  grid.set(sudoku.getGrid());                      // 更新 grid store
  invalidCells.set(computeInvalidCells(sudoku.getGrid()));  // 重新计算冲突
  canUndo.set(game.canUndo());                     // 更新按钮状态
  canRedo.set(game.canRedo());
  won.set(checkWon(sudoku.getGrid()));
}

// ❌ 错误：直接 mutate 数组元素（Svelte 不会检测）
// grid[row][col] = value;  // 不会触发响应式更新
```

#### 9.4.3 Store Contract 合规性

```javascript
// ✅ 正确：任何符合此接口的对象都可以被 Svelte 消费
const myStore = {
  subscribe: (handler) => {
    // 返回取消订阅函数
    return () => { ... };
  }
};

// 在 Svelte 中可以使用 $myStore 语法
```

---

## 十、风险与注意事项

### 10.1 响应式陷阱

- ❌ **不能直接 mutate grid 元素**：`grid[row][col] = value` 不会触发 Svelte 更新
- ✅ **必须创建新引用**：`grid.set(newGrid)` 或 `grid.update(g => [...])`

### 7.2 坐标系统差异

- `code_yuri/` 使用 `move.row`, `move.col` (row = y, col = x)
- UI 组件使用 `pos.x`, `pos.y` (x = col, y = row)
- Adapter 中需要正确转换

### 7.3 保留的旧逻辑

- `cursor` store — 仍然需要，领域对象不管理光标
- `timer` store — 仍然需要，领域对象不管理时间
- `hints` store — 仍然需要，领域对象不管理提示计数

---

## 八、完成标准

| 标准 | 说明 |
|------|------|
| ✅ 测试通过 | 所有 `tests/hw1/` 测试通过 |
| ✅ UI 正确渲染 | 棋盘显示来自领域对象 |
| ✅ 用户输入生效 | 输入调用 `gameStore.guess()` |
| ✅ Undo/Redo 可用 | 按钮调用 `gameStore.undo()/redo()` |
| ✅ 自动刷新 | 领域变化后 UI 自动更新 |
| ✅ DESIGN.md 完成 | 文档回答所有要求问题 |

---

## 九、时间线（建议）

```
Phase 1: 领域对象入口  → 30 分钟
Phase 2: Store Adapter  → 60 分钟
Phase 3: UI 组件修改    → 60 分钟
Phase 4: 响应式调试     → 30 分钟
Phase 5: DESIGN.md     → 45 分钟
────────────────────────────────
总计                    ~ 3.5 小时
```
