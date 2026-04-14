/**
 * 手动验证 gameStore 核心逻辑
 * 
 * 运行方式：
 * node --experimental-vm-modules verify-gameStore.mjs
 */

// 模拟 Svelte store（简化版）
function writable(initial) {
    let value = initial;
    const subscribers = new Set();
    
    return {
        subscribe(handler) {
            subscribers.add(handler);
            handler(value);
            return () => subscribers.delete(handler);
        },
        set(newValue) {
            value = newValue;
            subscribers.forEach(h => h(value));
        },
        get() { return value; }
    };
}

function derived(stores, fn) {
    let computed = null;
    const subscribers = new Set();
    
    // 订阅所有依赖的 store
    const unsubscribes = stores.map(store =>
        store.subscribe(() => {
            computed = fn(stores.map(s => s.get()));
            subscribers.forEach(h => h(computed));
        })
    );
    
    // 初始计算
    computed = fn(stores.map(s => s.get()));
    
    return {
        subscribe(handler) {
            subscribers.add(handler);
            handler(computed);
            return () => subscribers.delete(handler);
        },
        subscribe2: subscribers // 用于获取内部状态
    };
}

// 导入领域对象
import { createSudoku, createGame } from './src/domain/index.js';

// 工具函数
const SUDOKU_SIZE = 9;
const BOX_SIZE = 3;

function computeInvalidCells(grid) {
    const _invalidCells = [];
    const addInvalid = (x, y) => {
        const xy = x + ',' + y;
        if (!_invalidCells.includes(xy)) _invalidCells.push(xy);
    };

    for (let y = 0; y < SUDOKU_SIZE; y++) {
        for (let x = 0; x < SUDOKU_SIZE; x++) {
            const value = grid[y][x];
            if (value) {
                for (let i = 0; i < SUDOKU_SIZE; i++) {
                    if (i !== x && grid[y][i] === value) addInvalid(x, y);
                    if (i !== y && grid[i][x] === value) addInvalid(x, i);
                }
                const startY = Math.floor(y / BOX_SIZE) * BOX_SIZE;
                const endY = startY + BOX_SIZE;
                const startX = Math.floor(x / BOX_SIZE) * BOX_SIZE;
                const endX = startX + BOX_SIZE;
                for (let row = startY; row < endY; row++) {
                    for (let col = startX; col < endX; col++) {
                        if (row !== y && col !== x && grid[row][col] === value) {
                            addInvalid(col, row);
                        }
                    }
                }
            }
        }
    }
    return _invalidCells;
}

function checkWon(grid) {
    for (let row = 0; row < SUDOKU_SIZE; row++) {
        for (let col = 0; col < SUDOKU_SIZE; col++) {
            if (grid[row][col] === 0) return false;
        }
    }
    return computeInvalidCells(grid).length === 0;
}

function deepCopyGrid(grid) {
    return grid.map(row => [...row]);
}

// 测试数据
const TEST_GRID = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

// 创建 gameStore（简化版）
function createGameStore(initialGrid) {
    let sudoku = createSudoku(initialGrid);
    let game = createGame({ sudoku });
    let _initialGrid = deepCopyGrid(initialGrid);

    const grid = writable(sudoku.getGrid());
    const initialGridStore = writable(_initialGrid);
    const invalidCells = writable(computeInvalidCells(sudoku.getGrid()));
    const canUndo = writable(game.canUndo());
    const canRedo = writable(game.canRedo());
    const won = writable(false);

    function updateAllStores() {
        const currentGrid = sudoku.getGrid();
        grid.set(currentGrid);
        invalidCells.set(computeInvalidCells(currentGrid));
        canUndo.set(game.canUndo());
        canRedo.set(game.canRedo());
        won.set(checkWon(currentGrid));
    }

    return {
        subscribe: derived(
            [grid, initialGridStore, invalidCells, canUndo, canRedo, won],
            (values) => ({
                grid: values[0],
                initialGrid: values[1],
                invalidCells: values[2],
                canUndo: values[3],
                canRedo: values[4],
                won: values[5]
            })
        ).subscribe,
        
        startNew(newGrid) {
            sudoku = createSudoku(newGrid);
            game = createGame({ sudoku });
            _initialGrid = deepCopyGrid(newGrid);
            updateAllStores();
            initialGridStore.set(_initialGrid);
        },
        
        guess(pos, value) {
            game.guess({ row: pos.y, col: pos.x, value });
            updateAllStores();
        },
        
        undo() {
            game.undo();
            updateAllStores();
        },
        
        redo() {
            game.redo();
            updateAllStores();
        }
    };
}

