# Security

Do not post credentials, private diagrams or an exploit containing private data in a public issue. Use the repository's private vulnerability reporting option when available. Otherwise contact the maintainers privately through Game Economist Consulting.

## Credential boundaries

- GitHub stores source, public example JSON and build/test workflows. CI requires no service credentials and does not deploy.
- Cloudflare Worker secrets hold service credentials. Supabase service-role keys and encryption keys must never use Vite's `VITE_` prefix or be bundled into the browser.
- Netlify is the public-subdomain reverse proxy. Do not add GitHub, Cloudflare, Supabase, Slack or AI-provider keys to its environment or build settings.
- `.env*`, `.dev.vars*`, `.netlify/`, `.wrangler/`, private keys and generated bundles are ignored. The committed `.dev.vars.example` contains placeholders only.
- Browser-local guest saves are not GitHub commits. Marking a diagram private excludes it from automatic gallery publication; explicitly created snapshot links have their own revocation control.

Before pushing, review the staged diff and filenames. If a credential was accidentally committed, revoke or rotate it and remove it from repository history; deleting the latest file alone is insufficient.
