# @ymchun/opencode-ollama-usage

An opencode TUI plugin for Ollama usage information.

![home](https://raw.githubusercontent.com/ymchun/opencode-ollama-usage/refs/heads/master/assets/screenshot_home.png)

![session](https://raw.githubusercontent.com/ymchun/opencode-ollama-usage/refs/heads/master/assets/screenshot_session.png)

## Install

```bash
opencode plugin add @ymchun/opencode-ollama-usage
```

## Config

Add the plugin to your `tui.json`:

```json
{
  "plugin": ["@ymchun/opencode-ollama-usage"]
}
```

## Environment Variables

### `OLLAMA_SESSION_COOKIE` (required)

Your Ollama session cookie, used to authenticate requests to the [Ollama settings page](https://ollama.com/settings). Without it the plugin shows **No Cookie** in the sidebar.

**How to get it:**

1. Sign in at [ollama.com](https://ollama.com) in your browser
2. Open **DevTools** → **Application** → **Cookies** → `https://ollama.com`
3. Copy the value of the cookie named `__Secure-session`
4. Set it as the environment variable:

```bash
# In your shell profile (~/.zshrc, ~/.bashrc, etc.)
export OLLAMA_SESSION_COOKIE="<your-session-cookie-value>"
```

Or set it in your `opencode.json`:

```json
{
  "env": {
    "OLLAMA_SESSION_COOKIE": "<your-session-cookie-value>"
  }
}
```

> **Note:** The session cookie expires periodically. When it does, the plugin will show **Signed Out** — repeat the steps above to update the value.

### `OLLAMA_QUOTA_REFRESH_INTERVAL` (optional)

How often (in milliseconds) the plugin refreshes quota data. Defaults to `300000` (5 minutes).

```bash
export OLLAMA_QUOTA_REFRESH_INTERVAL=60000  # refresh every minute
```

## Development

```bash
bun install
bun run build
bun test
```

## Publishing

This package is published to npm automatically via GitHub Actions when a version tag is pushed.

### Setup

1. **Add `NPM_TOKEN` secret** to your GitHub repository:
   - Go to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Your npm access token (create one at [npmjs.com](https://www.npmjs.com/settings/tokens) with **Automation** type)
   - Click **Add secret**

### Release a new version

```bash
# 1. Update the version in package.json
# 2. Commit and push
git add .
git commit -m "chore: release v0.x.x"
git push origin master

# 3. Create and push a tag matching the version
git tag v0.x.x
git push origin v0.x.x
```

Pushing the tag triggers the **Publish** workflow which:

1. Verifies the tag matches `package.json` version
2. Runs all checks (typecheck, lint, format, build, test)
3. Publishes to npm with provenance
4. Creates a GitHub Release with auto-generated release notes

> **Note:** The tag must match the version in `package.json` (e.g., tag `v0.2.0` requires `"version": "0.2.0"`). The workflow will fail if they don't match.

## License

MIT
