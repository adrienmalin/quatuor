/* Constants */
const TRANSLATION = {
    NONE:  [ 0, 0],
    LEFT:  [-1, 0],
    RIGHT: [ 1, 0],
    DOWN:  [ 0, 1],
}

const ROTATION = {
    CW:   1,  // ClockWise
    CCW: -1,  // CounterClockWise
}

const T_SPIN = {
    NONE:   "",
    MINI:   "PETITE<br/>PIROUETTE",
    T_SPIN: "PIROUETTE"
}

// score = AWARDED_LINE_CLEARS[tSpin][nbClearedLines]
const AWARDED_LINE_CLEARS = {
    [T_SPIN.NONE]:   [0, 1, 3, 5, 8],
    [T_SPIN.MINI]:   [1, 2],
    [T_SPIN.T_SPIN]: [4, 8, 12, 16]
}

const CLEARED_LINES_NAMES = [
    "",  
    "SOLO",
    "DUO",
    "TRIO",
    "QUATUOR",
]

const DELAY = {
    LOCK: 500,
    FALL: 1000,
}

const FACING = {
    NORTH: 0,
    EAST:  1,
    SOUTH: 2,
    WEST:  3,
}

/* Customize Array to be use as position */
Object.defineProperties(Array.prototype, {
    "x": {
        get: function() { return this[0] },
        set: function(x) { this[0] = x }
    },
    "y": {
        get: function() { return this[1] },
        set: function(y) { this[1] = y }
    }
})
Array.prototype.add =       function(other)    { return this.map((x, i) => x + other[i]) }
Array.prototype.mul =       function(k)        { return this.map(x => k * x) }
Array.prototype.translate = function(vector)   { return this.map(pos => pos.add(vector)) }
Array.prototype.rotate =    function(rotation) { return [-rotation*this.y, rotation*this.x] }
Array.prototype.pick =      function()         { return this.splice(Math.floor(Math.random()*this.length), 1)[0] }


HTMLElement.prototype.addNewChild = function(tag, properties) {
    let child = document.createElement(tag)
    for (key in properties) {
        child[key] = properties[key]
    }
    this.appendChild(child)
}


/* Classes */

class Scheduler {
    constructor() {
        this.intervalTasks = new Map()
        this.timeoutTasks = new Map()
    }

    setInterval(func, delay, ...args) {
        if (this.intervalTasks.has(func)) {
            console.warn(`$func already in intervalTasks`)
            return false
        } else {
            this.intervalTasks.set(func, window.setInterval(func, delay, ...args))
            return true
        }
    }

    setTimeout(func, delay, ...args) {
        if (this.timeoutTasks.has(func)) {
            console.warn(`$func already in timeoutTasks`)
            return false
        } else {
            this.timeoutTasks.set(func, window.setTimeout(func, delay, ...args))
            return true
        }
    }

    clearInterval(func) {
        if (this.intervalTasks.has(func)) {
            window.clearInterval(this.intervalTasks.get(func))
            this.intervalTasks.delete(func)
            return true
        } else {
            return false
        }
    }

    clearTimeout(func) {
        if (this.timeoutTasks.has(func)) {
            window.clearTimeout(this.timeoutTasks.get(func))
            this.timeoutTasks.delete(func)
            return true
        } else {
            return false
        }
    }
}


class MinoesTable {
    constructor(id) {
        this.table = document.getElementById(id)
        Array.from(this.table.getElementsByTagName("tr")).forEach((tr, row) => {
            tr.style.setProperty('--row', row)
            Array.from(tr.getElementsByTagName("td")).forEach((td, column) => {
                td.style.setProperty('--column', column)
            })
        })
        this.rows = this.table.rows.length
        this.columns = this.table.rows[0].childElementCount
    }

    init() {
        this._piece = null
    }

    get piece() {
        return this._piece
    }
    set piece(piece) {
        this._piece = piece
        this._piece.center = Array.from(this.init_center)
        this.redraw()
        this.drawPiece()
    }

