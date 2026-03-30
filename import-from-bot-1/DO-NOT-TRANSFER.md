# DO-NOT-TRANSFER.md

**Security & Privacy Boundaries**

This document explicitly lists what must NOT be transferred to another assistant or external system.

---

## 🔴 NEVER TRANSFER: Secrets & Credentials

### API Keys & Tokens

| Secret | Location | Why Protected |
|--------|----------|---------------|
| Discord Bot Token | `shorts-bot/.env` | Could be used to impersonate bot, spam channels |
| YouTube OAuth Credentials | `client_secret_*.json` | Full YouTube account access |
| Anthropic API Key | OpenClaw config | Direct billing access |
| OpenAI API Key | OpenClaw config | Direct billing access |
| Ollama endpoint | Environment var | Internal service access |

### Generated Tokens

| Token | Location | Why Protected |
|-------|----------|---------------|
| YouTube `token.json` | `shorts-bot/token.json` | OAuth refresh token (long-lived) |
| Discord OAuth tokens | `shorts-bot/.env` | Bot authentication |
| Instagram access tokens | `shorts-bot/.env` | Account access |
| TikTok access tokens | `shorts-bot/.env` | Account access |

### Certificate/Key Files

| File | Pattern | Why Protected |
|------|---------|---------------|
| Private keys | `*.pem`, `*.key` | Cryptographic identity |
| SSH keys | `~/.ssh/` | Server access |
| SSL certificates | `*.crt`, `*.cer` | TLS identity |

---

## 🟡 NEVER TRANSFER: Personal Memory

### Master E's Private Context

| File | Contains |
|------|----------|
| `MEMORY.md` | Personal thoughts, decisions, preferences, facts about Master E |
| `USER.md` | Master E's identity, contact info, timezone, relationships |
| `memory/2026-03-*.md` | Daily activity logs with personal details |
| `ops-log.json` | Session history, command logs, sometimes personal content |

### Why These Stay Private

- Contains **personally identifiable information**
- Documents **Master E's thought process and decisions**
- May contain **sensitive personal matters**
- Could reveal **habits, schedules, relationships**
- Includes **financial and business strategies**

### What You CAN Share Instead

| Instead of... | Share... |
|---------------|----------|
| Full MEMORY.md | Generic workflow templates |
| Daily logs | Anonymized lessons learned |
| Personal preferences | "A user in this context might want..." |
| Specific dates | Relative timing ("after setup", "during launch") |

---

## 🟠 NEVER TRANSFER: Large Asset Files

### Design Packs (Copyright/IP)

| Location | Contents | Size |
|----------|----------|------|
| `etsy-shop/ready-to-upload/*.zip` | Actual PNG design files | ~200 MB |
| `etsy-shop/packs/` | Source pack folders | ~500 MB |
| `D:\Pictures\` (external) | Original design sources | Many GB |

### Video Assets

| Location | Contents | Size |
|----------|----------|------|
| `shorts-bot/clips/` | Raw video clips | Variable |
| `shorts-bot/output/` | Processed videos | Variable |

### Why These Stay Behind

- **Intellectual property** — Master E's original designs
- **Large file sizes** — not practical to transfer
- **Not reusable** — specific to this user's business
- **Transfer what matters:** The scripts, templates, and workflows

---

## 🟣 NEVER TRANSFER: Environment-Specific Files

### Machine-Specific Configs

| File | Issue |
|------|-------|
| `.env` | Hardcoded paths, specific to Nugget (Windows machine) |
| `package-lock.json` | Platform-specific, regenerates |
| `node_modules/` | Platform-specific, reinstall with `npm install` |
| `*.db` | SQLite databases with machine-specific paths |

### Hardcoded Paths to Replace

```powershell
# Original (Master E's machine)
D:\Pictures\T-shirt designs\
C:\Users\efenn\.openclaw\
D:\ollama\models\

# Recipient must adapt to their own paths
/home/user/designs/
~/.openclaw/
/opt/ollama/models/
```

---

## ⚠️ LOW CONFIDENCE: Experimental/Unfinished

### Incomplete Implementations

| Item | State | Risk |
|------|-------|------|
| `fiverr-gigs/` | Templates only, not launched | May not work as expected |
| `pinterest/` | Draft content | Unpolished, may confuse |
| `substack/` | Incomplete templates | Not production-ready |
| `projects/mission-control/` | Partial implementation | Database schema may change |
| Trading bot | Empty framework | No actual logic |
| TikTok/Instagram uploaders | Stubs only | Not implemented |

### Why These Are Risky

- **Untested** — haven't been validated in production
- **Incomplete** — may require significant work to finish
- **Confusing** — could mislead recipient about capability
- **Outdated** — may reflect early ideas since abandoned

---

## ✅ SAFE TO TRANSFER

### High Confidence, Reusable

| Item | Why Safe |
|------|----------|
| `.env.example` | Template with placeholders, no real values |
| `SKILL.md` files | Generic documentation |
| Listing templates | Copy-paste ready, no personal data |
| Python scripts | Business logic only, no secrets |
| PowerShell scripts | Infrastructure code, paths are obvious |
| Workflow documentation | Generic patterns |
| README files | Public-facing documentation |

### Patterns That Indicate Safety

✅ **Safe:**
- No API keys or tokens
- No personal names or details
- Uses placeholder paths
- Generic examples
- Template format

❌ **Not Safe:**
- Contains `sk-...`, `Bearer`, `token`
- Mentions specific people, dates, locations
- Hardcoded paths to user directories
- References to "Master E", "Emmitt", "Nugget"

---

## Transfer Checklist

Before transferring ANY file, verify:

- [ ] No API keys, tokens, or passwords
- [ ] No personal information about Master E
- [ ] No private thoughts or decisions
- [ ] No hardcoded paths to user directories
- [ ] File is complete and tested (not a stub)
- [ ] File is reusable (not specific to one user)
- [ ] No large binary assets (images, videos, ZIPs)

---

## If You Find Something Unclear

**When in doubt, leave it out.**

If a file's safety status is ambiguous:
1. Don't include it
2. Note it in the handoff summary
3. Let the recipient request it specifically if needed
4. Master E can review and approve on a case-by-case basis

---

*Security boundaries v1.0 | George III 👑*
*Remember: This package transfers PATTERNS, not DATA.*
