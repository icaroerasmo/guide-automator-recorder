import domEvents from './dom-events-to-record'
import pptrActions from './pptr-actions'
import Block from './Block'

export const frameId = 0;

export const defaults = {
  wrapAsync: true,
  headless: true,
  waitForNavigation: true,
  waitForSelectorOnClick: true,
  blankLinesBetweenBlocks: true,
  dataAttribute: ''
}

export default class GACodeGenerator {
  constructor (options) {
    this._options = Object.assign(defaults, options)
    this._blocks = []
    this._frame = 'page'
    this._frameId = 0
    this._allFrames = {}
    this._screenshotCounter = 1

    this._hasNavigation = false
  }

  generate (events) {
    return this._parseEvents(events);
  }

  _parseEvents (events) {
    
    // we need to keep a handle on what frames events originate from
    this._setFrames(frameId);

    console.debug(`generating code for ${events ? events.length : 0} events`)
    let result = ''

    if (!events) return result

    for (let i = 0; i < events.length; i++) {
      const { action, selector, value, href } = events[i];
      switch (action) {
        case 'click':
          this._blocks.push(this._handleClick(selector, events))
          break
        case pptrActions.GOTO:
          this._blocks.push(this._handleGoto(href, frameId))
          break
        case pptrActions.SCREENSHOT:
          this._blocks.push(this._handleScreenshot(value))
          break
      }
    }

    console.debug('post processing blocks:', this._blocks)
    this._postProcess()

    const indent = this._options.wrapAsync ? '  ' : ''
    const newLine = `\n`

    for (let block of this._blocks) {
      const lines = block.getLines()
      for (let line of lines) {
        result += indent + line.value + newLine
      }
    }

    return result
  }

  _postProcess () {
    // when events are recorded from different frames, we want to add a frame setter near the code that uses that frame
    if (Object.keys(this._allFrames).length > 0) {
      this._postProcessSetFrames()
    }

    if (this._options.blankLinesBetweenBlocks && this._blocks.length > 0) {
      this._postProcessAddBlankLines()
    }
  }

  _handleKeyDown (selector, value) {
    const block = new Block(this._frameId)
    block.addLine({ type: domEvents.KEYDOWN, value: `await ${this._frame}.type('${selector}', '${value}')` });
    return block
  }

  _handleClick (selector) {
    return new Block(this._frameId, { type: domEvents.CLICK, value: `click '${selector}'` });
  }
  _handleChange (selector, value) {
    return new Block(this._frameId, { type: domEvents.CHANGE, value: `await ${this._frame}.select('${selector}', '${value}')` })
  }
  _handleGoto (href) {
    return new Block(this._frameId, { type: pptrActions.GOTO, value: `go-to-page '${href}'` })
  }

  _handleScreenshot (options) {
    let block

    if (options && options.x && options.y && options.width && options.height) {
      // remove the tailing 'px'
      for (let prop in options) {
        if (options.hasOwnProperty(prop) && options[prop].slice(-2) === 'px') {
          options[prop] = options[prop].substring(0, options[prop].length - 2)
        }
      }

      block = new Block(this._frameId, {
        type: pptrActions.SCREENSHOT,
        value: `screenshot` })
    } else {
      block = new Block(this._frameId, { type: pptrActions.SCREENSHOT, value: `screenshot` })
    }

    this._screenshotCounter++
    return block
  }

  _handleWaitForNavigation () {
    const block = new Block(this._frameId)
    if (this._options.waitForNavigation) {
      block.addLine({type: pptrActions.NAVIGATION, value: `await navigationPromise`})
    }
    return block
  }

  _postProcessSetFrames () {
    for (let [i, block] of this._blocks.entries()) {
      const lines = block.getLines()
      for (let line of lines) {
        if (line.frameId && Object.keys(this._allFrames).includes(line.frameId.toString())) {
          const declaration = `const frame_${line.frameId} = frames.find(f => f.url() === '${this._allFrames[line.frameId]}')`
          this._blocks[i].addLineToTop(({ type: pptrActions.FRAME_SET, value: declaration }))
          this._blocks[i].addLineToTop({ type: pptrActions.FRAME_SET, value: 'let frames = await page.frames()' })
          delete this._allFrames[line.frameId]
          break
        }
      }
    }
  }

  _postProcessAddBlankLines () {
    let i = 0
    while (i <= this._blocks.length) {
      const blankLine = new Block()
      blankLine.addLine({ type: null, value: '' })
      this._blocks.splice(i, 0, blankLine)
      i += 2
    }
  }

  _setFrames (frameId) {
      this._frameId = frameId;
      this._frame = 'page';
  }
}
