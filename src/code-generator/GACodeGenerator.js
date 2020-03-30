import domEvents from './dom-events-to-record'
import pptrActions from './pptr-actions'
import Block from './Block'

export const defaults = {
  wrapAsync: true,
  headless: true,
  waitForNavigation: true,
  waitForSelectorOnClick: true,
  blankLinesBetweenBlocks: false,
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
    this.selectorsVals = {};

    this._hasNavigation = false
  }
  generate (events) {
    return this._parseEvents(events);
  }
  _parseEvents (events) {

    console.debug(`generating code for ${events ? events.length : 0} events`)
    let result = ''

    if (!events) return result

    for (let i = 0; i < events.length; i++) {
      const { action, selector, value, href, keyCode, tagName, frameId, frameUrl } = events[i]

      // we need to keep a handle on what frames events originate from
      this._setFrames(frameId, frameUrl)

      switch (action) {
        case 'keydown':
          const block = this._handleKeyDown(selector, value, keyCode);
          const previousBlock = this._blocks[this._blocks.length-1].getLines()[0];
          if(this._blocks.length > 0 &&
            previousBlock.type === domEvents.KEYDOWN &&
            previousBlock.value.includes(selector)){
            this._blocks[this._blocks.length-1] = block;
          } else {
            this._blocks.push(block);
          }
          break;
        case 'click':
          this._blocks.push(this._handleClick(selector, events))
          break;
        case 'change':
          if (tagName === 'SELECT') {
            this._blocks.push(this._handleChange(selector, value))
          }
          break;
        case pptrActions.GOTO:
          this._blocks.push(this._handleGoto(href, frameId))
          break;
        case pptrActions.SCREENSHOT:
          this._blocks.push(this._handleScreenshot(value))
          break;
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
    if (this._options.blankLinesBetweenBlocks && this._blocks.length > 0) {
      this._postProcessAddBlankLines()
    }
  }
  _handleKeyDown (selector, value) {
    return new Block(this._frameId, { type: domEvents.KEYDOWN, value: `fill-field '${selector}' '${value}'` });
  }
  _handleClick (selector) {
    return new Block(this._frameId, { type: domEvents.CLICK, value: `click '${selector}'` });
  }
  _handleChange (selector, value) {
    return new Block(this._frameId, { type: domEvents.CHANGE, value: `select '${selector}' '${value}'` })
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

  _postProcessAddBlankLines () {
    let i = 0
    while (i <= this._blocks.length) {
      const blankLine = new Block()
      blankLine.addLine({ type: null, value: '' })
      this._blocks.splice(i, 0, blankLine)
      i += 2
    }
  }

  _setFrames (frameId, frameUrl) {
    if (frameId && frameId !== 0) {
      this._frameId = frameId
      this._frame = `frame_${frameId}`
      this._allFrames[frameId] = frameUrl
    } else {
      this._frameId = 0
      this._frame = 'page'
    }
  }
}
