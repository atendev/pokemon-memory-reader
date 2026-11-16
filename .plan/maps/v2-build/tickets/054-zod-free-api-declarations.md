---
type: grilling
blocked_by: []
---

# How do `/types` and `/client` ship declarations that don't need Zod?

## Question

Spec §10 says users of `@pokemon-memory-reader/api`'s `/types` and `/client` never install Zod. [API package build and check](./012-api-package-build-and-check.md) found that `dist/schemas.d.ts` imports `zod`, and `types.d.ts` and `client.d.ts` import from it, so a project without `zod` or `skipLibCheck` gets TS2307 (reproduced with a packed tarball in a clean directory). Decide how the types stop depending on Zod: hand-written interfaces kept in sync by a test, a generated declaration file, a Zod peer dependency, or relaxing §10. See [the 012 report](../assets/012-api-package-build-and-check-report.md).

Record the answer as an amendment that the spec section can cite. Don't edit `spec.md` in this ticket.
