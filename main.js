const mpVersion = '1.4.0';

let remoteRun = window.location.protocol !== "file:"

let maxR

/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');
/**
 * 1: touch
 * 2: bonus touch
 * 3: snap inward
 * 4: snap outward
 * 5: flick left
 * 6: flick left with circle effect
 * 7: flick right
 * 8: flick right with circle effect
 * 9: hold start
 * 10: hold step
 * 11: hold end
 * 12: lane effect
 * 13: lane effect
 * 14: end of chart
 * 16: chain
 * 20: touch R
 * 21: snap inward R
 * 22: snap outward R
 * 23: flick left R
 * 24: flick right R
 * 25: hold start R
 * 26: chain R
 */
let noteList = [];
/**
 * 2: bpm
 * 3: met
 * 5: hi-speed
 * 6: reverse start
 * 7: reverse point
 * 8: reverse end
 * 9: stop start
 * 10: stop end
 */
let controlList = [];
let noteListForPlayback = []
let bpmList = []
let metList = []
let hiSpeedTsList = []
let laneToggleList = []
let idOffsetMap = []
let prevIdMap = {}
let chartHeader = {}
let reverseSection = []
let holdList = []
let seTrigger = []
let pendingSeTrigger = []
let seRTrigger = []
let pendingSeRTrigger = []
let seSwipeTrigger = []
let pendingSeSwipeTrigger = []
let seBonusTrigger = []
let pendingSeBonusTrigger = []
let seClockTrigger = []
let pendingSeClockTrigger = []
let comboInfo = [0,0]

const arrowCanvas = {
  in: document.createElement('canvas'),
  out: document.createElement('canvas'),
}

loadSettings()

function pathToArcPoint(ctx, x, y, r, angle) {
  ctx.lineTo(
    x + Math.cos(angle) * r,
    y + Math.sin(angle) * r,
  )
}
function createArrows() {
  arrowCanvas.in.width = maxR*2, arrowCanvas.in.height = maxR*2
  arrowCanvas.out.width = maxR*2, arrowCanvas.out.height = maxR*2
  const ctx = {
    in: arrowCanvas.in.getContext('2d'),
    out: arrowCanvas.out.getContext('2d'),
  }

  const borderWidth = 12 * displayRatio, colorWidth = 5 * displayRatio

  ctx.in.translate(maxR, maxR); ctx.in.rotate(Math.PI / 2); ctx.in.translate(-maxR, -maxR)
  for (let i = 0; i < 30; i++) {
    ctx.in.beginPath()
    pathToArcPoint(ctx.in, maxR, maxR, maxR * 0.9, (i+0.25) * Math.PI / 15)
    pathToArcPoint(ctx.in, maxR, maxR, maxR * 0.8, (i+0.5) * Math.PI / 15)
    pathToArcPoint(ctx.in, maxR, maxR, maxR * 0.9, (i+0.75) * Math.PI / 15)
    ctx.in.strokeStyle = 'rgb(200,200,200)'; ctx.in.lineWidth = borderWidth; ctx.in.stroke()
    ctx.in.strokeStyle = 'rgb(203,29,25)'; ctx.in.lineWidth = colorWidth; ctx.in.stroke()
  }

  ctx.out.translate(maxR, maxR); ctx.out.rotate(Math.PI / 2); ctx.out.translate(-maxR, -maxR)
  for (let i = 0; i < 30; i++) {
    ctx.out.beginPath()
    pathToArcPoint(ctx.out, maxR, maxR, maxR * 0.75, (i+0.25) * Math.PI / 15)
    pathToArcPoint(ctx.out, maxR, maxR, maxR * 0.85, (i+0.5) * Math.PI / 15)
    pathToArcPoint(ctx.out, maxR, maxR, maxR * 0.75, (i+0.75) * Math.PI / 15)
    ctx.out.strokeStyle = 'rgb(200,200,200)'; ctx.out.lineWidth = borderWidth; ctx.out.stroke()
    ctx.out.strokeStyle = 'rgb(33,180,251)'; ctx.out.lineWidth = colorWidth; ctx.out.stroke()
  }
}

const TICK_PER_GAME_SECTION = 1920;
const TICK_PER_BEAT = TICK_PER_GAME_SECTION / 3.8;
let RENDER_DISTANCE = 750

let musicTable
function cutText(s) {
  const charRenderSize = s.split('').map(c=> c.match(/[a-zA-Z0-9 ]/)?1:2)
  const renderLengthTotal = charRenderSize.reduce((s,v) => s+v, 0)
  if (renderLengthTotal < 30) return s
  let renderLength = 0
  for (let i=0; i<charRenderSize.length; i++) {
    renderLength += charRenderSize[i]
    if (renderLength > 25) return s.substr(0, i) + '...'
  }
}
const seContext = new AudioContext

let seBuffer = null
let seRBuffer = null
let seSwipeBuffer = null
let seBonusBuffer = null
let clkBuffer = null

if (remoteRun) {
  fetch('MusicData/charts.json').then(r=>r.json()).then(r => {
    musicTable = {}
    const keys = Object.keys(r)
    keys.sort((a,b) => Number(a)>Number(b)?1:-1)
    keys.forEach(open => {
      let music = r[open]
      musicTable[music.UniqueID] = music;
      const option = music_select.appendChild(document.createElement('option'))
      option.value = music.UniqueID

      /* this sucks */

      music.DifficultyNormalLv = (+music.DifficultyNormalLv).toFixed(1)
      music.DifficultyHardLv = (+music.DifficultyHardLv).toFixed(1)
      music.DifficultyExtremeLv = (+music.DifficultyExtremeLv).toFixed(1)
      music.DifficultyInfernoLv = (+music.DifficultyInfernoLv).toFixed(1)

      diffi = [music.DifficultyNormalLv, music.DifficultyHardLv, music.DifficultyExtremeLv]
      if (music.DifficultyInfernoLv != 0) diffi.push(music.DifficultyInfernoLv)
      let title = cutText(music.MusicMessage), artist = cutText(music.ArtistMessage)
      option.textContent = `${title} - ${artist} [${music.UniqueID}]`
    })
    music_select.value = music_select.children[0].value
    music_select.dispatchEvent(new Event('change'))

    window.pickOfficialFromHash = () => {
      if (!remoteRun) return

      // enable officials
      toggle_officials.checked = true
      toggle_officials.dispatchEvent(new Event('input'))

      // check for difficulty
      let sp = location.hash.slice(1).split('_')
      if(sp.length > 1) diffi_select.value = Number(sp[1])
      music_select.value = Number(sp[0])
      music_select.dispatchEvent(new Event('change'))

      loadUsingSelect()
    }

    window.addEventListener("hashchange", pickOfficialFromHash)

    window.addEventListener("hashchange", () => {
      console.log("hash changed to "+location.hash)
    })

    if (location.hash !== '') {
      pickOfficialFromHash()
    }
  }).catch(e => {
    console.error('failed loading music table', e)
    toggle_officials.parentNode.style.display = 'none'
  })

  fetch('sound/tap.wav').then(r => r.arrayBuffer()).then(r => {
    seContext.decodeAudioData(r, buf => {
      if (buf) {
        seBuffer = buf
      } else {
        console.error('decode failed')
      }
    }, e => console.error(e))
  })

  fetch('sound/r_note.wav').then(r => r.arrayBuffer()).then(r => {
    seContext.decodeAudioData(r, buf => {
      if (buf) {
        seRBuffer = buf
      } else {
        console.error('decode failed')
      }
    }, e => console.error(e))
  })

  fetch('sound/swipe.wav').then(r => r.arrayBuffer()).then(r => {
    seContext.decodeAudioData(r, buf => {
      if (buf) {
        seSwipeBuffer = buf
      } else {
        console.error('decode failed')
      }
    }, e => console.error(e))
  })

  fetch('sound/bonus.wav').then(r => r.arrayBuffer()).then(r => {
    seContext.decodeAudioData(r, buf => {
      if (buf) {
        seBonusBuffer = buf
      } else {
        console.error('decode failed')
      }
    }, e => console.error(e))
  })

  fetch('sound/click.wav').then(r => r.arrayBuffer()).then(r => {
    seContext.decodeAudioData(r, buf => {
      if (buf) {
        clkBuffer = buf
      } else {
        console.error('decode failed')
      }
    }, e => console.error(e))
  })
}

document.addEventListener('dragover', (e) => {
  e.preventDefault()
});
document.addEventListener('drop', (e) => {
  e.preventDefault()
  var files = e.dataTransfer.files;
  for (var i = 0; i < files.length; i++) {
    var ext = files[i]['name'].split('.').pop();

    const dT = new DataTransfer();
    dT.items.add(e.dataTransfer.files[i]);

    switch (ext) {
		/*
      case 'wav':
        document.getElementById('se_file').files = dT.files;
        se_file_load(); // immediately load
        break;
		*/
      case 'mer':
        document.getElementById('music_file').files = dT.files;
        break;
      case 'mp3':
        document.getElementById('bgm_file').files = dT.files;
        break;
      default:
        document.getElementById('bgm_file').files = dT.files;
        break;
    }
  }
  if (files.length >= 2) { // wav already loaded?
    loadUsingFile();
  }
});

