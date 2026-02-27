# Vis

An alternative web UI for [OpenCode](https://github.com/sst/opencode), designed for daily use. It connects to a running OpenCode instance and provides a browser-based, window-style interface for managing sessions, viewing tool output, and interacting with AI agents in real time.

![Demo](docs/demo.gif)

## Features

- **Review-first floating windows** that keep tool output and agent reasoning in context
- Session management with **multi-project and worktree** support
- Syntax-highlighted **code and diff viewers** built for fast, confident review
- Permission and question prompts for interactive agent workflows
- Embedded terminal powered by xterm.js

## How to Use

**No installation required** — just open the hosted version in your browser:

**<https://xenodrive.github.io/vis/>**

All you need is a running OpenCode server with CORS enabled. Start it with:

```bash
opencode serve --cors https://xenodrive.github.io
```

Or add this to your `.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "server": {
    "cors": ["https://xenodrive.github.io"]
  }
}
```

and then:

```bash
opencode serve
```

---

## Development

```sh
pnpm install
pnpm dev
```

## License

MIT