    drawMino(position, className) {
        this.table.rows[position.y].cells[position.x].className = className
    }

    drawPiece(piece=this.piece, className=piece.className) {
        piece.minoesPosition[piece.facing]
            .translate(piece.center)
            .forEach(minoPosition => {
                this.drawMino(minoPosition, className)
            })
    }

    redraw() {
        for (let y=0; y<this.rows; y++) {
            for (let x=0; x<this.columns; x++) {
                this.drawMino([x, y], "")
            }
        }
    }
}
MinoesTable.prototype.init_center = [2, 2]


class HoldQueue extends MinoesTable {
    constructor() {
        super("holdTable")
    }

    drawPiece(piece=this.piece, className=piece.className) {
        if (!matrix.piece.holdEnabled) {
            className += " disabled"
        }
        super.drawPiece(piece, className)
    }
}


class NextQueue extends MinoesTable {
    constructor() {
        super("nextTable")
    }

    init() {
        this.pieces = this.init_centers.map(center => {
            let piece        = new Tetromino.pick()
                piece.center = Array.from(center)
            return piece
        })
    }

    shift() {
        let fistPiece = this.pieces.shift()
        this.pieces.push(new Tetromino.pick())
        this.pieces.forEach((piece, i) => {
            piece.center = Array.from(this.init_centers[i])
        })
        this.redraw()
        return fistPiece
    }

    redraw() {
        super.redraw()
        this.pieces.forEach((piece) => {
            this.drawPiece(piece)
        })
    }
}
NextQueue.prototype.init_centers = [[2, 2], [2, 5], [2, 8], [2, 11], [2, 14]]


class Matrix extends MinoesTable {
    constructor() {
        super("matrixTable")
    }

    init() {
        super.init()
        this.blocks = Array(this.rows).fill().map(() => Array(this.columns))
        this.redraw()
    }

    cellIsEmpty(position) {
        return 0 <= position.x && position.x < this.columns && 0 <= position.y && position.y < this.rows && !this.blocks[position.y][position.x]
    }

    get piece() {
        return this._piece
    }
    set piece(piece) {
        this._piece        = piece
        this._piece.center = Array.from(this.init_center)
        this.ghost         = piece.ghost
        this.redraw()
        this.drawPiece()
    }

    drawPiece(piece=this.piece, className=piece.className) {
        super.drawPiece(this.ghost, "")
        this.ghost = piece.ghost
        super.drawPiece(this.ghost)
        if (piece.locked) className += " locking"
        if (piece==this.piece && actionsQueue.length) className += " moving"
        super.drawPiece(piece, className)
        matrix.table.style.setProperty('--piece-column', this.piece.center.x)
        matrix.table.style.setProperty('--piece-row',    this.piece.center.y)
    }

    clearPiece(piece=this.piece, className="") {
        super.drawPiece(piece, className)
    }

    redraw() {
        for (let y=0; y<this.rows; y++) {
            for (let x=0; x<this.columns; x++) {
                if (this.table.rows[y].cells[x].classList != "trail-animation")
                    this.drawMino([x, y], this.blocks[y][x] || "")
            }
        }
    }

    lock() {
        let blocksPosition = this.piece.minoesPosition[this.piece.facing].translate(this.piece.center)
        if (blocksPosition.some(position => position.y >= 4)) {
            blocksPosition.forEach(position => {
                this.blocks[position.y][position.x] = "locked " + this.piece.className
                this.drawMino(position, this.piece.className)
            })
            return true
        } else {
            return false
        }
    }

    clearLines() {
        let nbClearedLines = 0
        for (let y=0; y<this.rows; y++) {
            let row = this.blocks[y]
            if (row.filter(lockedMino => lockedMino).length == this.columns) {
                nbClearedLines++
                this.blocks.splice(y, 1)
                this.blocks.unshift(Array(matrix.columns))
                this.table.rows[y].classList.add("cleared-line-animation")
            }
        }
        this.redraw()
        return nbClearedLines
    }
}
Matrix.prototype.init_center = [4, 4]