function loadFiles() {
  if (toggle_officials.checked) loadUsingSelect()
  else loadUsingFile()
}

function loadUsingSelect() {
  const id = music_select.value | 0
  const diffi = diffi_select.value | 0
  if (!musicTable[id]) return alert('no such music id')
  if (diffi < 0 || diffi > 3 || (diffi == 3 && musicTable[id].DifficultyInfernoLv == 0)) return alert('no such difficulty level')
  stop()
  const strId = musicTable[id].AssetDirectory
  parseNotesFromFile(`MusicData/${strId}/${strId}_0${diffi}.mer`)
  history.replaceState(null, null, document.location.pathname + `#${id}_${diffi}`);
  if (bgm_file.files.length) setBgm(URL.createObjectURL(bgm_file.files[0]))
  else setBgm(null)
}
function loadUsingFile() {
  if (music_file.files.length) {
    stop()
    const reader = new FileReader()
    reader.readAsText(music_file.files[0], 'UTF-8')
    reader.onload = e => parseNotesFromText(reader.result)
    bgmFileName = 'file'
    if (bgm_file.files.length) setBgm(URL.createObjectURL(bgm_file.files[0]))
	else setBgm(null)
  } else {
    alert('Please select a chart file.')
  }
}
music_select.addEventListener('change', e => {
  if (!musicTable[music_select.value]) return
  bgm_file.value = null
  const music = musicTable[music_select.value]
  diffi_select.children[0].textContent = `Normal (${music.DifficultyNormalLv}) - ${music.NotesDesignerNormal}`
  diffi_select.children[1].textContent = `Hard (${music.DifficultyHardLv}) - ${music.NotesDesignerHard}`
  diffi_select.children[2].textContent = `Expert (${music.DifficultyExtremeLv}) - ${music.NotesDesignerExpert}`
  if (music.DifficultyInfernoLv == 0) {
    diffi_select.children[3].setAttribute('disabled', '')
    diffi_select.children[3].textContent = 'Inferno'
    if (diffi_select.value === '3') diffi_select.value = '2'
  } else {
    diffi_select.children[3].removeAttribute('disabled')
    diffi_select.children[3].textContent = `Inferno (${music.DifficultyInfernoLv}) - ${music.NotesDesignerInferno}`
  }
})

