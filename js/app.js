document.onfullscreenchange = function () {
    if (document.fullscreenElement) {
        fullscreenCheckbox.checked = true;
    } else {
        fullscreenCheckbox.checked = false;
        if (playing) pauseSettings();
    }
};
document.onfullscreenerror = function () {
    fullscreenCheckbox.checked = false;
};

function restart() {
    stats.modal.hide();
    holdQueue.init();
    holdQueue.redraw();
    stats.init();
    matrix.init();
    nextQueue.init();
    settings.init();
    pauseSettings();
}

function pauseSettings() {
    scheduler.clearInterval(fall);
    scheduler.clearTimeout(lockDown);
    scheduler.clearTimeout(repeat);
    scheduler.clearInterval(autorepeat);
    scheduler.clearInterval(ticktack);
    stats.pauseTime = stats.time;

    document.onkeydown = null;

    settings.show();
    playSound(menuhover)
}

function newGame(event) {
    if (!settings.form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        settings.form.reportValidity();
        settings.form.classList.add('was-validated');
    } else {
        const audioContext = new AudioContext();
        for (const sound of document.getElementsByTagName('audio')) {
            sound.preservesPitch = false;
            audioContext.createMediaElementSource(sound).connect(audioContext.destination);
        }

        levelInput.name = 'level';
        levelInput.disabled = true;
        titleHeader.innerHTML = 'PAUSE';
        resumeButton.innerHTML = 'Reprendre';
        event.target.onsubmit = resume;
        stats.level = levelInput.valueAsNumber;
        localStorage['startLevel'] = levelInput.value;
        playing = true;
        onblur = pauseSettings;
        resume(event);
    }
}

function resume(event) {
    event.preventDefault();
    event.stopPropagation();

    settings.form.reportValidity();
    settings.form.classList.add('was-validated');

    if (settings.form.checkValidity()) {
        for (const sound of document.getElementsByTagName('audio'))
            sound.volume = sfxVolumeRange.value;

        settings.modal.hide();
        settings.getInputs();

        document.onkeydown = onkeydown;
        document.onkeyup = onkeyup;

        stats.time = stats.pauseTime;
        scheduler.setInterval(ticktack, 1000);

        if (matrix.piece) scheduler.setInterval(fall, stats.fallPeriod);
        else generate();

        playSound(menuconfirm)
    }
}

function ticktack() {
    timeCell.innerText = stats.timeFormat.format(stats.time);
}

function generate(piece) {
    matrix.piece = piece || nextQueue.shift();
    if (!piece && holdQueue.piece) holdQueue.drawPiece();
    //lastActionSucceded = true
    favicon.href = matrix.piece.favicon_href;

    if (matrix.piece.canMove(TRANSLATION.NONE)) {
        scheduler.setInterval(fall, stats.fallPeriod);
    } else {
        gameOver(); // block out
    }
}

let playerActions = {
    moveLeft: () => matrix.piece.move(TRANSLATION.LEFT)? playSound(move) : playSound(hit),

    moveRight: () => matrix.piece.move(TRANSLATION.RIGHT)? playSound(move) : playSound(hit),

    rotateClockwise: () => matrix.piece.rotate(ROTATION.CW)? playSound(rotate) : playSound(hit),

    rotateCounterclockwise: () => matrix.piece.rotate(ROTATION.CCW)? playSound(rotate) : playSound(hit),

    softDrop: () => (matrix.piece.move(TRANSLATION.DOWN) && ++stats.score)? playSound(move) : playSound(floor),

    hardDrop: function () {
        scheduler.clearTimeout(lockDown);
        playSound(harddrop);
        while (matrix.piece.move(TRANSLATION.DOWN, ROTATION.NONE, true)) stats.score += 2;
        matrixCard.classList.remove('hard-dropped-table-animation');
        matrixCard.offsetHeight;
        matrixCard.classList.add('hard-dropped-table-animation'); // restart animation
        lockDown();
        return true;
    },

    hold: function () {
        if (matrix.piece.holdEnabled) {
            scheduler.clearInterval(fall);
            scheduler.clearTimeout(lockDown);
            playSound(hold)

            let piece = matrix.piece;
            piece.facing = FACING.NORTH;
            piece.locked = false;
            generate(holdQueue.piece);
            matrix.piece.holdEnabled = false;
            holdQueue.piece = piece;
        }
    },

    pause: pauseSettings,
};

