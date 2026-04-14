/**
 * 深拷贝 9x9 grid
 */
function deepCopyGrid(grid) {
  return grid.map(row => [...row]);
}

/**
 * 创建 Sudoku 对象
 * @param {number[][]} grid - 9x9 数独网格
 * @returns {Sudoku}
 */
export function createSudoku(grid) {
  // 防御性深拷贝
  let _grid = deepCopyGrid(grid);

  return {
    /**
     * 返回当前 grid 的深拷贝
     * @returns {number[][]}
     */
    getGrid() {
      return deepCopyGrid(_grid);
    },

    /**
     * 修改指定位置的值
     * @param {{row: number, col: number, value: number}} move
     */
    guess(move) {
      _grid[move.row][move.col] = move.value;
    },

    /**
     * 创建自身的完整深拷贝
     * @returns {Sudoku}
     */
    clone() {
      return createSudoku(_grid);
    },

    /**
     * 序列化为纯数据对象
     * @returns {{grid: number[][]}}
     */
    toJSON() {
      return {
        grid: deepCopyGrid(_grid)
      };
    },

    /**
     * 返回可读的调试字符串
     * @returns {string}
     */
    toString() {
      let out = '╔═══════╤═══════╤═══════╗\n';

      for (let row = 0; row < 9; row++) {
        if (row !== 0 && row % 3 === 0) {
          out += '╟───────┼───────┼───────╢\n';
        }

        for (let col = 0; col < 9; col++) {
          if (col === 0) {
            out += '║ ';
          } else if (col % 3 === 0) {
            out += '│ ';
          }

          out += (_grid[row][col] === 0 ? '·' : _grid[row][col]) + ' ';

          if (col === 8) {
            out += '║';
          }
        }

        out += '\n';
      }

      out += '╚═══════╧═══════╧═══════╝';
      return out;
    }
  };
}

/**
 * 从 JSON 数据恢复 Sudoku 对象
 * @param {{grid: number[][]}} json
 * @returns {Sudoku}
 */
export function createSudokuFromJSON(json) {
  return createSudoku(json.grid);
}