let bgmBuffer = null
let bgmFileName = 'file'
function setBgm(path) {
  bgmCtr.duration = 0
  bgmBuffer = null
  if(path != null) {
	  fetch(path).then(r => r.arrayBuffer()).then(b => {
		setBgmFromBuffer(b)
	  }).catch(e => console.error(path, e))
  }
  stop()
}
function setBgmFromBuffer(r) {
  seContext.decodeAudioData(r, buf => {
    if (buf) {
      bgmBuffer = buf
      bgmCtr.duration = bgmBuffer.duration
    } else {
      console.error('decode failed')
    }
  }, e => console.error(e))
}
function parseNotesFromFile(file) {
  fetch(file).then(r=>r.text()).then(parseNotesFromText)
}
function tickFromSectionAndTick(section, tick) {
  return section * 1920 + tick;
}
function parseNotesFromText(text) {
  const lines = text.trim().replace(/ +/g, '\t').split('\n');
  
  let validChart = false
  lines.forEach(line => {
	if(line.startsWith('#BODY')) {
		validChart = true;
	}
  })
  
  if(!validChart) {
	alert("This is not a valid chart file!")
	return
  }
  
  noteList = []
  controlList = []
  noteListForPlayback = []
  bpmList = []
  metList = []
  hiSpeedTsList = []
  idOffsetMap = []
  prevIdMap = {}
  chartHeader = {}
  reverseSection = []
  holdList = []
  seTrigger = []
  seRTrigger = []
  seSwipeTrigger = []
  seBonusTrigger = []
  seClockTrigger = []
  comboInfo = [0,0]
  const controlDupFix = {}
  
  let lastEventTick = 0;
  let nextHoldMap = {}
  const holdFillTickGap = 3
  const tickNoteCount = {}
  lines.forEach(line => {
    line = line.trim().split('\t');
    // ignore headers
    if (line[0].substr(0, 1) == '#') {
      const headerName = line.shift().substr(1)
      chartHeader[headerName] = line.join(' ')
      return;
    }
    // actual note
    if (line[2] == '1') {
      const note = {
        section: parseInt(line[0]),
        tick: parseInt(line[1]),
        tickTotal: 0,
        noteType: line[3],
        id: parseInt(line[4]),
        laneOffset: parseInt(line[5]),
        noteWidth: parseInt(line[6]),
        extParam1: parseInt(line[7]),
        extParam2: line[8] != undefined ? parseInt(line[8]) : null
      }
      note.tickTotal = tickFromSectionAndTick(note.section, note.tick);
      if (['10','11','12','13','16','26'].indexOf(note.noteType) === -1) {
        if (!tickNoteCount[note.tickTotal]) tickNoteCount[note.tickTotal] = 0
        tickNoteCount[note.tickTotal]++
      }
      note.hasSameTime = false
      noteList.push(note)
      lastEventTick = Math.max(lastEventTick, note.tickTotal)
      if (note.noteType == '9' || note.noteType == '10' || note.noteType == '25') {
        prevIdMap[note.extParam2] = note.id
      }
    } else {
      const control = {
        section: parseInt(line[0]),
        tick: parseInt(line[1]),
        tickTotal: 0,
        cmdType: line[2],
        value1: parseFloat(line[3]),
        value2: line[4] != undefined ? parseFloat(line[4]) : null,
      }
      if (isNaN(control.section) || isNaN(control.tick)) return
      const controlId = line[0]+'_'+line[1]+'_'+line[2]
      control.tickTotal = tickFromSectionAndTick(control.section, control.tick);
      if (controlDupFix[controlId]) {
        controlList[controlDupFix[controlId]] = control
      } else {
        controlDupFix[controlId] = controlList.length
        controlList.push(control)
      }
      if (control.cmdType == '9') {
        control.cmdType = '5'
        control.value1 = 0
      }
      if (control.cmdType == '10') {
        control.cmdType = '5'
        control.value1 = 1
      }
      noteList.push(control)
      lastEventTick = Math.max(lastEventTick, control.tickTotal)
    }
  })
  lastEventTick++;
  
  // add section seperator
  for (let i=0; i <= lastEventTick; i+= 1920) {
    noteList.push({
      section: i / 1920,
      tick: 0,
      tickTotal: i,
      noteType: 'sectionSep',
    })
  }

  noteList = noteList.sort((a, b) => a.tickTotal - b.tickTotal)
  let noteNo = 0
  let timeStampOffset = 0;
  bpmList = controlList.filter(i => i.cmdType === '2')
  metList = controlList.filter(i => i.cmdType === '3')
  let metOffset = 0
  let TICK_PER_BEAT = TICK_PER_GAME_SECTION / 4
  {
    const currentMet = metList[metOffset]
    const beatPerSectionMul = currentMet.value1
    const beatPerSectionDiv = currentMet.value2 == null ? 4 : currentMet.value2
    TICK_PER_BEAT = TICK_PER_GAME_SECTION / beatPerSectionMul * beatPerSectionDiv / 4
  }
  // convert section/tick to milli second
  for (let i = 0; i < bpmList.length; i++) {
    const currentBpm = bpmList[i]
    let fromTick = currentBpm.tickTotal
    const toTick = i == bpmList.length - 1 ? lastEventTick : bpmList[i + 1].tickTotal
    const bpm = currentBpm.value1
    for (; noteNo < noteList.length; noteNo++) {
      const currentNote = noteList[noteNo]
      if (currentNote.tickTotal > toTick) break;
      if (metOffset < metList.length - 1 && currentNote.tickTotal > metList[metOffset + 1].tickTotal) {
        metOffset++
        timeStampOffset += Math.round((metList[metOffset].tickTotal - fromTick) / TICK_PER_BEAT * 60000 / bpm);
        fromTick = metList[metOffset].tickTotal
        const currentMet = metList[metOffset]
        const beatPerSectionMul = currentMet.value1
        const beatPerSectionDiv = currentMet.value2 == null ? 4 : currentMet.value2
        TICK_PER_BEAT = TICK_PER_GAME_SECTION / beatPerSectionMul * beatPerSectionDiv / 4
      }
      currentNote.timestamp = timeStampOffset + Math.round((currentNote.tickTotal - fromTick) / TICK_PER_BEAT * 60000 / bpm);
      if (currentNote.noteType !== undefined) noteListForPlayback.push(currentNote);
      if (currentNote.noteType === '14') chartLength = currentNote.timestamp
      if (tickNoteCount[currentNote.tickTotal] > 1 && ['sectionSep', '10', '11', '12', '13', '16', '26'].indexOf(currentNote.noteType) === -1) currentNote.hasSameTime = true
    }
    timeStampOffset += Math.round((toTick - fromTick) / TICK_PER_BEAT * 60000 / bpm);
  }
  
  const hiSpeedList = controlList.filter(i => i.cmdType === '5')
  noteNo = 0;
  let distanceOffset = 0;
  hiSpeedList.unshift({tickTotal:-999999, value1:1, timestamp:-999999})
  // convert milli second to distance(?) for chart speed control
  for (let i = 0; i < hiSpeedList.length; i++) {
    const currentHiSpeed = hiSpeedList[i]
    const fromTs = currentHiSpeed.timestamp
    const toTs = i == hiSpeedList.length - 1 ? Infinity : hiSpeedList[i + 1].timestamp
    const hiSpeed = currentHiSpeed.value1
    for (; noteNo < noteListForPlayback.length; noteNo++) {
      const currentNote = noteListForPlayback[noteNo]
      if (currentNote.timestamp > toTs) break;
      currentNote.distance = distanceOffset + Math.round((currentNote.timestamp - fromTs) * hiSpeed);
    }
    hiSpeedTsList.push({
      timestamp: fromTs,
      distance: distanceOffset,
      hiSpeed
    })
    distanceOffset += Math.round((toTs - fromTs) * hiSpeed);
  }

  // sort by distance
  noteListForPlayback = noteListForPlayback.sort((a, b) => a.distance - b.distance)
  for (let i=0; i<noteListForPlayback.length; i++) {
    idOffsetMap[noteListForPlayback[i].id] = i
  }
  
  // fix hold chain
  noteListForPlayback.forEach(i => {
    if (i.noteType === '9' || i.noteType === '25') {
      const holdChain = [i]
      const changePoint = [0]
      let prevOffset = i.laneOffset
      let laneOffsetAdjust = 0
      let acrossMinusHiSpeed = false
      while (i.noteType !== '11') {
        i = noteListForPlayback[idOffsetMap[i.extParam2]]
        /*if (i.extParam1 === 1)*/ changePoint.push(holdChain.length)
        holdChain.push(i)
        if (prevOffset == 59 && i.laneOffset == 0) laneOffsetAdjust += 60
        else if (prevOffset == 0 && i.laneOffset == 59) laneOffsetAdjust -= 60
        prevOffset = i.laneOffset
        i.laneOffset += laneOffsetAdjust
      }
      for (let j = 1; j < holdChain.length - 1; j++) {
        if (holdChain[j].distance > holdChain[j-1].distance && holdChain[j].distance > holdChain[j+1].distance) {
          acrossMinusHiSpeed = true
          break
        }
      }
      for (let j = 0; j < changePoint.length - 1; j++) {
        const startIndex = changePoint[j], endIndex = changePoint[j + 1], segments = endIndex - startIndex
        const startOffset = holdChain[startIndex].laneOffset, startWidth = holdChain[startIndex].noteWidth, startDistance = holdChain[startIndex].distance
        const endOffset = holdChain[endIndex].laneOffset, endWidth = holdChain[endIndex].noteWidth, endDistance = holdChain[endIndex].distance
        for (let k = startIndex + 1; k < endIndex; k++) {
          holdChain[k].laneOffset = (endOffset - startOffset) * (k - startIndex) / segments + startOffset
          holdChain[k].noteWidth = (endWidth - startWidth) * (k - startIndex) / segments + startWidth
          if (acrossMinusHiSpeed) holdChain[k].distance = (endDistance - startDistance) * (k - startIndex) / segments + startDistance
        }
      }

      let distanceMax = 0, distanceMin = Infinity
      let timeStamp = Infinity, timeStampEnd = 0
      const hold = {
        nodes: holdChain.map(i => {
          distanceMax = Math.max(i.distance, distanceMax)
          distanceMin = Math.min(i.distance, distanceMin)
          timeStamp = Math.min(i.timestamp, timeStamp)
          timeStampEnd = Math.max(i.timestamp, timeStampEnd)
          return {
            distance: i.distance,
            timestamp: i.timestamp,
            laneOffset: i.laneOffset,
            noteWidth: i.noteWidth
          }
        }),
        distanceMin,
        distanceMax,
        timeStamp,
        timeStampEnd,
      }
      holdList.push(hold)
    }
  })
  // remove hold node & end from list
  noteListForPlayback = noteListForPlayback.filter(i => i.noteType !== '10')

  // reverse section
  const reverseStartList = controlList.filter(i => i.cmdType === '6')
  const reversePointList = controlList.filter(i => i.cmdType === '7')
  const reverseEndList = controlList.filter(i => i.cmdType === '8')
  for (let i=0; i<reverseStartList.length; i++) {
    reverseSection.push([
      reverseStartList[i].timestamp,
      reversePointList[i].timestamp,
      reverseEndList[i].timestamp,
    ])
  }

  laneToggleList = []
  let laneToggleRawList = noteList.filter(i => (i.noteType === '12' || i.noteType === '13'))
  laneToggleRawList.forEach(i => {
    const value = i.noteType === '12' ? 1 : 0
    const startTime = i.timestamp
    if (i.extParam2 === 2) {
      const width = i.noteWidth / 2
      for (let j=0; j<width; j++) {
        const stepTime = startTime ? startTime + Math.round(j * 1000 / 60 / 2) : 0
        if (value === 1) {
          laneToggleList.push({timestamp: stepTime, value, lane: Math.floor(i.laneOffset + width - 0.5 - j) % 60})
          laneToggleList.push({timestamp: stepTime, value, lane: Math.floor(i.laneOffset + width + j) % 60})
        } else {
          laneToggleList.push({timestamp: stepTime, value, lane: Math.floor(i.laneOffset + j) % 60})
          laneToggleList.push({timestamp: stepTime, value, lane: Math.floor(i.laneOffset + i.noteWidth - 0.5 - j) % 60})
        }
      }
    } else if (i.extParam2 === 0) {
      for (let j=0; j<i.noteWidth; j++) {
        const stepTime = startTime ? startTime + Math.round(j * 1000 / 60 / 2) : 0
        laneToggleList.push({timestamp: stepTime, value, lane: (i.laneOffset + j) % 60})
      }
    } else if (i.extParam2 === 1) {
      for (let j=0; j<i.noteWidth; j++) {
        const stepTime = startTime ? startTime + Math.round(j * 1000 / 60 / 2) : 0
        laneToggleList.push({timestamp: stepTime, value, lane: (i.laneOffset + i.noteWidth - 1 - j) % 60})
      }
    }
  })
  laneToggleList.sort((a,b) => a.timestamp-b.timestamp)

  window.noteTypes = {}
  noteListForPlayback.forEach(i => {
    if (!window.noteTypes[i.noteType]) window.noteTypes[i.noteType] = []
    window.noteTypes[i.noteType].push(i)
  })

  seRTrigger = Object.keys(noteListForPlayback.filter(i=>['20','21','22','23','24','25','26'].indexOf(i.noteType) !== -1).map(i => i.timestamp).reduce((v,i) => (v[Math.round(i)]=1,v), {})).map(i => parseInt(i)).sort((a,b)=>(a-b))
  seTrigger = Object.keys(noteListForPlayback.filter(i=>['1','2','9','11','16'].indexOf(i.noteType) !== -1).map(i => i.timestamp).reduce((v,i) => (v[Math.round(i)]=1,v), {})).map(i => parseInt(i)).sort((a,b)=>(a-b))
  seSwipeTrigger = Object.keys(noteListForPlayback.filter(i=>['3','4','5','6','7','8'].indexOf(i.noteType) !== -1).map(i => i.timestamp).reduce((v,i) => (v[Math.round(i)]=1,v), {})).map(i => parseInt(i)).sort((a,b)=>(a-b))
  seBonusTrigger = Object.keys(noteListForPlayback.filter(i=>['2','6','8'].indexOf(i.noteType) !== -1).map(i => i.timestamp).reduce((v,i) => (v[Math.round(i)]=1,v), {})).map(i => parseInt(i)).sort((a,b)=>(a-b))

  comboInfo = [
    noteListForPlayback.filter(i=>['9','10','12','13','14','25','sectionSep'].indexOf(i.noteType) === -1).length,
    noteListForPlayback.filter(i=>['20','21','22','23','24','25','26'].indexOf(i.noteType) !== -1).length
  ]

  {
    sections = noteListForPlayback.filter(i=>i.noteType === 'sectionSep')
    const start = sections[0].timestamp
    const beats = metList[0].value1
    const duration = sections[1].timestamp - start
    for (let i=0; i<beats; i++) {
      seClockTrigger.push(start + Math.round(duration / beats * i))
    }
  }

  if (bgmFileName !== 'file' && chartHeader.MUSIC_FILE_PATH && chartHeader.MUSIC_FILE_PATH !== bgmFileName) {
    setBgm('Sound/Bgm/output/'+chartHeader.MUSIC_FILE_PATH+'.m4a')
  } else if (bgmFileName === 'file') {
    bgmCtr.duration = chartLength / 1000
  }
}

const drawCount = {
  frame: 0,
  actualFrame: 0,
}
show_ui.addEventListener('input', () => {
  document.body.classList[show_ui.checked ? 'remove' : 'add']('hide-control')
})
toggle_long_audio.addEventListener('input', () => {
  document.body.classList[toggle_long_audio.checked ? 'add' : 'remove']('long-audio')
})
toggle_officials.addEventListener('input', () => {
  document.body.classList[toggle_officials.checked ? 'add' : 'remove']('officials')
})
setInterval(() => {
  if (stats.childNodes.length == 0) stats.appendChild(document.createTextNode(''))
  stats.childNodes[0].nodeValue = [
    `Frame draw: ${drawCount.frame}`,
    `Frame actual draw: ${drawCount.actualFrame}`,
  ].join('\n')
  drawCount.frame = 0
  drawCount.actualFrame = 0
}, 1e3)

