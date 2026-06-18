# HIkoreaFORMS Agent Manual

Mandatory rules for any agent working in `/Users/macvalera/Documents/HIkoreaFORMS`.
If PROJECT_TRUTH.md conflicts with AGENTS.md:

PROJECT_TRUTH.md wins.

If source code conflicts with documentation:

Investigate before changing behavior.
Do not assume documentation is correct.

## First Read

Before any code change, read:

- `docs/PROJECT_TRUTH.md`
- `docs/PROJECT_CONFLICTS.md`
- `docs/ACTIVE_PROJECT_MAP.md`

Then identify the active files affected by the request, explain the risk, and make targeted changes only.

## Active Production Files

- Frontend entry: `index.html` -> `src/main.jsx` -> `src/App.jsx`
- Frontend app: `src/ImmigrationMVP.jsx`
- Admin panel: `src/AdminPanel.jsx`
- Backend: `server.js`
- PDF generator: `pdf/pdf_generator.py`
- Scan processor: `pdf/scan_processor.py`
- i18n: `src/i18n`
- Legal text: `src/legal`
- Templates: `templates`
- Deployment workflow: `.github/workflows/deploy.yml`

## High-Risk Areas

Changes in these areas require extra caution:

- OCR prompts
- PDF coordinates
- Package generation
- Payment processing
- Google OAuth
- Cart restoration
- Signature handling
- Storage cleanup
- i18n translations

## Form Rules

F4:
- Generate F4 Goso form.
- Initial F4 additionally generates non-employment pledge.

F1:
- May require guarantee form depending on action.

Password Recovery:
- Requires applicant signature.
- Fax is allowed only for this flow.

School Report:
- Generated for students and school-based applications.

Accommodation:
- Generated for housingType = other.
- Requires provider information.

## Contract Address Rule

For immigration application forms, use the lease/contract address when available.

Do not automatically prefer the ARC card address over the contract address.

## Mobile Rules

Mobile-first is mandatory.

Do not reduce mobile usability.

Any change affecting:
- upload cards
- crop editor
- signatures
- step navigation
- cart
- payment

must be tested against mobile workflows.

Do not assume desktop behavior equals mobile behavior.

## Inactive Duplicates

Do not edit these unless the user explicitly asks:

- `ImmigrationMVP.jsx`
- `AdminPanel.jsx`
- `src/server.js`
- `pdf_generator.py`
- `scan_processor.py`
- `i18n`
- root `legal` unless the user asks to keep old duplicates synced

Do not trust duplicate files when deciding active behavior.

## Known Product Decisions

- No free generation model.
- New users receive 15 credits.
- Pricing uses credits.
- Fax is password-recovery only.
- Uploaded document copies are currently not attached to generated package PDFs.
- OCR is assistive and user-editable.
- Package personal data retention is 14 days.

## Critical Product Rules

- Do not break OCR.
- Do not break PDF coordinates.
- Do not change PDF templates without coordinate recalibration and visual PDF verification.
- Do not break payment or credit logic.
- Do not break cart/package states.
- Do not break i18n.
- Do not hardcode user-facing UI text if an i18n key should be used.
- Do not trust old pricing/free-generation copy.
Do not change OCR prompts without explicit approval.

Do not change PDF coordinates unless the task is specifically about that form.

Do not change Google OAuth flow without checking existing users.

Do not change package generation flow without checking:
- preview
- download
- email
- cart
- paid package regeneration

Do not change storage cleanup logic without checking the 14-day retention policy.

## PDF Coordinate Rule

Many production PDF coordinates were manually calibrated.

Do not modify, recalculate, normalize, convert, or refactor working coordinates unless explicitly requested.

Visual verification against the generated PDF is required after coordinate changes.

## Signature Rule

Signatures are role-based:

- Applicant
- Guarantor
- Accommodation Provider

Use transparent background.

Do not add white background.

Reuse the same role signature across multiple forms when applicable.

## Pricing Truth

Current official logic is credit-based:

- New users receive 15 credits.
- 1 credit = 1,000 KRW.
- 1 form = 3 credits.
- 2 forms = 4 credits.
- 3+ forms = 5 credits.
- HiKorea password recovery = 3 credits.

Legacy references to first free generation, `freeDownloadsUsed`, 2,990 KRW, 3,990 KRW, 4,990 KRW, or 4,900 KRW per generation are not current product truth.

## Storage Truth

Local machine data lives in:

- `.env`
- `data/`
- `outputs/`
- `temp/`

Production server data lives in:

