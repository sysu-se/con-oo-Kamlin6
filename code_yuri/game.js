import { createSudokuFromJSON } from './sudoku.js';

/**
 * 创建 Game 对象
 * @param {{sudoku: Sudoku, history?: Array, historyIndex?: number}} options
 * @returns {Game}
 */
export function createGame({ sudoku, history = [], historyIndex = -1 }) {
  // 操作历史
  let _history = JSON.parse(JSON.stringify(history));
  // 当前位置索引
  let _historyIndex = historyIndex;
  // 当前持有的 Sudoku 对象
  let _sudoku = sudoku;

  return {
    /**
     * 返回当前 Sudoku 对象
     * @returns {Sudoku}
     */
    getSudoku() {
      return _sudoku;
    },

    /**
     * 执行用户输入 + 记录历史
     * @param {{row: number, col: number, value: number}} move
     */
    guess(move) {
      const grid = _sudoku.getGrid();
      const previousValue = grid[move.row][move.col];

      // 委托给 Sudoku 执行修改
      _sudoku.guess(move);

      // 如果当前不在历史末尾（有 undo 过），截断 redo 历史
      if (_historyIndex < _history.length - 1) {
        _history = _history.slice(0, _historyIndex + 1);
      }

      // 记录新操作
      _history.push({
        row: move.row,
        col: move.col,
        value: move.value,
        previousValue: previousValue
      });

      _historyIndex = _history.length - 1;
    },

    /**
     * 撤销最近一次操作
     */
    undo() {
      if (!this.canUndo()) return;

      const move = _history[_historyIndex];

      // 恢复修改前的值
      _sudoku.guess({
        row: move.row,
        col: move.col,
        value: move.previousValue
      });

      _historyIndex--;
    },

    /**
     * 重做被撤销的操作
     */
    redo() {
      if (!this.canRedo()) return;

      _historyIndex++;
      const move = _history[_historyIndex];

      // 恢复修改后的值
      _sudoku.guess({
        row: move.row,
        col: move.col,
        value: move.value
      });
    },

    /**
     * 检查是否可撤销
     * @returns {boolean}
     */
    canUndo() {
      return _historyIndex >= 0;
    },

    /**
     * 检查是否可重做
     * @returns {boolean}
     */
    canRedo() {
      return _historyIndex < _history.length - 1;
    },

    /**
     * 序列化（当前局面 + 历史）
     * @returns {{sudoku: any, history: Array, historyIndex: number}}
     */
    toJSON() {
      return {
        sudoku: _sudoku.toJSON(),
        history: JSON.parse(JSON.stringify(_history)),
        historyIndex: _historyIndex
      };
    }
  };
}

/**
 * 从 JSON 数据恢复 Game 对象
 * @param {{sudoku: any, history: Array, historyIndex: number}} json
 * @returns {Game}
 */
export function createGameFromJSON(json) {
  const sudoku = createSudokuFromJSON(json.sudoku);
  return createGame({
    sudoku,
    history: json.history,
    historyIndex: json.historyIndex
  });
}