let startTs = 0
let startNextFrame = false
let currentTs = 0
let currentDistance = 0;
let playing = false;
let hiSpeed = 1
let hiSpeedOffset = 0
let drawForNextFrame = false
let NOTE_APPEAR_DISTANCE = 1
let NOTE_SPEED_POWER = 1.95
let chartLength = 0
let displayRatio = 1
const laneEffectMul = 1
const laneOnState = new Uint8Array(60 * laneEffectMul)
function mainClock(now) {
  try {
    render(now)
    bgmCtr.timerFunc(now)
  } catch(e) {console.error(e)}
  requestAnimationFrame(mainClock)
}
requestAnimationFrame(mainClock)
function render(now) {
  drawCount.frame++

  if (!hiSpeedTsList.length) return

  if (!playing) {
    if (!drawForNextFrame) {
      return
    }
    drawForNextFrame = false
  }

  drawCount.actualFrame++
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const centerX = canvas.width / 2, centerY = canvas.height / 2

  // outer ring
  ctx.lineWidth = 3
  ctx.strokeStyle = '#000000'
  ctx.beginPath();
  ctx.arc(centerX, centerY, maxR, 0, Math.PI * 2)
  ctx.stroke()
  if (enableBga) {
    ctx.fillStyle = 'rgba(80,80,80,0.4)'
    ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(128,128,128,0.4)'
    ctx.fill()
  }

  // lanes
  const laneGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxR)
  laneGradient.addColorStop(0, 'rgba(128,128,128,0)');
  laneGradient.addColorStop(0.1, 'rgba(128,128,128,0)');
  laneGradient.addColorStop(0.2, 'rgba(128,128,128,0.3)');
  laneGradient.addColorStop(1, 'rgba(128,128,128,0.8)');
  ctx.lineWidth = 1 * displayRatio
  ctx.strokeStyle = laneGradient
  ctx.beginPath();
  for (let i=0; i<30; i++) {
    const degree = Math.PI * i / 30;
    const x1 = centerX + Math.sin(degree) * maxR, y1 = centerY + Math.cos(degree) * maxR
    const x2 = centerX - Math.sin(degree) * maxR, y2 = centerY - Math.cos(degree) * maxR
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
  }
  ctx.stroke()

  let drawDistance = RENDER_DISTANCE
  let previousTs = currentTs
  let reversing = null
  if (playing) {
    if (startNextFrame) {
      startNextFrame = false
      startTs = now - currentTs
      if (chartHeader.OFFSET) {
        const offset = parseFloat(chartHeader.OFFSET)
        if (!isNaN(offset)) {
          startTs += offset * 1000
        }
      }
      updateLaneOnState(-1, currentTs)
    }
    if (!(currentTs >= hiSpeedTsList[hiSpeedOffset].timestamp && (hiSpeedOffset === hiSpeedTsList.length - 1 || currentTs <= hiSpeedTsList[hiSpeedOffset + 1].timestamp))) {
      for (hiSpeedOffset = 0; hiSpeedOffset < hiSpeedTsList.length - 1; hiSpeedOffset++) {
        if (currentTs >= hiSpeedTsList[hiSpeedOffset].timestamp && currentTs <= hiSpeedTsList[hiSpeedOffset + 1].timestamp) {
          break;
        }
      }
      hiSpeed = hiSpeedTsList[hiSpeedOffset].hiSpeed
    }
    currentTs = now - startTs
    let calcBaseTs = Math.max(currentTs, 0)
    for (let i=0; i<reverseSection.length; i++) {
      if (calcBaseTs > reverseSection[i][0] && calcBaseTs < reverseSection[i][1]) {
        reversing = reverseSection[i]
        calcBaseTs = reverseSection[i][1] + (reverseSection[i][1] - calcBaseTs) * (reverseSection[i][2] - reverseSection[i][1]) / (reverseSection[i][1] - reverseSection[i][0])
        drawDistance = Math.min(drawDistance, reverseSection[i][2] - calcBaseTs)
        break
      }
    }
    currentDistance = (calcBaseTs - hiSpeedTsList[hiSpeedOffset].timestamp) * hiSpeed + hiSpeedTsList[hiSpeedOffset].distance
  }

  updateLaneOnState(previousTs, currentTs)
  // black out "off" lanes
  const laneBgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxR)
  laneBgGradient.addColorStop(0, 'rgba(0,0,0,0.3)');
  laneBgGradient.addColorStop(0.2, 'rgba(0,0,0,0.4)');
  laneBgGradient.addColorStop(1, enableBga ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.7)');
  ctx.fillStyle = laneBgGradient
  ctx.beginPath()
  for (let i = 0; i < 60 * laneEffectMul; i++) {
    if (laneOnState[i] == 0) continue
    const start = 60 * laneEffectMul - i - 1, end = 60 * laneEffectMul - i
    ctx.moveTo(centerX, centerY)
    ctx.arc(
      centerX, centerY,
      maxR,
      Math.PI * (start / 30 / laneEffectMul), Math.PI * (end / 30 / laneEffectMul)
    )
    ctx.lineTo(centerX, centerY)
  }
  ctx.fill()
  const notesToRenderArr = getNotesForDraw(currentDistance - drawDistance * 0.1, drawDistance * 1.1).filter(i => i.timestamp > currentTs - 200)
  notesToRender = {
    sectionSep: [],
    touch: [],
    hold: [],
	holdEnd: [],
    holdBody: [],
    chain: [],
    flickL: [],
    flickR: [],
    snapIn: [],
    snapOut: [],
    arrow: [],
    R: [],
    laneEffect: [],
    sameTime: [],
    unknown: []
  };
  notesToRenderArr.forEach(i => {
    switch (i.noteType) {
      case 'sectionSep': {if (i.section) notesToRender.sectionSep.push(i); break;}
      case '1': // touch
      case '2': // bonus touch
      case '20': {notesToRender.touch.push(i); break;} // touch R
      case '3': case '21': {notesToRender.arrow.push(i); notesToRender.snapIn.push(i); break;}
      case '4': case '22': {notesToRender.arrow.push(i); notesToRender.snapOut.push(i); break;}
      case '5': // flick L
      case '6': // flick L with effect
      case '23': {notesToRender.arrow.push(i); notesToRender.flickL.push(i); break;} // flick Left R
      case '7': // flick R
      case '8': // flick R with effect
      case '24': {notesToRender.arrow.push(i); notesToRender.flickR.push(i); break;} // flick Right R
      case '9': case '25': {notesToRender.hold.push(i); break;} // hold start, hold start R
      case '11': {notesToRender.holdEnd.push(i); break;} // hold end
      case '10': {notesToRender.holdBody.push(i); break;} // hold body
      case '12':
      case '13': {notesToRender.laneEffect.push(i); break;}
      case '16': case '26': {notesToRender.chain.push(i); break;}
    }
    if (i.noteType >= '20' && i.noteType <= '26') {
      notesToRender.R.push(i);
    }
    if (i.hasSameTime) {
      notesToRender.sameTime.push(i)
    }
  })

  if (notesToRender.sectionSep.length) {
    const thicc = 0.5 * displayRatio
    ctx.strokeStyle = '#BBB'
    notesToRender.sectionSep.forEach(i => {
      const r = distanceToRenderRadius(maxR, (i.distance - currentDistance) / RENDER_DISTANCE)
      ctx.lineWidth = 10 * thicc
      const scale = r / maxR
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.beginPath()
      ctx.arc(
        0, 0,
        maxR,
        0, Math.PI * 2
      )
      ctx.stroke()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    })
  }
  {
    const drawHoldList = getHoldsForDraw(currentDistance, currentTs, drawDistance);
    //ctx.fillStyle = 'rgba(207,162,93, 0.7)'
    ctx.fillStyle = 'rgba(255,198,73, 0.6)'
    drawHoldList.forEach(nodes => {
      ctx.beginPath()
      const nodeCount = nodes.length
      if (nodes[0].distance < currentDistance) { // clip to outer ring
        let clipDistance = currentDistance
        let clipOffset = (nodes[1].laneOffset - nodes[0].laneOffset) * (clipDistance - nodes[0].distance) / (nodes[1].distance - nodes[0].distance) + nodes[0].laneOffset
        let clipWidth = (nodes[1].noteWidth - nodes[0].noteWidth) * (clipDistance - nodes[0].distance) / (nodes[1].distance - nodes[0].distance) + nodes[0].noteWidth
        nodes[0] = {
          distance: clipDistance,
          laneOffset: clipOffset,
          noteWidth: clipWidth,
        }
      }
      if (nodes[nodeCount - 1].distance > currentDistance+RENDER_DISTANCE) { // clip to center
        let clipDistance = currentDistance+RENDER_DISTANCE
        let clipOffset = (nodes[nodeCount - 1].laneOffset - nodes[nodeCount - 2].laneOffset) * (clipDistance - nodes[nodeCount - 2].distance) / (nodes[nodeCount - 1].distance - nodes[nodeCount - 2].distance) + nodes[nodeCount - 2].laneOffset
        let clipWidth = (nodes[nodeCount - 1].noteWidth - nodes[nodeCount - 2].noteWidth) * (clipDistance - nodes[nodeCount - 2].distance) / (nodes[nodeCount - 1].distance - nodes[nodeCount - 2].distance) + nodes[nodeCount - 2].noteWidth
        nodes[nodeCount - 1] = {
          distance: clipDistance,
          laneOffset: clipOffset,
          noteWidth: clipWidth,
        }
      }
      for (let i=0; i<nodeCount-1; i++) {
        const r = distanceToRenderRadius(maxR, Math.max(nodes[i].distance - currentDistance, 0) / RENDER_DISTANCE)
        const shrinkSize = nodes[i].noteWidth < 60 ? 1 : 0
        const start = 60 - nodes[i].laneOffset - nodes[i].noteWidth + shrinkSize, end = 60 - nodes[i].laneOffset - shrinkSize
        const growSize = (1 - shrinkSize) * 0.25
        if (i === 0) {
          ctx.arc(
            centerX, centerY,
            r,
            Math.PI * ((start - growSize) / 30), Math.PI * ((end + growSize) / 30)
          )
        } else {
          pathToArcPoint(ctx, centerX, centerY, r, Math.PI * ((end + growSize) / 30))
        }
      }
      for (let i=nodeCount-1; i>=0; i--) {
        const r = distanceToRenderRadius(maxR, Math.min(nodes[i].distance - currentDistance, RENDER_DISTANCE) / RENDER_DISTANCE)
		const shrinkSize = nodes[i].noteWidth < 60 ? 1 : 0
        const start = 60 - nodes[i].laneOffset - nodes[i].noteWidth + shrinkSize, end = 60 - nodes[i].laneOffset - shrinkSize
        const growSize = (1 - shrinkSize) * 0.25
        if (i === nodeCount-1) {
          ctx.arc(
            centerX, centerY,
            r,
            Math.PI * ((end + growSize) / 30), Math.PI * ((start - growSize) / 30),
            true
          )
        } else {
          pathToArcPoint(ctx, centerX, centerY, r, Math.PI * ((start - growSize) / 30))
        }
      }
      ctx.closePath()
      ctx.fill()
    })
  }

  // blue extend for same time notes
  {
    const key = 'sameTime', color = 'rgb(0,255,255)'
    const thicc = 4 * displayRatio
    if (notesToRender[key].length) {
      ctx.strokeStyle = color
      notesToRender[key].forEach(i => {
        const r = distanceToRenderRadius(maxR, (i.distance - currentDistance) / RENDER_DISTANCE)
        ctx.lineWidth = 10 * thicc
        const start = 60 - i.laneOffset - i.noteWidth + 0.5, end = 60 - i.laneOffset - 0.5
        const scale = r / maxR
        ctx.translate(centerX, centerY)
        ctx.scale(scale, scale)
        ctx.beginPath()
        ctx.arc(
          0, 0,
          maxR,
          Math.PI * (start / 30), Math.PI * (end / 30)
        )
        ctx.stroke()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      })
    }
  }

  // white border for R notes
  {
    const key = 'R', color = 'rgb(255,255,255)'
    const thicc = 5 * displayRatio
    if (notesToRender[key].length) {
      ctx.strokeStyle = color
      notesToRender[key].forEach(i => {
        const r = distanceToRenderRadius(maxR, (i.distance - currentDistance) / RENDER_DISTANCE)
        ctx.lineWidth = 10 * thicc
		const cutOut = i.noteWidth < 60 ? 0.5 : 0
        const start = 60 - i.laneOffset - i.noteWidth + cutOut, end = 60 - i.laneOffset - cutOut
        const scale = r / maxR
        ctx.translate(centerX, centerY)
        ctx.scale(scale, scale)
        ctx.beginPath()
        ctx.arc(
          0, 0,
          maxR,
          Math.PI * (start / 30), Math.PI * (end / 30)
        )
        ctx.stroke()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      })
    }
  }

  const colorMap = [
    ['hold', 'rgb(100,66,0)'],
	['holdEnd', 'rgba(255,198,73, 0.7)'],
    ['touch', 'rgb(255,9,220)'],
    ['chain', 'rgb(255,225,30)'],
    ['flickL', 'rgb(255,154,0)'],
    ['flickR', 'rgb(57,210,52)'],
    ['snapIn', 'rgb(221,44,44)'],
    ['snapOut', 'rgb(2,107,255)'],
  ]
  colorMap.forEach(noteType => {
    const key = noteType[0], color = noteType[1]
    const thicc = (['flickL','flickR','snapIn','snapOut'].indexOf(key) === -1 ? 2.25 : 2.5) * displayRatio
    if (notesToRender[key].length) {
      notesToRender[key].forEach(i => {
		const r = distanceToRenderRadius(maxR, (i.distance - currentDistance) / RENDER_DISTANCE)
        ctx.lineWidth = 10 * thicc
		const cutOut = (i.noteWidth < 60) ? (key == 'holdEnd' ? 0.5 : 1) : 0
        const start = 60 - i.laneOffset - i.noteWidth + cutOut, end = 60 - i.laneOffset - cutOut
        const scale = r / maxR
		
		// set note color
		ctx.strokeStyle = color

        ctx.translate(centerX, centerY)
        ctx.scale(scale, scale)
        ctx.beginPath()
        ctx.arc(
          0, 0,
          maxR,
          Math.PI * (start / 30), Math.PI * (end / 30)
        )
        ctx.stroke()
        ctx.setTransform(1, 0, 0, 1, 0, 0)

		if(key != 'holdEnd' && i.noteWidth != 60) {
			// set endcap color
			ctx.strokeStyle = 'rgb(78,172,247)'

			// left endcap
			ctx.translate(centerX, centerY)
			ctx.scale(scale, scale)
			ctx.beginPath()
			ctx.arc(
			  0, 0,
			  maxR,
			  Math.PI * (end / 30), Math.PI * ((end + 0.25) / 30)
			)
			ctx.stroke()
			ctx.setTransform(1, 0, 0, 1, 0, 0)

			// right endcap
			ctx.translate(centerX, centerY)
			ctx.scale(scale, scale)
			ctx.beginPath()
			ctx.arc(
			  0, 0,
			  maxR,
			  Math.PI * ((start - 0.25) / 30), Math.PI * (start / 30)
			)
			ctx.stroke()
			ctx.setTransform(1, 0, 0, 1, 0, 0)
		}
      })
    }
  })

  if (notesToRender.arrow.length) {
    const flicks = [
      [],
      [],
    ]
    for (let i=notesToRender.arrow.length-1; i>=0; i--) {
      const a = notesToRender.arrow[i]
      if (['5','6','23'].indexOf(a.noteType) !== -1) {
        flicks[0].push(a)
        continue
      } else if (['7','8','24'].indexOf(a.noteType) !== -1) {
        flicks[1].push(a)
        continue
      }
      const r = distanceToRenderRadius(maxR, (a.distance - currentDistance) / RENDER_DISTANCE)
      const start = 60 - a.laneOffset - a.noteWidth + 1, end = 60 - a.laneOffset - 1
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(
        centerX, centerY,
        r,
        Math.PI * (start / 30), Math.PI * (end / 30)
      )
      ctx.moveTo(centerX, centerY)
      ctx.clip()
      switch (a.noteType) {
        case '3': case '21': {
          ctx.drawImage(arrowCanvas.in, centerX-r, centerY-r, r*2, r*2)
          break
        }
        case '4': case '22': {
          ctx.drawImage(arrowCanvas.out, centerX-r, centerY-r, r*2, r*2)
          break
        }
        case '5': case '6': case '23': {
          ctx.drawImage(arrowCanvas.leftRotation, centerX-r, centerY-r, r*2, r*2)
          break
        }
        case '7': case '8': case '24': {
          ctx.drawImage(arrowCanvas.rightRotation, centerX-r, centerY-r, r*2, r*2)
          break
        }
      }
      ctx.restore()
    }
    const arrowParam = [
      [0.00, 0.05, 0.80, 0.90, 0.95, 1.00],
      [0.30, 0.35, 1.00, 0.90, 0.50, 0.30],
      [0.00, 0.50, 0.80, 0.30, 0.00, 0.00],
    ]
    const arrowTipParam = [
      [0.00, 0.05, 0.90, 0.98, 1.00],
      [0.30, 0.35, 1.00, 0.30, 0.00],
      [0.00, 0.50, 0.90, 0.30, 0.00],
    ]
    const rotateSpeed = 8
    const nodes = []
    for (let i=0; i<2; i++) {
      const arrowAngleDirection = [-0.4, 0.4][i]
      const color = ['rgb(255,154,0)', 'rgb(57,210,52)'][i]
      flicks[i].forEach(a => {
        const r = distanceToRenderRadius(maxR*0.95, (a.distance - currentDistance) / RENDER_DISTANCE)
        const start = 60 - a.laneOffset - a.noteWidth + 1, end = 60 - a.laneOffset - 1
        const rPos = 1 - (a.distance - currentDistance) / RENDER_DISTANCE
        const rotateOffset = ((rPos * rotateSpeed) * [1, -1][i] + 2) % 2
        const flickNodes = {n:[], r:r, c: color}
        for (let angle = start + rotateOffset; angle < end; angle+=2) {
          const sharpness = (angle - start) / (end - start) + 0.5
          const coordBase = [
            angle + 0.2 + arrowAngleDirection * (i ? 2 - sharpness : sharpness),
            angle + 0.2 - arrowAngleDirection * (i ? 2 - sharpness : sharpness),
            angle + 0.2 + arrowAngleDirection * (i ? 2 - sharpness : sharpness),
          ]
          const subNodes = {n:[], w:0}
          for (let j=0; j<3; j++) {
            const useParam = [arrowParam, arrowTipParam, arrowParam][j]
            let pos = (coordBase[j] - start) / (end - start)
            if (i) pos = 1 - pos
            let h = useParam[1][0], w = useParam[2][0]
            for (let k=0; k<useParam[0].length; k++) {
              if (k === useParam[0].length - 1) {
                h = useParam[1][k]
                w = useParam[2][k]
                break
              }
              if (pos >= useParam[0][k] && pos < useParam[0][k + 1]) {
                h = useParam[1][k] + (useParam[1][k+1] - useParam[1][k]) * ((pos - useParam[0][k]) / (useParam[0][k+1] - useParam[0][k]))
                w = useParam[2][k] + (useParam[2][k+1] - useParam[2][k]) * ((pos - useParam[0][k]) / (useParam[0][k+1] - useParam[0][k]))
                break
              }
            }
            w *= 0.8 * rPos
            subNodes.n.unshift([h * [-1, 0, 1][j], (coordBase[j] - w) * Math.PI / 30])
            subNodes.n.push   ([h * [-1, 0, 1][j], (coordBase[j] + w) * Math.PI / 30])
            if (j == 1) subNodes.w = w
          }
          flickNodes.n.push(subNodes)
        }
        nodes.push(flickNodes)
      })
    }
    ctx.strokeStyle = 'rgb(200,200,200)'
    nodes.sort((a,b) => a.r - b.r)
    nodes.forEach(i => {
      //ctx.clearRect(0, 0, canvas.width, canvas.height)
      const scale = i.r / maxR
      ctx.fillStyle = i.c
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      i.n.forEach(i => {
        ctx.lineWidth = i.w / 0.8 * 4 * displayRatio
        ctx.beginPath()
        i.n.forEach(i => {
          pathToArcPoint(ctx, 0, 0, maxR * (0.875 + 0.075 * i[0]), i[1])
        })
        ctx.closePath()
        ctx.fill()
        if (i.w > 0) ctx.stroke()
      })
      ctx.setTransform(1, 0, 0, 1, 0, 0)

      //const r = i.r
      //ctx.drawImage(arrowCanvas.flick, 0, 0)
    })
  }

  {
    let chartProgress = 0
    if (chartLength) {
      chartProgress = Math.max(0, currentTs / chartLength)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    const r = maxR * 0.98
    ctx.lineWidth = (r * 5 / maxR + 2) * displayRatio
    ctx.beginPath()
    ctx.arc(
      centerX, centerY,
      r,
      -Math.PI * (0.5 + chartProgress * 2), Math.PI * -0.5
    )
    ctx.stroke()
  }

  // circle mask
  {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxR, 0, Math.PI * 2)
    ctx.fillStyle = 'white'
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  if (bpmList.length && metList.length) {
    const chkTs = Math.round(Math.max(0, currentTs))
    const bpmItem = (bpmList.filter(v => v.timestamp <= chkTs).slice(-1)[0])
    const bpm = bpmItem.value1
    const met = (metList.filter(v => v.timestamp <= chkTs).slice(-1)[0])
    const refBase = bpmItem.timestamp > met.timestamp ? bpmItem : met
    const beatDuration = 60000 / bpm * 4 / (met.value2 || 4)
    const playedNotesCount = [
      0,
      0
    ]
    for (let i=0; i<noteListForPlayback.length; i++) {
      if (noteListForPlayback[i].timestamp > chkTs) break
      playedNotesCount[0] += ['9','10','12','13','14','25','sectionSep'].indexOf(noteListForPlayback[i].noteType) === -1
      playedNotesCount[1] += ['20','21','22','23','24','25','26'].indexOf(noteListForPlayback[i].noteType) !== -1
    }
    const playInfoStat = {
      min: ''+Math.floor(chkTs / 60000),
      sec: ('0'+(Math.floor(chkTs / 1000) % 60)).slice(-2),
      milisec: ('000'+(chkTs % 1000)).slice(-3),
      section: ('000'+Math.floor((chkTs - refBase.timestamp) / beatDuration / met.value1 + refBase.section)).slice(-3),
      beat: Math.floor((chkTs - refBase.timestamp) / beatDuration + refBase.tick / (TICK_PER_GAME_SECTION / met.value1)) % met.value1,
      bpm,
      hiSpeed
    }
    const playInfoText = [
      `${playedNotesCount[0]} (${playedNotesCount[1]}) / ${comboInfo[0]} (${comboInfo[1]})`,
      `${playInfoStat.min}:${playInfoStat.sec}.${playInfoStat.milisec} (${playInfoStat.section}/${playInfoStat.beat})`,
      `BPM: ${playInfoStat.bpm.toFixed(1)}`,
      `HS: ${playInfoStat.hiSpeed}` + (reversing ? ' (Reversing)' : ''),
      ``,
      `v${mpVersion}`
    ]
    const fontSize = 16 * devicePixelRatio
    ctx.font = `${fontSize}px Arial`
    ctx.fillStyle = 'white'
    for (let i=0; i<playInfoText.length; i++) {
      ctx.fillText(playInfoText[i], centerX - maxR, centerY - maxR + 10 + fontSize * i)
    }
  }

  {
    while (pendingSeTrigger.length && pendingSeTrigger[0] - currentTs < 100) {
      if (!seBuffer && !clkBuffer) break
      if (pendingSeTrigger[0] - currentTs > -25) {
        let bufSrc = seContext.createBufferSource()
        bufSrc.buffer = seBuffer
        bufSrc.connect(gain)
        bufSrc.start(seContext.currentTime + Math.max(0, pendingSeTrigger[0] - currentTs) / 1000)
      }
      pendingSeTrigger.shift()
    }
    while (pendingSeRTrigger.length && pendingSeRTrigger[0] - currentTs < 100) {
      if (!seRBuffer) break
      if (pendingSeRTrigger[0] - currentTs > -25) {
        let bufSrc = seContext.createBufferSource()
        bufSrc.buffer = seRBuffer
        bufSrc.connect(gain)
        bufSrc.start(seContext.currentTime + Math.max(0, pendingSeRTrigger[0] - currentTs) / 1000)
      }
      pendingSeRTrigger.shift()
    }
    while (pendingSeSwipeTrigger.length && pendingSeSwipeTrigger[0] - currentTs < 100) {
      if (!seSwipeBuffer) break
      if (pendingSeSwipeTrigger[0] - currentTs > -25) {
        let bufSrc = seContext.createBufferSource()
        bufSrc.buffer = seSwipeBuffer
        bufSrc.connect(gain)
        bufSrc.start(seContext.currentTime + Math.max(0, pendingSeSwipeTrigger[0] - currentTs) / 1000)
      }
      pendingSeSwipeTrigger.shift()
    }
    while (pendingSeBonusTrigger.length && pendingSeBonusTrigger[0] - currentTs < 100) {
      if (!seBonusBuffer) break
      if (pendingSeBonusTrigger[0] - currentTs > -25) {
        let bufSrc = seContext.createBufferSource()
        bufSrc.buffer = seBonusBuffer
        bufSrc.connect(gain)
        bufSrc.start(seContext.currentTime + Math.max(0, pendingSeBonusTrigger[0] - currentTs) / 1000)
      }
      pendingSeBonusTrigger.shift()
    }
    while (pendingSeClockTrigger.length && pendingSeClockTrigger[0] - currentTs < 100) {
      if (!seBuffer && !clkBuffer) break
      if (pendingSeClockTrigger[0] - currentTs > -25) {
        let bufSrc = seContext.createBufferSource()
        bufSrc.buffer = clkBuffer != null ? clkBuffer : seBuffer
        bufSrc.connect(gain)
        bufSrc.start(seContext.currentTime + Math.max(0, pendingSeClockTrigger[0] - currentTs) / 1000)
      }
      pendingSeClockTrigger.shift()
    }
  }
}
let globalPlaybackOffset = 0
// if (/win32/i.test(navigator.platform) && /firefox/i.test(navigator.userAgent)) globalPlaybackOffset = -60
let CALC_CONE_HEIGHT = 6
let CALC_CONE_RADIUS = 2
function distanceToRenderRadius (maxR, distance) {
  let h = distance * CALC_CONE_HEIGHT + CALC_CONE_RADIUS
  let a = (1 - distance) * CALC_CONE_RADIUS
  let angle = Math.atan(h / a) * 2 / Math.PI
  return maxR * (1 - angle) * 2
}
let bgmBufSrc = null
window.play = function () {
  startNextFrame = true
  if (bgmBuffer != null && bgmBufSrc == null) {
    bgmBufSrc = seContext.createBufferSource()
    bgmBufSrc.buffer = bgmBuffer
    bgmBufSrc.connect(bgmGain)
    bgmBufSrc.start(0, bgmCtr.currentTime)
  }
  currentTs = Math.round(bgmCtr.currentTime * 1000) + globalPlaybackOffset
  bgmCtr.play()
  if (enableBga) bga.play()
  bga.muted = true
  playing = true
  pendingSeTrigger = seTrigger.filter(i => i > currentTs)
  pendingSeRTrigger = seRTrigger.filter(i => i > currentTs)
  pendingSeSwipeTrigger = seSwipeTrigger.filter(i => i > currentTs)
  pendingSeBonusTrigger = seBonusTrigger.filter(i => i > currentTs)
  pendingSeClockTrigger = seClockTrigger.filter(i => i > currentTs - 1) // - 1 required to allow a click on ts 0
  seContext.resume()
  gain.gain.value = (se_volume.value / 2) / 100
}
window.pause = function () {
  if (bgmBufSrc != null) {
    bgmBufSrc.stop()
    bgmBufSrc = null
  }
  bgmCtr.pause()
  if (enableBga) bga.pause()
  playing = false
  gain.gain.value = 0
}
window.stop = function () {
  pause()
  currentDistance = 0
  currentTs = 0
  bgmCtr.currentTime = 0
  if (enableBga) bga.currentTime = 0
  drawForNextFrame = true
  hiSpeedOffset = 0
  hiSpeed = 1
}
window.setPlaybackTime = function (time = 0) {
  currentTs = Math.round(time * 1000)
  bgmCtr.currentTime = time
}
requestAnimationFrame(render)
function getNotesForDraw(currentDistance, renderDistance = RENDER_DISTANCE) {
  if (!noteListForPlayback.length) return []
  if (currentDistance > noteListForPlayback[noteListForPlayback.length - 1].distance) return []
  //return []
  // search sub array start
  let startOffset, endOffset
  {
    let head = 0, tail = noteListForPlayback.length - 1
    let mid
    while (head <= tail) {
      mid = Math.floor((head + tail) / 2)
      const result = currentDistance - noteListForPlayback[mid].distance
      if (result === 0) break;
      if (result < 0) tail = mid - 1;
      if (result > 0) head = mid + 1;
    }
    startOffset = mid
    while (startOffset > 0 && noteListForPlayback[startOffset].distance >= currentDistance) startOffset--;
  }
  // search sub array end
  {
    let head = 0, tail = noteListForPlayback.length - 1
    let mid
    while (head <= tail) {
      mid = Math.floor((head + tail) / 2)
      const result = (currentDistance + renderDistance) - noteListForPlayback[mid].distance
      if (result === 0) break;
      if (result < 0) tail = mid - 1;
      if (result > 0) head = mid + 1;
    }
    endOffset = mid
    while (endOffset < noteListForPlayback.length && noteListForPlayback[endOffset].distance <= currentDistance + renderDistance) endOffset++;
  }
  return noteListForPlayback
  .slice(Math.max(0, startOffset), Math.min(noteListForPlayback.length, endOffset))
  .filter(i => i.distance > currentDistance && i.distance < currentDistance + renderDistance)
}
window.getNotesForDraw = getNotesForDraw;
function getHoldsForDraw(currentDistance, currentTs, renderDistance = RENDER_DISTANCE) {
  const filteredHoldList = holdList.filter(i => (
    (i.distanceMax > currentDistance || i.distanceMin < currentDistance + renderDistance) && i.timeStampEnd > currentTs
  ))
  const drawHoldList = []
  filteredHoldList.forEach(hold => {
    let offset = 0
    let head = 0, tail = 1
    const nodeCount = hold.nodes.length
    while (offset < nodeCount) {
      if (hold.nodes[offset].distance < currentDistance) { // after leave, set head to last one before leaving current render
        head = offset
      } else if (hold.nodes[offset].distance > currentDistance + renderDistance) { // before enter, set tail to first one before enter render
        tail = offset
        if (tail-head > 0) drawHoldList.push(hold.nodes.slice(head, tail + 1))
        head = offset + 1
        tail = offset + 2
      } else if (offset === nodeCount - 1) { // last one in chain
        tail = offset
        if (tail-head > 0) drawHoldList.push(hold.nodes.slice(head, tail + 1))
      } else if (offset > 0 && offset < nodeCount - 1) { // not first or last one in chain, if change render direction (due to note speed chages), break render chain
        if (hold.nodes[offset].distance > hold.nodes[offset - 1].distance && hold.nodes[offset].distance > hold.nodes[offset + 1].distance) {
          tail = offset
          if (tail-head > 0) drawHoldList.push(hold.nodes.slice(head, tail + 1))
          head = offset
        } else if (hold.nodes[offset].distance < hold.nodes[offset - 1].distance && hold.nodes[offset].distance < hold.nodes[offset + 1].distance) {
          tail = offset
          if (tail-head > 0) drawHoldList.push(hold.nodes.slice(head, tail + 1))
          head = offset
        }
      }
      offset++
    }
  })
  return drawHoldList.filter(i => (
    i[i.length - 1].timestamp > currentTs
  ))
}

