const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

let tabs = []
let activeTabId = null

function createPane(sessionId) {
  const pane = document.createElement('div')
  pane.className = 'pane'

  const output = document.createElement('pre')
  output.className = 'terminal-view'
  output.textContent = ''

  const status = document.createElement('div')
  status.className = 'status'
  status.textContent = 'Echo mode until xterm/node-pty installed'

  const inputCapture = document.createElement('textarea')
  inputCapture.className = 'input-capture'
  inputCapture.spellcheck = false
  inputCapture.autocapitalize = 'off'
  inputCapture.autocomplete = 'off'
  inputCapture.addEventListener('keydown', (e) => {
    if (!activeTabId || activeTabId !== sessionId) return
    const special = {
      Enter: '\r',
      Backspace: '\x7f',
      Tab: '\t',
      ArrowUp: '\x1b[A',
      ArrowDown: '\x1b[B',
      ArrowRight: '\x1b[C',
      ArrowLeft: '\x1b[D',
    }
    if (special[e.key]) {
      window.terminal.write(sessionId, special[e.key])
      e.preventDefault()
      return
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      window.terminal.write(sessionId, e.key)
      e.preventDefault()
    }
  })
  inputCapture.addEventListener('paste', (e) => {
    const text = e.clipboardData.getData('text')
    if (text) {
      window.terminal.write(sessionId, text)
      e.preventDefault()
    }
  })

  pane.appendChild(output)
  pane.appendChild(inputCapture)
  pane.appendChild(status)

  // Focus capture on click
  pane.addEventListener('mousedown', () => inputCapture.focus())

  // Data incoming
  window.terminal.onData(({ id, data }) => {
    if (id !== sessionId) return
    output.textContent += data
    output.scrollTop = output.scrollHeight
  })

  window.terminal.onExit(({ id }) => {
    if (id !== sessionId) return
    status.textContent = 'Session exited'
  })

  // Resize observer placeholder
  const ro = new ResizeObserver(() => {
    // In xterm mode we would compute cols/rows and call resize
  })
  ro.observe(pane)

  return pane
}

function renderTabs() {
  const tabsEl = $('#tabs')
  tabsEl.innerHTML = ''
  for (const t of tabs) {
    const el = document.createElement('div')
    el.className = 'tab' + (t.id === activeTabId ? ' active' : '')
    el.textContent = t.title
    el.onclick = () => setActiveTab(t.id)
    tabsEl.appendChild(el)
  }
}

function renderContent() {
  const content = $('#content')
  content.innerHTML = ''
  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab) return
  content.appendChild(tab.pane)
}

async function createTab() {
  const { id } = await window.terminal.create({})
  const pane = createPane(id)
  const tab = { id, title: `Tab ${tabs.length + 1}`, pane }
  tabs.push(tab)
  setActiveTab(id)
}

function setActiveTab(id) {
  activeTabId = id
  renderTabs()
  renderContent()
  // Focus input capture of the active pane
  const input = $$('.input-capture')[0]
  input?.focus()
}

$('#add-tab').onclick = createTab

window.terminal.onCreated?.(({ id }) => {
  const pane = createPane(id)
  const tab = { id, title: `Tab ${tabs.length + 1}`, pane }
  tabs.push(tab)
  setActiveTab(id)
})

// Load layout in future; for now just rely on initial created event