- `/var/www/hikoreaforms/.env`
- `/var/www/hikoreaforms/data/`
- `/var/www/hikoreaforms/outputs/`
- `/var/www/hikoreaforms/temp/`

Deployment must not overwrite production `.env`, `data`, `outputs`, or `temp`. Personal package data and uploads are scrubbed after 14 days by application logic.

## Delivery Truth

Final download, email, and fax require login and sufficient credits/payment.

Fax is currently password-recovery only.

## GitHub And Deployment

Repository:

- `git@github.com:munvalera-glitch/hikoreaforms.com.git`
- Main branch: `main`

Production:

- Domain: `https://hikoreaforms.com`
- SSH user: `ubuntu`
- SSH host: `hikoreaforms.com`
- SSH key on this machine: `ssh-key-2026-05-14.key`
- Production path: `/var/www/hikoreaforms`
- PM2 process: `hikoreaforms-api`
- Nginx serves: `/var/www/hikoreaforms/dist`
- API proxy: `127.0.0.1:3001`

Useful SSH command:

```bash
ssh -i ssh-key-2026-05-14.key ubuntu@hikoreaforms.com
```

Do not print private key contents in chat or logs. The key file path may be referenced; the key value must stay secret.

## GitHub Actions Secrets

GitHub Actions deploy uses repository secrets:

- `DEPLOY_HOST` = `hikoreaforms.com`
- `DEPLOY_USER` = `ubuntu`
- `DEPLOY_KEY` = contents of `ssh-key-2026-05-14.key`
- `DEPLOY_PATH` = `/var/www/hikoreaforms`
- `DEPLOY_RESTART_COMMAND` = `pm2 restart hikoreaforms-api --update-env`
- `DEPLOY_PORT` is optional; default is `22`

The server cannot pull the private GitHub repo by itself. The workflow builds on GitHub, creates an archive, copies it to the server with `scp`, extracts it into `/var/www/hikoreaforms`, runs `npm ci`, runs `npm run build`, then restarts PM2.

The workflow intentionally excludes:

- `.git`
- `node_modules`
- `.env`
- `data`
- `outputs`
- `temp`
- `server.log`
- `vite_output.log`

## Standard Change Workflow

1. Read the required docs.
2. Check current state:

```bash
git status --short
```

3. Edit only active files.
4. Build before deploy:

```bash
npm run build
```

5. Stage only intentional files:

```bash
git add <files>
```

6. Commit:

```bash
git commit -m "Clear change summary"
```

7. Push:

```bash
git push origin main
```

Pushing to `main` triggers GitHub Actions deployment.

## Deploy Verification

After push, verify GitHub Actions run:

- `https://github.com/munvalera-glitch/hikoreaforms.com/actions/workflows/deploy.yml`

Then verify production:

```bash
curl -I https://hikoreaforms.com
ssh -i ssh-key-2026-05-14.key ubuntu@hikoreaforms.com 'cd /var/www/hikoreaforms && node -p "require(\"./package.json\").version" && pm2 list'
```

If checking a frontend text/version change, use a cache-busting URL:

```text
https://hikoreaforms.com/?verify=<commit-sha>
```

Browser cache can show an old bundle. Ask the user to hard refresh with `Cmd + Shift + R` if production files are correct but their tab looks stale.

## Working From Another Computer

Clone the repo:

```bash
git clone git@github.com:munvalera-glitch/hikoreaforms.com.git
cd hikoreaforms.com
npm install
```

The repo does not include `.env`, production `data`, uploads, or logs. For local API testing, copy a valid `.env` securely from this machine or from the production server. Do not commit `.env`.

Normal code changes should go through GitHub:

```bash
npm run build
git add <files>
git commit -m "Clear change summary"
git push origin main
```

Production data inspection requires SSH to the server, not GitHub.

## Common Checks

Find active imports/calls before trusting a file:

```bash
rg -n "pdf/pdf_generator|scan_processor|ImmigrationMVP|AdminPanel|i18n" .
```

Check production PM2 logs:

```bash
ssh -i ssh-key-2026-05-14.key ubuntu@hikoreaforms.com 'pm2 logs hikoreaforms-api --lines 100'
```

Check production files without exposing secrets:

```bash
ssh -i ssh-key-2026-05-14.key ubuntu@hikoreaforms.com 'ls -la /var/www/hikoreaforms'
```

Never run destructive server commands such as `rm -rf`, `git clean`, or replacing `/var/www/hikoreaforms` wholesale unless the user explicitly approves and backups are confirmed.