const pendingLaneChange = []
//const transitionLength = 80
let laneChangeIdx = 0
function updateLaneOnState(fromTs, toTs) {
  if (!laneToggleList.length) return
  if (fromTs === -1) {
    pendingLaneChange.splice(0, pendingLaneChange.length)
    for (let i=0; i<60 * laneEffectMul; i++) {
      laneOnState[i] = 0
    }
    laneChangeIdx = 0
  }
  while (laneChangeIdx < laneToggleList.length) {
    let i = laneToggleList[laneChangeIdx]
    if (i.timestamp > toTs) break
    laneOnState[i.lane] = i.value
    laneChangeIdx++
  }
}

speed_input.addEventListener('input', e => {
  const speed = speed_input.value / 10.0
  speed_val.textContent = speed
  RENDER_DISTANCE = 3000 / speed
  drawForNextFrame = true
  window.settings.scrollSpeed = speed
  saveSettings()
})
speed_input.value = window.settings.scrollSpeed * 10
speed_input.dispatchEvent(new Event('input'))

function resize() {
  const size = Math.min(window.innerWidth, window.innerHeight)
  canvas.width = canvas.height = size * devicePixelRatio
  //const cabView = (canvas.width == 1080 && canvas.height == 1920)
  //maxR = cabView ? 530 : Math.round(Math.min(w, h) * 0.45)
  maxR = Math.round(size * devicePixelRatio * 0.45)
  drawForNextFrame = true
  displayRatio = 1
  const centerX = size / 2, centerY = size / 2
  const rView = Math.round(size * 0.45)

  if (enableBga) {
    bga.style.left = (centerX - rView) + 'px'
    bga.style.top = (centerY - rView) + 'px'
    bga.style.width = (rView * 2) + 'px'
    bga.style.height = (rView * 2) + 'px'
    bga.style.display = 'block'
  } else {
    bga.style.display = 'none'
  }
  
  play_info.style.left = (centerX - rView) + 'px'
  play_info.style.top = (centerY - rView) + 'px'

  createArrows()
}
window.addEventListener('resize', resize)
resize();

