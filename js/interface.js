const KEY_NAMES = new Proxy({
    ["ArrowLeft"]   : "←",
    ["←"]           : "ArrowLeft",
    ["ArrowRight"]  : "→",
    ["→"]           : "ArrowRight",
    ["ArrowUp"]     : "↑",
    ["↑"]           : "ArrowUp",
    ["ArrowDown"]   : "↓",
    ["↓"]           : "ArrowDown",
    [" "]           : "Espace",
    ["Espace"]      : " ",
    ["Escape"]      : "Échap.",
    ["Échap."]      : "Escape",
    ["Backspace"]   : "Ret. arrière",
    ["Ret. arrière"]: "Backspace",
    ["Enter"]       : "Entrée",
    ["Entrée"]      : "Enter",
}, {
    get(target, key) {
        return key in target? target[key] : key
    }
})

class Settings {
    constructor() {
        this.form = settingsForm
        this.load()
        this.modal = new bootstrap.Modal('#settingsModal')
        settingsModal.addEventListener('shown.bs.modal', () => resumeButton.focus())
    }

    load() {
        this.form.querySelectorAll("[name]").forEach(element => {
            if (element.name in localStorage)
                element.value = localStorage[element.name]
        })
        window.document.selectedStyleSheetSet = stylesheetSelect.value
    }

    save() {
        this.form.querySelectorAll("[name]").forEach(element => localStorage[element.name] = element.value)
    }

    init() {
        this.form.onsubmit     = newGame
        levelInput.name        = "startLevel"
        levelInput.disabled    = false
        titleHeader.innerHTML  = "QUATUOR"
        resumeButton.innerHTML = "Jouer"
    }

    show() {
        resumeButton.disabled = false
        settings.form.classList.remove('was-validated')
        settings.modal.show()
        settings.form.reportValidity()
    }

    getInputs() {
        for (let input of this.form.querySelectorAll("input[type='text']")) {
            this[input.name] = KEY_NAMES[input.value]
        }
        for (let input of this.form.querySelectorAll("input[type='number'], input[type='range']")) {
            this[input.name] = input.valueAsNumber
        }
        for (let input of this.form.querySelectorAll("input[type='checkbox']")) {
            this[input.name] = input.checked == true
        }
    
        this.keyBind = new Proxy({}, {
            get: (target, key) => target[key.toLowerCase()],
            set: (target, key, value) => target[key.toLowerCase()] = value,
            has: (target, key) => key.toLowerCase() in target
            
        })
        for (let actionName in playerActions) {
            this.keyBind[settings[actionName]] = playerActions[actionName]
        }
    }
}

function changeKey(input) {
    prevValue = input.value
    input.value = ""
    keyInputs = Array.from(input.form.querySelectorAll("input[type='text']"))
    input.onkeydown = function (event) {
        event.preventDefault()
        input.value = KEY_NAMES[event.key]
        keyInputs.forEach(input => {
            input.setCustomValidity("")
            input.classList.remove("is-invalid")
        })
        keyInputs.sort((input1, input2) => {
            if(input1.value == input2.value) {
                input1.setCustomValidity("Touche déjà utilisée")
                input1.classList.add("is-invalid")
                input2.setCustomValidity("Touche déjà utilisée")
                input2.classList.add("is-invalid")
            }
            return input1.value > input2.value
        })
        if (input.checkValidity()) {
            input.blur()
        }
    }
    input.onblur = function (event) {
        if (!input.value) input.value = prevValue
        input.onkeydown = null
        input.onblur = null
    }
}


class Stats {
    constructor() {
        this.modal = new bootstrap.Modal('#statsModal')
        this.load()
    }

    load() {
        this.highScore = Number(localStorage["highScore"]) || 0
    }

    init() {
        levelInput.value = localStorage["startLevel"] || 1
        this.score = 0
        this.goal = 0
        this.combo = 0
        this.b2b = 0
        this.startTime = new Date()
        this.lockDelay = DELAY.LOCK
        this.totalClearedLines = 0
        this.nbQuatuors = 0
        this.nbTSpin = 0
        this.maxCombo = 0
        this.maxB2B = 0
    }

    set score(score) {
        this._score = score
        scoreCell.innerText = score.toLocaleString()
        if (score > this.highScore) {
            this.highScore = score
        }
    }

    get score() {
        return this._score
    }

    set highScore(highScore) {
        this._highScore = highScore
        highScoreCell.innerText = highScore.toLocaleString()
    }

    get highScore() {
        return this._highScore
    }

    set level(level) {
        this._level = level
        this.goal += level * 5
        if (level <= 20){
            this.fallPeriod = 1000 * Math.pow(0.8 - ((level - 1) * 0.007), level - 1)
        }
        if (level > 15)
            this.lockDelay = 500 * Math.pow(0.9, level - 15)
        levelInput.value = level
        levelCell.innerText = level
        messagesSpan.addNewChild("div", { className: "show-level-animation", innerHTML: `<h1>NIVEAU<br/>${this.level}</h1>` })
    }

