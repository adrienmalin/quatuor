let scheduler          = new Scheduler()
let settings           = new Settings()
let stats              = new Stats()
let holdQueue          = new HoldQueue()
let matrix             = new Matrix()
let nextQueue          = new NextQueue()
let playing            = false
//let lastActionSucceded = true
let favicon

window.onload = function(event) {
    document.selectedStyleSheetSet = selectedStyleSheet.title
    selectedStyleSheet.href = stylesheetSelect.value
    favicon = document.querySelector("link[rel~='icon']")

    fullscreenCheckbox.onchange = function() {
        if (this.checked) {
            document.documentElement.requestFullscreen()
        } else {
            document.exitFullscreen()
        }
    }

    restart()
}

document.onfullscreenchange = function() {
    if (document.fullscreenElement) {
        fullscreenCheckbox.checked = true
    } else {
        fullscreenCheckbox.checked = false
    }
}
document.onfullscreenerror = function() {
    fullscreenCheckbox.checked = false
}

function restart() {
    stats.modal.hide()
    holdQueue.init()
    holdQueue.redraw()
    stats.init()
    matrix.init()
    nextQueue.init()
    settings.init()
    pauseSettings()
}

function pauseSettings() {
    scheduler.clearInterval(fall)
    scheduler.clearTimeout(lockDown)
    scheduler.clearTimeout(repeat)
    scheduler.clearInterval(autorepeat)
    scheduler.clearInterval(ticktack)
    stats.pauseTime = stats.time

    document.onkeydown = null

    settings.show()
}

function newGame(event) {
    if (!settings.form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
        settings.form.reportValidity()
        settings.form.classList.add('was-validated')
    } else {
        const audioContext = new AudioContext()
        for(const sound of document.getElementsByTagName("audio")) {
            sound.preservesPitch = false
            audioContext.createMediaElementSource(sound).connect(audioContext.destination)
        }

        levelInput.name = "level"
        levelInput.disabled = true
        titleHeader.innerHTML = "PAUSE"
        resumeButton.innerHTML = "Reprendre"
        event.target.onsubmit = resume
        stats.level = levelInput.valueAsNumber
        localStorage["startLevel"] = levelInput.value
        playing = true
        onblur = pauseSettings
        resume(event)
    }
}

function resume(event) {
    event.preventDefault()
    event.stopPropagation()

    settings.form.reportValidity()
    settings.form.classList.add('was-validated')

    if (settings.form.checkValidity()) {
        for(const sound of document.getElementsByTagName("audio"))
            sound.volume = sfxVolumeRange.value

        settings.modal.hide()
        settings.getInputs()

        document.onkeydown = onkeydown
        document.onkeyup = onkeyup
    
        stats.time = stats.pauseTime
        scheduler.setInterval(ticktack, 1000)

        if (matrix.piece) scheduler.setInterval(fall, stats.fallPeriod)
        else generate()
    }
}

function ticktack() {
    timeCell.innerText = stats.timeFormat.format(stats.time)
}

function generate(piece) {
    matrix.piece = piece || nextQueue.shift()
    if (!piece && holdQueue.piece) holdQueue.drawPiece()
    //lastActionSucceded = true
    favicon.href = matrix.piece.favicon_href

    if (matrix.piece.canMove(TRANSLATION.NONE)) {
        scheduler.setInterval(fall, stats.fallPeriod)
    } else {
        gameOver() // block out
    }
}

let playerActions = {
    moveLeft: () => matrix.piece.move(TRANSLATION.LEFT),

    moveRight: () => matrix.piece.move(TRANSLATION.RIGHT),

    rotateClockwise: () => matrix.piece.rotate(ROTATION.CW),

    rotateCounterclockwise: () => matrix.piece.rotate(ROTATION.CCW),

    softDrop: () => matrix.piece.move(TRANSLATION.DOWN) && ++stats.score,

    hardDrop: function() {
        scheduler.clearTimeout(lockDown)
        playSound(hardDropSound)
        while (matrix.piece.move(TRANSLATION.DOWN, ROTATION.NONE, true)) stats.score += 2
        matrixCard.classList.remove("hard-dropped-table-animation")
        matrixCard.offsetHeight;
        matrixCard.classList.add("hard-dropped-table-animation") // restart animation
        lockDown()
        return true
    },

    hold: function() {
        if (matrix.piece.holdEnabled) {
            scheduler.clearInterval(fall)
            scheduler.clearTimeout(lockDown)

            let piece = matrix.piece
            piece.facing = FACING.NORTH
            piece.locked = false
            generate(holdQueue.piece)
            matrix.piece.holdEnabled = false
            holdQueue.piece = piece
        }
    },
    
    pause: pauseSettings,
}