let gain = seContext.createGain()
gain.connect(seContext.destination);
let bgmGain = seContext.createGain()
bgmGain.connect(seContext.destination)
for (let i=0; i<11; i++) {
  let option = document.createElement('option')
  option.setAttribute('value', i * 10)
  option.textContent = i * 10
  se_volume.appendChild(option)
}

se_volume.addEventListener('change', () => {
  gain.gain.value = (se_volume.value / 2) / 100
  window.settings.seVolume = se_volume.value
  saveSettings()
})
se_volume.value = window.settings.seVolume
se_volume.dispatchEvent(new Event('change'))

function se_file_load() {
  const reader = new FileReader()
  reader.readAsArrayBuffer(se_file.files[0])
  reader.onload = e => {
    seContext.decodeAudioData(reader.result, buf => {
      if (buf) {
        seBuffer = seRBuffer = seSwipeBuffer = seBonusBuffer = clkBuffer = buf
      } else {
        console.error('decode failed')
      }
    }, e => console.error(e))
  }
}

se_file.addEventListener('change', se_file_load)

class BgmController {
  __playSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"context-fill\" fill-opacity=\"context-fill-opacity\"><path d=\"m2.992 13.498 0-10.996a1.5 1.5 0 0 1 2.245-1.303l9.621 5.498a1.5 1.5 0 0 1 0 2.605L5.237 14.8a1.5 1.5 0 0 1-2.245-1.302z\"/></svg>"
  __pauseSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"context-fill\" fill-opacity=\"context-fill-opacity\"><path d=\"m4.5 14-1 0A1.5 1.5 0 0 1 2 12.5l0-9A1.5 1.5 0 0 1 3.5 2l1 0A1.5 1.5 0 0 1 6 3.5l0 9A1.5 1.5 0 0 1 4.5 14z\"/><path d=\"m11.5 14-1 0A1.5 1.5 0 0 1 9 12.5l0-9A1.5 1.5 0 0 1 10.5 2l1 0A1.5 1.5 0 0 1 13 3.5l0 9a1.5 1.5 0 0 1-1.5 1.5z\"/></svg>"
  __volumeSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"context-fill\" fill-opacity=\"context-fill-opacity\"><path d=\"M7.245 1.35 4.117 5 2 5a2 2 0 0 0-2 2l0 2a2 2 0 0 0 2 2l2.117 0 3.128 3.65C7.848 15.353 9 14.927 9 14L9 2c0-.927-1.152-1.353-1.755-.65z\"/><path d=\"M11.764 15a.623.623 0 0 1-.32-1.162 6.783 6.783 0 0 0 3.306-5.805 6.767 6.767 0 0 0-3.409-5.864.624.624 0 1 1 .619-1.085A8.015 8.015 0 0 1 16 8.033a8.038 8.038 0 0 1-3.918 6.879c-.1.06-.21.088-.318.088z\"/><path d=\"M11.434 11.85A4.982 4.982 0 0 0 13.25 8a4.982 4.982 0 0 0-1.819-3.852l-.431 0 0 7.702.434 0z\"/></svg>"
  __volumeMutedSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"context-fill\" fill-opacity=\"context-fill-opacity\"><path d=\"m11 4.149 0 4.181 1.775 1.775c.3-.641.475-1.35.475-2.105a4.981 4.981 0 0 0-1.818-3.851l-.432 0z\"/><path d=\"M2.067 1.183a.626.626 0 0 0-.885.885L4.115 5 2 5a2 2 0 0 0-2 2l0 2a2 2 0 0 0 2 2l2.117 0 3.128 3.65C7.848 15.353 9 14.927 9 14l0-4.116 3.317 3.317c-.273.232-.56.45-.873.636a.624.624 0 0 0-.218.856.621.621 0 0 0 .856.219 7.58 7.58 0 0 0 1.122-.823l.729.729a.626.626 0 0 0 .884-.886L2.067 1.183z\"/><path d=\"M9 2c0-.926-1.152-1.352-1.755-.649L5.757 3.087 9 6.33 9 2z\"/><path d=\"M11.341 2.169a6.767 6.767 0 0 1 3.409 5.864 6.732 6.732 0 0 1-.83 3.217l.912.912A7.992 7.992 0 0 0 16 8.033a8.018 8.018 0 0 0-4.04-6.95.625.625 0 0 0-.619 1.086z\"/></svg>"

