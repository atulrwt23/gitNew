const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

let tabs = []
let activeTabId = null

async function tryCreateXterm(container, sessionId) {
  try {
    const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
      import('xterm'),
      import('xterm-addon-fit'),
      import('xterm-addon-web-links'),
    ])
    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      cursorBlink: true,
      allowProposedApi: true,
      convertEol: true,
      theme: { background: '#0b0e16' },
    })
    const fit = new FitAddon()
    const links = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(links)

    const host = document.createElement('div')
    host.style.height = '100%'
    host.style.width = '100%'
    container.appendChild(host)

    term.open(host)
    fit.fit()

    window.terminal.onData(({ id, data }) => {
      if (id !== sessionId) return
      term.write(data)
    })
    window.terminal.onExit(({ id }) => {
      if (id !== sessionId) return
      term.writeln('\r\n[Session exited]')
    })

    term.onData((data) => {
      window.terminal.write(sessionId, data)
    })

    const ro = new ResizeObserver(() => {
      fit.fit()
      const cols = term.cols
      const rows = term.rows
      window.terminal.resize(sessionId, cols, rows)
    })
    ro.observe(container)

    return { term, dispose: () => ro.disconnect() }
  } catch (e) {
    return null
  }
}

function createFallbackView(sessionId) {
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

  const ro = new ResizeObserver(() => {})
  ro.observe(pane)

  return pane
}

async function createPane(sessionId) {
  const pane = document.createElement('div')
  pane.className = 'pane'

  const xtermContainer = document.createElement('div')
  xtermContainer.style.height = '100%'
  xtermContainer.style.width = '100%'
  pane.appendChild(xtermContainer)

  const xterm = await tryCreateXterm(xtermContainer, sessionId)
  if (!xterm) {
    pane.innerHTML = ''
    return createFallbackView(sessionId)
  }

  // If xterm is in use, clicking focuses the terminal
  pane.addEventListener('mousedown', () => {
    xterm.term.focus()
  })

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
  const pane = await createPane(id)
  const tab = { id, title: `Tab ${tabs.length + 1}`, pane }
  tabs.push(tab)
  setActiveTab(id)
}

function setActiveTab(id) {
  activeTabId = id
  renderTabs()
  renderContent()
}

$('#add-tab').onclick = createTab

window.terminal.onCreated?.(async ({ id }) => {
  const pane = await createPane(id)
  const tab = { id, title: `Tab ${tabs.length + 1}`, pane }
  tabs.push(tab)
  setActiveTab(id)
})

// Future: load persisted layout