// Handle player inputs
const REPEATABLE_ACTIONS = [
    playerActions.moveLeft,
    playerActions.moveRight,
    playerActions.softDrop,
];
pressedKeys = new Set();
actionsQueue = [];

function onkeydown(event) {
    if (event.key in settings.keyBind) {
        event.preventDefault();
        if (!pressedKeys.has(event.key)) {
            pressedKeys.add(event.key);
            action = settings.keyBind[event.key];
            /*if (action()) {
                lastActionSucceded = true
            } else if (lastActionSucceded || !(action in REPEATABLE_ACTIONS)) {
                playSound(wallSound)
                lastActionSucceded = false
            }*/
            action();
            if (REPEATABLE_ACTIONS.includes(action)) {
                actionsQueue.unshift(action);
                scheduler.clearTimeout(repeat);
                scheduler.clearInterval(autorepeat);
                if (action == playerActions.softDrop)
                    scheduler.setInterval(autorepeat, settings.fallPeriod / 20);
                else scheduler.setTimeout(repeat, settings.das);
            }
            matrix.drawPiece();
        }
    }
}

function repeat() {
    if (actionsQueue.length) {
        actionsQueue[0]();
        scheduler.setInterval(autorepeat, settings.arr);
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
        actionsQueue[0]();
    } else scheduler.clearInterval(autorepeat);
}

function onkeyup(event) {
    if (event.key in settings.keyBind) {
        event.preventDefault();
        pressedKeys.delete(event.key);
        action = settings.keyBind[event.key];
        if (actionsQueue.includes(action)) {
            actionsQueue.splice(actionsQueue.indexOf(action), 1);
            scheduler.clearTimeout(repeat);
            scheduler.clearInterval(autorepeat);
            if (actionsQueue.length) {
                if (actionsQueue[0] == playerActions.softDrop)
                    scheduler.setInterval(autorepeat, settings.fallPeriod / 20);
                else scheduler.setTimeout(repeat, settings.das);
            } else {
                matrix.drawPiece();
            }
        }
    }
}

function fall() {
    matrix.piece.move(TRANSLATION.DOWN);
}

function lockDown() {
    scheduler.clearTimeout(lockDown);
    scheduler.clearInterval(fall);

    if (matrix.lock()) {
        stats.lockDown(matrix.piece.tSpin, matrix.clearLines());

        generate();
    } else {
        gameOver(); // lock out
    }
}

onanimationend = function (event) {
    event.target.classList.remove(event.animationName);
};

messagesSpan.onanimationend = function (event) {
    event.target.remove();
};

function gameOver() {
    matrix.piece.locked = true;
    matrix.drawPiece();

    document.onkeydown = null;
    onblur = null;
    scheduler.clearInterval(ticktack);
    playing = false;

    stats.show();
    playSound(gameover)
}

window.onbeforeunload = function (event) {
    stats.save();
    settings.save();
    if (playing) return false;
};

// Play with 3D
let mousedown = false;
let rX0 = -15;
let rY0 = 0;
let clientX0 = 0;
let clientY0 = 0;

sceneDiv.onmousedown = function (event) {
    mousedown = true;
    rX0 = parseInt(getComputedStyle(screenRow).getPropertyValue('--rX'));
    dy0 = parseInt(getComputedStyle(screenRow).getPropertyValue('--rY'));
    clientX0 = event.clientX;
    clientY0 = event.clientY;
};

sceneDiv.onmousemove = function (event) {
    if (mousedown) {
        event.preventDefault();
        event.stopPropagation();
        rX = (rX0 - 0.5 * (event.clientY - clientY0)) % 360;
        screenRow.style.setProperty('--rX', rX);
        if (rX >= 0) {
            screenRow.classList.remove('top');
            screenRow.classList.add('bottom');
        } else {
            screenRow.classList.add('top');
            screenRow.classList.remove('bottom');
        }
        rY = (rY0 + 0.5 * (event.clientX - clientX0)) % 360;
        screenRow.style.setProperty('--rY', rY);
        if (rY <= 0) {
            screenRow.classList.remove('left');
            screenRow.classList.add('right');
        } else {
            screenRow.classList.add('left');
            screenRow.classList.remove('right');
        }
    }
};