  _element = null
  _playBtn = null
  _progressInput = null
  _playedText = null
  _durationText = null
  _volumeBtn = null
  _volumeInput = null
  _currentTime = 0
  _duration = 0
  _playing = false
  _volume = 1
  _muted = false
  _pendingSeek = false

  /**
   * @param {HTMLElement} e
   */
  constructor(e) {
    this._element = e
    // while (e.childNodes.length) e.childNodes[0].remove()
    e.innerHTML = '<div class="btn no-hide"></div><div class="progress no-hide"><input type="range" step="any" min="0" max="1" value="0"/></div><div class="duration no-hide"><span class="played">0:00</span><span class="duration-grey"> / <span class="total">0:00</span></span></div><div class="volume no-hide"></div><div class="volume_slider no-hide"><input type="range" step="any" min="0" max="1" value="1"/></div>'
    this._playBtn = e.getElementsByClassName('btn')[0]
    this._progressInput = e.getElementsByClassName('progress')[0].children[0]
    this._playedText = e.getElementsByClassName('played')[0].childNodes[0]
    this._durationText = e.getElementsByClassName('total')[0].childNodes[0]
    this._volumeBtn = e.getElementsByClassName('volume')[0]
    this._volumeInput = e.getElementsByClassName('volume_slider')[0].children[0]

    this.setPlayBtn(false)
    this.setVolumeBtn(false)

    this.setListeners()
  }

