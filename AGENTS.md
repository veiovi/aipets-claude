# AI Pets for Claude

Public beta. Keep this repository limited to the desktop mod and its licensed
build inputs. Never import private cloud source or credentials. Hosted AI Pets
service changes belong in the owning cloud repository.
Use Node 24+ and pnpm 9.15.0. Run `pnpm build`, `pnpm test` and
`claude plugin validate plugin --strict`.

The plugin is one Claude mod for the Claude desktop app: Luna appears above the
prompt after the person submits one, says a short line, then collapses. Claude (`$.model`) writes her
line; there is no backend, provider key, browser page or local storage.
Only filtered submitted prose reaches the model: no drafts, code, tool contents
or Claude replies. Never block or rewrite Claude's event chain for Luna.

Luna's frames are recorded at build time by the canonical C/WASM player from
the hash-pinned publication pack; the mod only plays the recording. Do not add
another animation engine, firmware builds or sibling-repository imports.

`docs/implementation.md` describes the current behavior and its evidence.