class Tetromino {
    static randomBag = []
    static get pick() {
        if (!this.randomBag.length) this.randomBag = [I, J, L, O, S, T, Z]
        return this.randomBag.pick()
    }

    constructor(center, facing=0, className=this.constructor.name + " mino") {
        this.center = center
        this.className = className
        this.facing = facing
        this.lastRotation = false
        this.rotationPoint4Used = false
        this.holdEnabled = true
        this.locked = false
    }

    canMove(translation, rotation=ROTATION.NONE) {
        let testCenter = this.center.add(translation)
        let testFacing = rotation? (this.facing + rotation + 4) % 4: this.facing
        let testMinoesPosition = this.minoesPosition[testFacing]
        if (testMinoesPosition
            .translate(testCenter)
            .every(minoPosition => matrix.cellIsEmpty(minoPosition)))
            return {center: testCenter, facing: testFacing}
        else
            return false
    }
    
    move(translation, rotation=ROTATION.NONE, hardDropped=false) {
        let success = this.canMove(translation, rotation)
        if (success) {
            scheduler.clearTimeout(lockDown)
            matrix.clearPiece(this, hardDropped? "trail-animation" : "")
            this.center = success.center
            if (rotation) this.facing = success.facing
            this.lastRotation = rotation
            if (this.canMove(TRANSLATION.DOWN)) {
                this.locked = false
            } else {
                this.locked = true
                scheduler.setTimeout(lockDown, stats.lockDelay)
            }
            matrix.drawPiece()
            return true
        } else if (!hardDropped && translation == TRANSLATION.DOWN) {
            this.locked = true
            if (!scheduler.timeoutTasks.has(lockDown))
                scheduler.setTimeout(lockDown, stats.lockDelay)
            matrix.drawPiece()
        }
    }
    
    rotate(rotation) {
        return this.srs[this.facing][rotation].some((translation, rotationPoint) => {
            if (this.move(translation, rotation)) {
                if (rotationPoint == 4) this.rotationPoint4Used = true
                favicon.href = this.favicon_href
                return true
            }
        })
    }

    get ghost() {
        let ghost = new this.constructor(Array.from(this.center), this.facing, "ghost " + this.className)
        while (ghost.canMove(TRANSLATION.DOWN)) ghost.center.y++
        return ghost
    }

    get favicon_href() {
        return `favicons/${this.constructor.name}-${this.facing}.png`
    }

    get tSpin() {
        return T_SPIN.NONE
    }
}
// Super Rotation System
// freedom of movement = srs[piece.facing][rotation]
Tetromino.prototype.srs = [
    { [ROTATION.CW]: [[0, 0], [-1, 0], [-1, -1], [0,  2], [-1,  2]], [ROTATION.CCW]: [[0, 0], [ 1, 0], [ 1, -1], [0,  2], [ 1,  2]] },
    { [ROTATION.CW]: [[0, 0], [ 1, 0], [ 1,  1], [0, -2], [ 1, -2]], [ROTATION.CCW]: [[0, 0], [ 1, 0], [ 1,  1], [0, -2], [ 1, -2]] },
    { [ROTATION.CW]: [[0, 0], [ 1, 0], [ 1, -1], [0,  2], [ 1,  2]], [ROTATION.CCW]: [[0, 0], [-1, 0], [-1, -1], [0,  2], [-1,  2]] },
    { [ROTATION.CW]: [[0, 0], [-1, 0], [-1,  1], [0, -2], [-1, -2]], [ROTATION.CCW]: [[0, 0], [-1, 0], [-1,  1], [0, -2], [-1, -2]] },
]

