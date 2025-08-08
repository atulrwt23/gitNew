# iterm2-like

A modern, extensible terminal emulator inspired by iTerm2.

## Quick start

- Install deps: `npm install`
- Run dev app: `npm run dev`

If `node-pty` and `xterm` are not installed yet, the app will run with a basic fallback terminal view and echo backend. Install them later:

```
npm i node-pty xterm xterm-addon-fit xterm-addon-web-links
```

## Roadmap (high level)
- Tabs, splits, session persistence
- Theming, fonts, keybindings
- Search, history, autocomplete
- GPU-accelerated text rendering
- Plugin system and config files