// Handle player inputs
const REPEATABLE_ACTIONS = [
    playerActions.moveLeft,
    playerActions.moveRight,
    playerActions.softDrop
]
pressedKeys = new Set()
actionsQueue = []

function onkeydown(event) {
    if (event.key in settings.keyBind) {
        event.preventDefault()
        if (!pressedKeys.has(event.key)) {
            pressedKeys.add(event.key)
            action = settings.keyBind[event.key]
            /*if (action()) {
                lastActionSucceded = true
            } else if (lastActionSucceded || !(action in REPEATABLE_ACTIONS)) {
                playSound(wallSound)
                lastActionSucceded = false
            }*/
            action()
            if (REPEATABLE_ACTIONS.includes(action)) {
                actionsQueue.unshift(action)
                scheduler.clearTimeout(repeat)
                scheduler.clearInterval(autorepeat)
                if (action == playerActions.softDrop) scheduler.setInterval(autorepeat, settings.fallPeriod/20)
                else scheduler.setTimeout(repeat, settings.das)
            }
            matrix.drawPiece()
        }
    }
}

function repeat() {
    if (actionsQueue.length) {
        actionsQueue[0]()
        scheduler.setInterval(autorepeat, settings.arr)
    }
}

function autorepeat() {
    if (actionsQueue.length) {
        /*if (actionsQueue[0]()) {
            lastActionSucceded = true
        } else if (lastActionSucceded) {
            wallSound.play()
            lastActionSucceded = false
        }*/
        actionsQueue[0]()
    }
    else scheduler.clearInterval(autorepeat)
}

function onkeyup(event) {
    if (event.key in settings.keyBind) {
        event.preventDefault()
        pressedKeys.delete(event.key)
        action = settings.keyBind[event.key]
        if (actionsQueue.includes(action)) {
            actionsQueue.splice(actionsQueue.indexOf(action), 1)
            scheduler.clearTimeout(repeat)
            scheduler.clearInterval(autorepeat)
            if (actionsQueue.length) {
                if (actionsQueue[0] == playerActions.softDrop) scheduler.setInterval(autorepeat, settings.fallPeriod/20)
                else scheduler.setTimeout(repeat, settings.das)
            } else {
                matrix.drawPiece()
            }
        }
    }
}

function fall() {
    matrix.piece.move(TRANSLATION.DOWN)
}

function lockDown() {
    scheduler.clearTimeout(lockDown)
    scheduler.clearInterval(fall)

    if (matrix.lock()) {
        stats.lockDown(matrix.piece.tSpin, matrix.clearLines())
        
        generate()
    } else {
        gameOver() // lock out
    }
}

onanimationend = function (event) {
    event.target.classList.remove(event.animationName)
}

messagesSpan.onanimationend = function(event) {
    event.target.remove() 
}

function gameOver() {
    matrix.piece.locked = true
    matrix.drawPiece()

    document.onkeydown = null
    onblur = null
    scheduler.clearInterval(ticktack)
    playing = false

    stats.show()
}

window.onbeforeunload = function(event) {
    stats.save()
    settings.save()
    if (playing) return false;
}

// Play with 3D
let mousedown = false
let rX0 = -15
let rY0 = 0
let clientX0 = 0
let clientY0 = 0

sceneDiv.onmousedown = function(event) {
    mousedown = true
    rX0 = parseInt(getComputedStyle(screenRow).getPropertyValue("--rX"))
    dy0 = parseInt(getComputedStyle(screenRow).getPropertyValue("--rY"))
    clientX0 = event.clientX
    clientY0 = event.clientY
}

sceneDiv.onmousemove = function(event) {
	if (mousedown) {
        event.preventDefault()
        event.stopPropagation()
        rX = (rX0 - 0.5 * (event.clientY - clientY0)) % 360
        screenRow.style.setProperty("--rX", rX)
        if (rX >= 0) {
            screenRow.classList.remove("top")
            screenRow.classList.add("bottom")
        } else {
            screenRow.classList.add("top")
            screenRow.classList.remove("bottom")
        }
        rY = (rY0 + 0.5 * (event.clientX - clientX0)) % 360
        screenRow.style.setProperty("--rY", rY)
        if (rY <= 0) {
            screenRow.classList.remove("left")
            screenRow.classList.add("right")
        } else {
            screenRow.classList.add("left")
            screenRow.classList.remove("right")
        }
    }
}

sceneDiv.onmouseup = document.onmouseleave = function(event) {
    mousedown = false
}

sceneDiv.onwheel = function(event) {
    event.preventDefault()
    event.stopPropagation()
    let tZ = parseInt(getComputedStyle(screenRow).getPropertyValue("--tZ"))
    tZ -= event.deltaY
    screenRow.style.setProperty("--tZ", tZ + "px")
}