# iterm2-like

A modern, extensible terminal emulator inspired by iTerm2.

## Quick start

- Install deps: `npm install`
- Run dev app: `npm run dev`

Optional full terminal stack:

```
npm i node-pty xterm xterm-addon-fit xterm-addon-web-links
```

If `node-pty` is missing, sessions run in echo mode. If `xterm` is missing, a basic text view is used.

Electron is pinned in `devDependencies`. If your platform needs a different build, adjust the version in `package.json` and re-install.

## Roadmap (high level)
- Tabs, splits, session persistence
- Theming, fonts, keybindings
- Search, history, autocomplete
- GPU-accelerated text rendering
- Plugin system and config files