class I extends Tetromino {}
I.prototype.minoesPosition = [
    [[-1, 0], [0, 0], [1, 0], [2, 0]],
    [[1, -1], [1, 0], [1, 1], [1, 2]],
    [[-1, 1], [0, 1], [1, 1], [2, 1]],
    [[0, -1], [0, 0], [0, 1], [0, 2]],
]
I.prototype.srs = [
    { [ROTATION.CW]: [[0, 0], [-2, 0], [ 1, 0], [-2,  1], [ 1, -2]], [ROTATION.CCW]: [[0, 0], [-1, 0], [ 2, 0], [-1, -2], [ 2,  1]] },
    { [ROTATION.CW]: [[0, 0], [-1, 0], [ 2, 0], [-1, -2], [ 2,  1]], [ROTATION.CCW]: [[0, 0], [ 2, 0], [-1, 0], [ 2, -1], [-1,  2]] },
    { [ROTATION.CW]: [[0, 0], [ 2, 0], [-1, 0], [ 2, -1], [-1,  2]], [ROTATION.CCW]: [[0, 0], [ 1, 0], [-2, 0], [ 1,  2], [-2, -1]] },
    { [ROTATION.CW]: [[0, 0], [ 1, 0], [-2, 0], [ 1,  2], [-2, -1]], [ROTATION.CCW]: [[0, 0], [-2, 0], [ 1, 0], [-2,  1], [ 1, -2]] },
]

class J extends Tetromino {}
J.prototype.minoesPosition = [
    [[-1, -1], [-1, 0], [0, 0], [1, 0]],
    [[ 0, -1], [1, -1], [0, 0], [0, 1]],
    [[ 1,  1], [-1, 0], [0, 0], [1, 0]],
    [[ 0, -1], [-1, 1], [0, 0], [0, 1]],
]

class L extends Tetromino {}
L.prototype.minoesPosition = [
    [[-1, 0], [0, 0], [1, 0], [ 1, -1]],
    [[0, -1], [0, 0], [0, 1], [ 1,  1]],
    [[-1, 0], [0, 0], [1, 0], [-1,  1]],
    [[0, -1], [0, 0], [0, 1], [-1, -1]],
]

class O extends Tetromino {}
O.prototype.minoesPosition = [
    [[0, 0], [1, 0], [0, -1], [1, -1]]
]
O.prototype.srs = [
    {[ROTATION.CW]: [], [ROTATION.CCW]: []}
]


class S extends Tetromino {}
S.prototype.minoesPosition = [
    [[-1,  0], [0, 0], [0, -1], [1, -1]],
    [[ 0, -1], [0, 0], [1,  0], [1,  1]],
    [[-1,  1], [0, 0], [1,  0], [0,  1]],
    [[-1, -1], [0, 0], [-1, 0], [0,  1]],
]

class T extends Tetromino {
    get tSpin() {
        if (this.lastRotation) {
            let [a, b, c, d] = this.tSlots[this.facing]
                .translate(this.center)
                .map(minoPosition => !matrix.cellIsEmpty(minoPosition))
            if (a && b && (c || d))
                return T_SPIN.T_SPIN
            else if (c && d && (a || b))
                return this.rotationPoint4Used ? T_SPIN.T_SPIN : T_SPIN.MINI
        }
        return T_SPIN.NONE
    }
}
T.prototype.minoesPosition = [
    [[-1, 0], [0, 0], [1, 0], [0, -1]],
    [[0, -1], [0, 0], [1, 0], [0,  1]],
    [[-1, 0], [0, 0], [1, 0], [0,  1]],
    [[0, -1], [0, 0], [0, 1], [-1, 0]],
]
T.prototype.tSlots = [
    [[-1, -1], [ 1, -1], [ 1,  1], [-1,  1]],
    [[ 1, -1], [ 1,  1], [-1,  1], [-1, -1]],
    [[ 1,  1], [-1,  1], [-1, -1], [ 1, -1]],
    [[-1,  1], [-1, -1], [ 1, -1], [ 1,  1]],
]

class Z extends Tetromino {}
Z.prototype.minoesPosition = [
    [[-1, -1], [0, -1], [0, 0], [ 1, 0]],
    [[ 1, -1], [1,  0], [0, 0], [ 0, 1]],
    [[-1,  0], [0,  0], [0, 1], [ 1, 1]],
    [[ 0, -1], [-1, 0], [0, 0], [-1, 1]]
]