    get level() {
        return this._level
    }

    set goal(goal) {
        this._goal = goal
        goalCell.innerText = goal
    }

    get goal() {
        return this._goal
    }

    set combo(combo) {
        this._combo = combo
        if (combo > this.maxCombo) this.maxCombo = combo
    }

    get combo() {
        return this._combo
    }

    set b2b(b2b) {
        this._b2b = b2b
        if (b2b > this.maxB2B) this.maxB2B = b2b
    }

    get b2b() {
        return this._b2b
    }

    set time(time) {
        this.startTime = new Date() - time
        ticktack()
    }

    get time() {
        return new Date() - this.startTime
    }

    lockDown(tSpin, nbClearedLines) {
        this.totalClearedLines += nbClearedLines
        if (nbClearedLines == 4) this.nbQuatuors++
        if (tSpin == T_SPIN.T_SPIN) this.nbTSpin++

        // Cleared lines & T-Spin
        let awardedLineClears = AWARDED_LINE_CLEARS[tSpin][nbClearedLines]
        let patternScore = 100 * this.level * awardedLineClears
        if (tSpin) messagesSpan.addNewChild("div", {
            className: "rotate-in-animation",
            innerHTML: tSpin
        })
        if (nbClearedLines) messagesSpan.addNewChild("div", {
            className: "zoom-in-animation",
            innerHTML: CLEARED_LINES_NAMES[nbClearedLines]
        })
        if (patternScore) {
            messagesSpan.addNewChild("div", {
                className: "zoom-in-animation",
                style: "animation-delay: .2s",
                innerHTML: patternScore
            })
            this.score += patternScore
        }

        // Combo
        if (nbClearedLines) {
            this.combo++
            if (this.combo >= 1) {
                let comboScore = (nbClearedLines == 1 ? 20 : 50) * this.combo * this.level
                if (this.combo == 1) {
                    messagesSpan.addNewChild("div", {
                        className: "zoom-in-animation",
                        style: "animation-delay: .4s",
                        innerHTML: `COMBO<br/>${comboScore}`
                    })
                } else {
                    messagesSpan.addNewChild("div", {
                        className: "zoom-in-animation",
                        style: "animation-delay: .4s",
                        innerHTML: `COMBO x${this.combo}<br/>${comboScore}`
                    })
                }
                this.score += comboScore
            }
        } else {
            this.combo = -1
        }

        // Back to back sequence
        if ((nbClearedLines == 4) || (tSpin && nbClearedLines)) {
            this.b2b++
            if (this.b2b >= 1) {
                let b2bScore = patternScore / 2
                if (this.b2b == 1) {
                    messagesSpan.addNewChild("div", {
                        className: "zoom-in-animation",
                        style: "animation-delay: .4s",
                        innerHTML: `BOUT À BOUT<br/>${b2bScore}`
                    })
                } else {
                    messagesSpan.addNewChild("div", {
                        className: "zoom-in-animation",
                        style: "animation-delay: .4s",
                        innerHTML: `BOUT À BOUT x${this.b2b}<br/>${b2bScore}`
                    })
                }
                this.score += b2bScore
            }
        } else if (nbClearedLines && !tSpin ) {
            if (this.b2b >= 1) {
                messagesSpan.addNewChild("div", {
                    className: "zoom-in-animation",
                    style: "animation-delay: .4s",
                    innerHTML: `FIN DU BOUT À BOUT`
                })
            }
            this.b2b = -1
        }

        // Sound
        if (sfxVolumeRange.value) {
            if (nbClearedLines == 4) playSound(quatuorSound, this.combo)
            else if (nbClearedLines) playSound(lineClearSound, this.combo)
            if (tSpin) playSound(tSpinSound, this.combo)
        }

        this.goal -= awardedLineClears
        if (this.goal <= 0) this.level++
    }

    show() {
        let time = stats.time
        statsModalScoreCell.innerText           = this.score.toLocaleString()
        statsModalHighScoreCell.innerText       = this.highScore.toLocaleString()
        statsModalLevelCell.innerText           = this.level
        statsModalTimeCell.innerText            = this.timeFormat.format(time)
        statsModaltotalClearedLines.innerText   = this.totalClearedLines
        statsModaltotalClearedLinesPM.innerText = (stats.totalClearedLines * 60000 / time).toFixed(2)
        statsModalNbQuatuors.innerText          = this.nbQuatuors
        statsModalNbTSpin.innerText             = this.nbTSpin
        statsModalMaxCombo.innerText            = this.maxCombo
        statsModalMaxB2B.innerText              = this.maxB2B
        this.modal.show()
    }

    save() {
        localStorage["highScore"] = this.highScore
    }
}
Stats.prototype.timeFormat = new Intl.DateTimeFormat("fr-FR", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC"
})

function playSound(sound, note=0) {
    sound.currentTime = 0
    sound.playbackRate = Math.pow(5/4, note)
    sound.play()
}