sceneDiv.onmouseup = document.onmouseleave = function (event) {
    mousedown = false;
};

fullscreenCheckbox.onchange = function () {
    if (this.checked) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
};

sceneDiv.onwheel = function (event) {
    event.preventDefault();
    event.stopPropagation();
    let tZ = parseInt(getComputedStyle(screenRow).getPropertyValue('--tZ'));
    tZ -= event.deltaY;
    screenRow.style.setProperty('--tZ', tZ + 'px');
};

const ImageURLPattern = /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|bmp|webp|svg))$/i
$.fn.select2.defaults.set("templateResult", (state) =>
    state.id
    ? $(`<img class="preview" src="${state.id}" title="${state.text}" loading="lazy"/>`)
    : state.text
)
$.fn.select2.defaults.set("templateSelection", (state) =>
    state.id
        ? $(`
<table class="minoes-table preview" style="--skin-url: url(${state.id});">
    <tr><td class="Z mino"></td><td class="O mino"></td><td class="T mino"></td><td class="I mino"></td></tr>
</table>
`)
        : state.text
)
$.fn.select2.defaults.set("theme", "bootstrap-5")
$.fn.select2.defaults.set("selectionCssClass", 'form-select')
$.fn.select2.defaults.set("dropdownParent", $('#settingsModal'))
$.fn.select2.defaults.set("dropdownAutoWidth", true)
$.fn.select2.defaults.set("placeholder", "URL de l'image")
$.fn.select2.defaults.set("tags", true)
$.fn.select2.defaults.set("createTag", function (params) {
    const url = encodeURI(params.term);
    if (ImageURLPattern.test(url)) {
        return {
            id: url,
            text: 'Source externe',
            newTag: true,
        };
    }
});

stylesheetSelect.oninput = function (event) {
    selectedStyleSheet.href = this.value;

    $("#skinURLSelect").empty();

    switch (this.value) {
        case 'css/tetrio-skin.css':
            skinURLSelect.disabled = false;

            const baseURL = "https://you.have.fail/tetrioplus/data"
            fetch(`${baseURL}/data.json`)
                .then((resp) => resp.json())
                .then((json) => {
                    json = json.filter((item) => (item.type == "skin" && item.format == "tetrioraster" && /\.(?:png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(item.path)))
                    const groups = Map.groupBy(json, (skin) => skin.author)
                    const data = groups.entries().map(([author, skins]) => {
                        return {
                            text: author,
                            children: skins.map((skin) => {
                                return {
                                    id: `${baseURL}/${encodeURI(skin.path)}`,
                                    text:`${skin.name}\n${skin.description}`
                                }
                            })
                        }
                    }).toArray()
                    data.push({
                        text: "AdrienMalin",
                        children: [{
                            id: `${document.location.href}/css/tetrio-skin/a_forest.png`,
                            text: "A forest"
                        }]
                    })
                    $('#skinURLSelect').select2({data: data});
                })
            break;

        case 'css/jstris-skin.css':
            skinURLSelect.disabled = false;

            fetch('https://konsola5.github.io/jstris-customization-database/jstrisCustomizationDatabase.json')
                .then(response => response.json())
                .then(json => {
                    const data = [];
                    for (const group in json) {
                        const groupData = {
                            text: group,
                            children: json[group].map(skin => ({
                                id: skin.link,
                                text: `${skin.name} by ${skin.author}`,
                            })),
                        };
                        data.push(groupData);
                    }
                    $('#skinURLSelect').select2({data: data});
                });
            break;

        default:
            skinURLSelect.disabled = true;
            break;
    }
}

let scheduler = new Scheduler();
let settings = new Settings();
let stats = new Stats();
let holdQueue = new HoldQueue();
let matrix = new Matrix();
let nextQueue = new NextQueue();
let playing = false;
//let lastActionSucceded = true
let favicon = document.querySelector("link[rel~='icon']");

window.onload = function (event) {
    restart();
};
