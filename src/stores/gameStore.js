import { writable, derived } from 'svelte/store';
import { createGame, createSudoku } from '../domain/index.js';
import { SUDOKU_SIZE, BOX_SIZE } from '@sudoku/constants';
import { userGrid } from '@sudoku/stores/grid';

/**
 * 计算当前 grid 中的冲突格子
 * @param {number[][]} grid
 * @returns {string[]} 冲突格子列表，格式为 "x,y"
 */
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
					// Check the row
					if (i !== x && grid[y][i] === value) {
						addInvalid(x, y);
					}

					// Check the column
					if (i !== y && grid[i][x] === value) {
						addInvalid(x, i);
					}
				}

				// Check the box
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

/**
 * 检查游戏是否完成（所有格子填满且无冲突）
 * @param {number[][]} grid
 * @returns {boolean}
 */
function checkWon(grid) {
	for (let row = 0; row < SUDOKU_SIZE; row++) {
		for (let col = 0; col < SUDOKU_SIZE; col++) {
			if (grid[row][col] === 0) return false;
		}
	}
	return computeInvalidCells(grid).length === 0;
}

/**
 * 深拷贝 9x9 grid
 * @param {number[][]} grid
 * @returns {number[][]}
 */
function deepCopyGrid(grid) {
	return grid.map(row => [...row]);
}

const EMPTY_GRID = [
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/**
 * 创建 Game Store（Store Adapter）
 * 桥接领域对象与 Svelte 响应式系统
 * 
 * @param {number[][]} initialGrid - 初始数独网格
 * @returns {GameStore}
 */
export function createGameStore(initialGrid) {
	// 1. 内部持有领域对象（使用 let 以便后续替换）
	let sudoku = createSudoku(initialGrid);
	let game = createGame({ sudoku });
	// 保存初始谜题（用于 UI 显示哪些是预设格子）
	let _initialGrid = deepCopyGrid(initialGrid);

	// 2. 创建 writable stores
	const grid = writable(sudoku.getGrid());
	const initialGrid = writable(_initialGrid);
	const invalidCells = writable(computeInvalidCells(sudoku.getGrid()));
	const canUndo = writable(game.canUndo());
	const canRedo = writable(game.canRedo());
	const won = writable(false);

	/**
	 * 内部辅助函数：更新所有响应式状态
	 */
	function updateAllStores() {
		const currentGrid = sudoku.getGrid();
		grid.set(currentGrid);
		invalidCells.set(computeInvalidCells(currentGrid));
		canUndo.set(game.canUndo());
		canRedo.set(game.canRedo());
		won.set(checkWon(currentGrid));
	}

	/**
	 * 同步旧的 userGrid（保持向后兼容）
	 * @param {number[][]} currentGrid
	 */
	function syncUserGrid(currentGrid) {
		for (let y = 0; y < SUDOKU_SIZE; y++) {
			for (let x = 0; x < SUDOKU_SIZE; x++) {
				userGrid.set({ x, y }, currentGrid[y][x]);
			}
		}
	}

	// 3. 返回适配器对象（符合 Svelte Store Contract）
	return {
		// 订阅接口（Svelte 用 $gameStore 消费）
		subscribe: derived(
			[grid, initialGrid, invalidCells, canUndo, canRedo, won],
			([$grid, $initialGrid, $invalidCells, $canUndo, $canRedo, $won]) => ({
				grid: $grid,
				initialGrid: $initialGrid,
				invalidCells: $invalidCells,
				canUndo: $canUndo,
				canRedo: $canRedo,
				won: $won
			})
		).subscribe,

		/**
		 * 开始新游戏
		 * @param {number[][]} newGrid - 新的数独网格
		 */
		startNew(newGrid) {
			// 重建领域对象（新游戏 = 新 Sudoku + 新 Game）
			sudoku = createSudoku(newGrid);
			game = createGame({ sudoku });
			_initialGrid = deepCopyGrid(newGrid);
			
			updateAllStores();
			initialGrid.set(_initialGrid);
			syncUserGrid(newGrid);
		},

		/**
		 * 用户输入（填写数字）
		 * @param {{x: number, y: number}} pos - 光标位置（x = col, y = row）
		 * @param {number} value - 要填入的数字（0 表示清除）
		 */
		guess(pos, value) {
			game.guess({ row: pos.y, col: pos.x, value });
			updateAllStores();
			
			// 同步更新旧的 userGrid（保持向后兼容：hint、gameWon 等仍依赖它）
			userGrid.set({ x: pos.x, y: pos.y }, value);
		},

		/**
		 * 撤销最近一次操作
		 */
		undo() {
			game.undo();
			updateAllStores();
			syncUserGrid(sudoku.getGrid());
		},

		/**
		 * 重做被撤销的操作
		 */
		redo() {
			game.redo();
			updateAllStores();
			syncUserGrid(sudoku.getGrid());
		}
	};
}

// 导出单例（初始为空棋盘）
export const gameStore = createGameStore(deepCopyGrid(EMPTY_GRID));
