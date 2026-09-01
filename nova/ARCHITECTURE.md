# NOVA - North Star & Operating Rules

**These rules are active for the entire lifecycle of the NOVA project.**

## 1. NOVA IS A NEW PRODUCT
- NOVA is an independent greenfield product, not "Smart Schools Hub v2."
- The legacy system is reference material only.

## 2. LEGACY = RESEARCH, NOT DEPENDENCY
- **Use legacy HTML to understand:** Workflows, business rules, entities, reports, terminology, permissions.
- **Do NOT copy:** Branding, UI, CSS, architecture, database, authentication, infrastructure, bugs.
- NOVA must work completely independently if the legacy system disappears.

## 3. PRESERVE FUNCTION, REINVENT EVERYTHING ELSE
- Preserve important proven business functionality.
- Reinvent the implementation, architecture, UX, visual design, and technology. 
- *Mantra*: "Same problems solved better" (Not "same pages rebuilt").

## 4. DO NOT LET THE OLD UI INFLUENCE THE NEW UI
- NOVA should look and feel like a completely new premium product.
- **Aim for:** World-class SaaS quality, polished UX, elegant typography, fast interactions, responsive behavior.
- Avoid generic AI-dashboard aesthetics.

## 5. BUILD FOR THE FUTURE, NOT JUST PARITY
- The legacy system defines the baseline, not the ceiling.
- Differentiate between **LEGACY-DERIVED REQUIREMENTS** and **NEW NOVA CAPABILITIES**.

## 6. DATA IS SACRED
- Use a completely NEW database. Never connect to the legacy database.
- Design for integrity, auditability, safe migrations, and proper indexing.

## 7. TENANT ISOLATION IS NON-NEGOTIABLE
- Hierarchy: `Organization -> School -> Branch`
- Tenant boundaries MUST be enforced SERVER-SIDE.
- Never trust client-provided tenant IDs.

## 8. SECURITY OVER CONVENIENCE
- Treat all school data as sensitive.
- Enforce Server-side authorization and custom, first-party secure sessions (no deprecated libraries).

## 9. BUSINESS LOGIC MUST HAVE ONE HOME
- Centralize core rules (grading, fee calculations, permissions) outside of UI components.
- UI calls domain logic, it doesn't invent it.

## 10. DO NOT BUILD A GIANT MONOLITH
- Avoid god components and tightly coupled modules. Keep the system modular.

## 11. UX OVER UI
- Focus on what the user is trying to accomplish.
- Minimize clicks, make forms clear, tables powerful, and destructive actions safe.

## 12. PERFORMANCE IS A FEATURE
- Avoid N+1 queries, wasteful polling, and huge payloads. Use pagination and caching.

## 13. REPORTS ARE FIRST-CLASS FEATURES
- Documents (invoices, mark sheets) must be professionally printable (A4, PDF, print-safe).

## 14. DON'T FAKE COMPLETION
- Verify functionality with tests, type checking, and production builds. Show evidence.

## 15. KEEP THE REFERENCE MATERIAL SAFE
- Never delete or corrupt the downloaded reference material.

## 16. MAKE REASONABLE DECISIONS
- For reversible, low-risk decisions: make the best engineering decision and document it autonomously.
- Stop for consequential decisions (migrations, destructive actions, security).

## 17. THINK LIKE A PRINCIPAL ENGINEER
- Requirements -> Domain model -> Data -> Authorization -> Server behavior -> UX -> Performance -> Testing -> Failure cases.

## 18. QUALITY BAR
- "Would I be proud to put this into production for thousands of users?"
- Target: Premium, reliable, secure, scalable, maintainable.

## 19. STAY ON MISSION
- Prefer decisions that support NOVA's long-term independence and quality over reproducing legacy quirks.

## 20. FINAL NORTH STAR
- OLD SYSTEM -> UNDERSTAND IT -> EXTRACT THE REQUIREMENTS -> IMPROVE THE REQUIREMENTS -> DESIGN FROM FIRST PRINCIPLES -> BUILD NOVA -> TEST NOVA -> HARDEN NOVA -> DEPLOY NOVA.
