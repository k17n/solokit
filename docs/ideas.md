# Tool Ideas for Solopreneurs & Freelancers

Status legend: 🟢 planned next · ⚪ backlog

## Money
- 🟢 **Invoice generator** (India GST first; other countries coming soon)
- ⚪ Quote / estimate generator (reuses invoice code, "convert to invoice")
- ⚪ Receipt generator
- ⚪ Late fee / payment reminder email writer
- ⚪ Hourly rate calculator (income, expenses, taxes, billable hours -> rate)
- ⚪ Project pricing calculator (fixed price / retainer)
- ⚪ Profit margin / markup calculator
- ⚪ Freelance tax set-aside estimator (country-specific)
- ⚪ Expense tracker with CSV export
- ⚪ Currency converter for invoices

## Client work
- ⚪ Contract / freelance agreement generator (needs "not legal advice" disclaimer)
- ⚪ NDA generator
- ⚪ Proposal builder
- ⚪ Scope of work / SOW template
- ⚪ Time tracker + timesheet feeding into invoices
- ⚪ Client onboarding questionnaire builder
- ⚪ Testimonial request email generator

## Marketing & presence
- ⚪ Email signature generator
- ⚪ QR code generator (URL, Wi-Fi, vCard, email, SMS, WhatsApp, UPI payment link). Static codes only at first
- ⚪ Link-in-bio page builder
- ⚪ Social media bio / caption generator
- ⚪ Business name & tagline generator
- ⚪ Simple logo maker
- ⚪ UTM link builder
- ⚪ Meta tag / Open Graph preview tool

## Productivity
- ⚪ Meeting notes -> action items
- ⚪ Pomodoro / focus timer
- ⚪ Local-storage Kanban board
- ⚪ Notion / Sheets / Docs template bundles

## Documents & files
- ⚪ PDF merge / split / compress
- ⚪ Image resizer & compressor
- ⚪ Background remover
- ⚪ Word / character counter

## AI-powered (needs API + cost model)
- ⚪ Cold email writer, proposal drafter, contract summarizer

## Suggested order after invoices
1. Quote/estimate generator
2. Hourly rate calculator
3. Contract / NDA generator
4. Time tracker feeding into invoices
5. Email signature generator

## Architecture principle
Build a shared layer early: business/client profile saved in localStorage plus a common PDF export, so every tool prefills from it. The cross-tool convenience is what makes a suite better than standalone sites.
