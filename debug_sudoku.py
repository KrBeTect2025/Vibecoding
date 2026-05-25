# Test 1: Simple print
print("TEST 1: Simple print works")

# Test 2: Print with map
row = [1, 2, 3, 4, 5]
print("TEST 2: Map test")
print(" ".join(map(str, row)))

# Test 3: Sudoku with debug
print("TEST 3: Starting Sudoku")

def isSafe(mat, row, col, num):
    for x in range(9):
        if mat[row][x] == num:
            return False
    for x in range(9):
        if mat[x][col] == num:
            return False
    startRow = row - (row % 3)
    startCol = col - (col % 3)
    for i in range(3):
        for j in range(3):
            if mat[i + startRow][j + startCol] == num:
                return False
    return True

def solveSudokuRec(mat, row, col):
    if row == 8 and col == 9:
        return True
    if col == 9:
        row += 1
        col = 0
    if mat[row][col] != 0:
        return solveSudokuRec(mat, row, col + 1)
    for num in range(1, 10):
        if isSafe(mat, row, col, num):
            mat[row][col] = num
            if solveSudokuRec(mat, row, col + 1):
                return True
            mat[row][col] = 0
    return False

def solveSudoku(mat):
    print("Inside solveSudoku function")
    result = solveSudokuRec(mat, 0, 0)
    print(f"Recursion complete, result: {result}")
    return result

mat = [
    [3, 0, 6, 5, 0, 8, 4, 0, 0],
    [5, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 8, 7, 0, 0, 0, 0, 3, 1],
    [0, 0, 3, 0, 1, 0, 0, 8, 0],
    [9, 0, 0, 8, 6, 3, 0, 0, 5],
    [0, 5, 0, 0, 9, 0, 6, 0, 0],
    [1, 3, 0, 0, 0, 0, 2, 5, 0],
    [0, 0, 0, 0, 0, 0, 0, 7, 4],
    [0, 0, 5, 2, 0, 6, 3, 0, 0]
]

print("Calling solveSudoku...")
solveSudoku(mat)

print("Printing result:")
for row in mat:
    print(" ".join(map(str, row)))

print("DONE!")