  setPlayBtn(isPause) {
    if (isPause) {
      this._playBtn.innerHTML = this.__pauseSvg
    } else {
      this._playBtn.innerHTML = this.__playSvg
    }
  }
  setVolumeBtn(isMute) {
    if (isMute) {
      this._volumeBtn.innerHTML = this.__volumeMutedSvg
    } else {
      this._volumeBtn.innerHTML = this.__volumeSvg
    }
  }

  play() {
    if (this._playing) return
    if (this._currentTime >= this._duration) {
      this._currentTime = 0
    }
    this._playing = true
    this.setPlayBtn(this._playing)
    this.dispatchEvent('play')
  }
  pause() {
    if (!this._playing) return
    this._playing = false
    this.setPlayBtn(this._playing)
    this.dispatchEvent('pause')
  }
  get volume() {
    if (this._muted) return 0
    return this._volume
  }
  /**
   * @param {number} v
   */
  set volume(v) {
    if (typeof v !== 'number' || isNaN(v)) return
    v = Math.max(0, v)
    v = Math.min(1, v)
    this.dispatchEvent('volumeChange', v)
    this._volumeInput.value = v
    if (v === 0) {
      this._muted = true
      this.setVolumeBtn(this._muted)
    } else {
      this._muted = false
      this._volume = v
      this.setVolumeBtn(this._muted)
      this.dispatchEvent('volumeChange', this._volume)
    }
  }
  get duration() {
    return this._duration
  }
  set duration(v) {
    this._duration = Math.max(v, 0)
    this.updateTotalTime(this._duration)
  }
  get currentTime() {
    return this._currentTime
  }
  set currentTime(v) {
    this._currentTime = Math.min(v, this._duration)
    this.updateCurrentTime(this._currentTime)
  }

  _lastNow = null
  timerFunc(now) {
    const elapsed = now - this._lastNow
    this._lastNow = now
    if (!this._playing) return
    if (this._duration <= 0) return
    this._currentTime += elapsed / 1000
    if (this._currentTime >= this._duration) {
      this._currentTime = this._duration
      this.pause()
    }
    if (!this._pendingSeek) {
      this.updateCurrentTime(this._currentTime)
    }
  }
  _timerFuncBound = null

  setListeners() {
    this._playBtn.addEventListener('click', this.playBtnClick.bind(this))
    this._volumeBtn.addEventListener('click', this.volumeBtnClick.bind(this))
    this._progressInput.addEventListener('input', this.progressInput.bind(this))
    this._progressInput.addEventListener('change', this.progressChange.bind(this))
    this._volumeInput.addEventListener('input', this.volumeInput.bind(this))
    this._volumeInput.addEventListener('change', this.volumeChange.bind(this))

    this._lastNow = performance.now()
  }
  playBtnClick(e) {
    if (this._playing) { // pause
      this.pause()
    } else { // play
      this.play()
    }
  }
  volumeBtnClick(e) {
    if (this._muted) { // unmute
      this.volume = this._volume
    } else { // mute
      this.volume = 0
    }
  }
  progressInput(e) {
    if (this._duration <= 0) {
      e.target.value = 0
      return
    }
    this._pendingSeek = true
    this.updateCurrentTime(e.target.value * this._duration)
  }
  progressChange(e) {
    if (this._duration <= 0) {
      e.target.value = 0
      return
    }
    this._pendingSeek = false
    this._currentTime = e.target.value * this._duration
    this.updateCurrentTime(this._currentTime)
    this.dispatchEvent('seeked', this._currentTime)
  }
  _lastChangeVolume = 1
  volumeInput(e) {
    this.volume = parseFloat(this._volumeInput.value)
  }
  volumeChange(e) {
    const v = parseFloat(this._volumeInput.value)
    this.volume = this._lastChangeVolume
    this.volume = v
    if (v > 0) {
      this._lastChangeVolume = v
    }
  }
  formatTime(sec) {
    const m = Math.floor(sec / 60)
    const s = ('0'+Math.floor(sec % 60)).slice(-2)
    return m+':'+s
  }
  updateCurrentTime(sec) {
    this._playedText.nodeValue = this.formatTime(sec)
    if (this._duration > 0) {
      this._progressInput.value = sec / this._duration
    }
  }
  updateTotalTime(dur) {
    this._durationText.nodeValue = this.formatTime(dur)
  }

  eventListeners = {
    play: [],
    pause: [],
    volumeChange: [],
    seeked: [],
  }
  dispatchEvent(eventName, data) {
    this.eventListeners[eventName].forEach(i => i(data))
  }
  addEventListener(eventName, listener) {
    if (this.eventListeners[eventName] === undefined) {
      throw new Error('Unsupported event ' + eventName)
    }
    this.eventListeners[eventName].push(listener)
  }
}
const bgmCtr = new BgmController(bgm_custom)

bgmCtr.addEventListener('seeked', function (e) {
  currentTs = Math.round(bgmCtr.currentTime * 1000)
  if (enableBga) bga.currentTime = bgmCtr.currentTime
  pause()
  if (bgmCtr.currentTime < bgmCtr.duration) play()
})
bgmCtr.addEventListener('pause', pause)
bgmCtr.addEventListener('play', play)
bgmCtr.addEventListener('volumeChange', v => {
  bgmGain.gain.value = v
  window.settings.musicVolume = v
  saveSettings()
})

bgmCtr.volume = window.settings.musicVolume

document.title += ` v${mpVersion}`
document.body.classList[remoteRun ? 'add' : 'remove']('remote')

function loadSettings() {
  oldSettings = JSON.parse(localStorage.getItem('settings'));
  if(oldSettings) window.settings = oldSettings
  else {
    window.settings = {
      musicVolume: 1.0,
      seVolume: 100,
      scrollSpeed: 3.8
    }

    localStorage.setItem('settings', JSON.stringify(window.settings))
  }
}

function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(window.settings))
}
