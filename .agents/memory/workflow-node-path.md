---
name: Workflow Node Path
description: The workflow command must use the full nix store path for node
---

The workflow for this monorepo must use the full path to the Node.js binary because `node` is not in the default workflow PATH:

```
/nix/store/bl6iwirn83qj9r8wng43kfdqd5mfahj8-nodejs-22.22.0/bin/node
```

Full workflow command:
```
cd apps/mobile && /nix/store/bl6iwirn83qj9r8wng43kfdqd5mfahj8-nodejs-22.22.0/bin/node /home/runner/workspace/node_modules/expo/bin/cli start --web --localhost --port 5000
```

**Why:** The Replit workflow environment PATH does not include nix profile binaries. The `available-pid2-node-paths` helper in `/nix/store/haw0fglr9qcrdxvdsbw4ffwp4r9p6dph-replit-runtime-path/bin/` reveals the correct path.

**How to apply:** Use `configureWorkflow()` from the workflows skill with this exact command string.