// ========================
// 测试用例
// ========================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        testsPassed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('=== GameStore 验证测试 ===\n');

    const store = createGameStore(TEST_GRID);
    
    // 1. 测试订阅功能
    let lastValue = null;
    const unsubscribe = store.subscribe(value => {
        lastValue = value;
    });
    
    assert(lastValue !== null, 'Store 订阅成功，能获取初始值');
    assert(lastValue.grid[0][0] === 5, `初始 grid[0][0] 应为 5，实际为 ${lastValue.grid[0][0]}`);
    assert(lastValue.canUndo === false, `初始 canUndo 应为 false，实际为 ${lastValue.canUndo}`);
    assert(lastValue.canRedo === false, `初始 canRedo 应为 false，实际为 ${lastValue.canRedo}`);
    assert(lastValue.won === false, `初始 won 应为 false，实际为 ${lastValue.won}`);

    // 2. 测试 guess
    store.guess({ x: 2, y: 0 }, 4);
    assert(lastValue.grid[0][2] === 4, `guess 后 grid[0][2] 应为 4，实际为 ${lastValue.grid[0][2]}`);
    assert(lastValue.canUndo === true, `guess 后 canUndo 应为 true，实际为 ${lastValue.canUndo}`);

    // 3. 测试 undo
    store.undo();
    assert(lastValue.grid[0][2] === 0, `undo 后 grid[0][2] 应为 0，实际为 ${lastValue.grid[0][2]}`);
    assert(lastValue.canRedo === true, `undo 后 canRedo 应为 true，实际为 ${lastValue.canRedo}`);

    // 4. 测试 redo
    store.redo();
    assert(lastValue.grid[0][2] === 4, `redo 后 grid[0][2] 应为 4，实际为 ${lastValue.grid[0][2]}`);

    // 5. 测试多步操作
    store.guess({ x: 1, y: 1 }, 7);
    assert(lastValue.grid[1][1] === 7, `guess 后 grid[1][1] 应为 7，实际为 ${lastValue.grid[1][1]}`);
    assert(lastValue.grid[0][2] === 4, `多步 guess 后 grid[0][2] 仍为 4，实际为 ${lastValue.grid[0][2]}`);

    store.undo();
    assert(lastValue.grid[1][1] === 0, `undo 后 grid[1][1] 应为 0，实际为 ${lastValue.grid[1][1]}`);
    assert(lastValue.grid[0][2] === 4, `undo 后 grid[0][2] 仍为 4，实际为 ${lastValue.grid[0][2]}`);

    // 6. 测试新操作清除 redo 历史
    store.undo(); // 撤销第一个 guess
    store.guess({ x: 0, y: 2 }, 1); // 新操作
    assert(lastValue.grid[2][0] === 1, `新 guess 后 grid[2][0] 应为 1，实际为 ${lastValue.grid[2][0]}`);
    store.redo(); // 应该无效（已被清除）
    assert(lastValue.grid[0][2] === 0, `redo 应无效（历史已清除），grid[0][2] 应为 0，实际为 ${lastValue.grid[0][2]}`);

    // 7. 测试 invalidCells 计算
    const badGrid = deepCopyGrid(TEST_GRID);
    badGrid[0][0] = 7; // 与 grid[5][0] 冲突
    const badStore = createGameStore(badGrid);
    let badValue = null;
    badStore.subscribe(v => { badValue = v; });
    assert(badValue.invalidCells.length > 0, `冲突时应有 invalidCells，实际有 ${badValue.invalidCells.length} 个`);

    // 8. 测试 startNew
    const newGrid = [
        [1,2,3,4,5,6,7,8,9],
        [4,5,6,7,8,9,1,2,3],
        [7,8,9,1,2,3,4,5,6],
        [2,3,4,5,6,7,8,9,1],
        [5,6,7,8,9,1,2,3,4],
        [8,9,1,2,3,4,5,6,7],
        [3,4,5,6,7,8,9,1,2],
        [6,7,8,9,1,2,3,4,5],
        [9,1,2,3,4,5,6,7,8],
    ];
    store.startNew(newGrid);
    assert(lastValue.grid[0][0] === 1, `startNew 后 grid[0][0] 应为 1，实际为 ${lastValue.grid[0][0]}`);
    assert(lastValue.canUndo === false, `startNew 后 canUndo 应为 false，实际为 ${lastValue.canUndo}`);

    console.log('\n=== 测试完成 ===');
    console.log(`✅ 通过: ${testsPassed}`);
    console.log(`❌ 失败: ${testsFailed}`);
    console.log(`总计: ${testsPassed + testsFailed}`);
    
    if (testsFailed > 0) {
        console.error('\n⚠️  存在失败的测试，请检查代码！');
        process.exit(1);
    } else {
        console.log('\n🎉 所有测试通过！');
    }
}

runTests().catch(err => {
    console.error('测试运行出错:', err);
    process.exit(1);
});
