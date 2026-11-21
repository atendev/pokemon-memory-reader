import {
  COVERAGE_DOC,
  repoCoverage,
} from "../server/test/support/coverage-report";

/**
 * Writes `docs/coverage.md` from the coverage matrix, the support flags, the built-in profiles and
 * the fixture folders (spec §12.7, §12.8). `--check` writes nothing and exits 1 when the file is
 * stale or the guard fails. Either way it prints the tier 2 gaps and the profiles with no fixture.
 */
const { report, doc } = await repoCoverage();
const check = process.argv.includes("--check");

console.log(`${report.noFixture.length} profile(s) with no fixture`);
for (const id of report.noFixture) console.log(`  ${id}`);
console.log(`${report.tier2Gaps.length} tier 2 gap(s)`);
for (const gap of report.tier2Gaps) console.log(`  ${gap}`);
for (const failure of report.failures) console.error(`FAIL ${failure}`);

const current = (await Bun.file(COVERAGE_DOC).exists())
  ? await Bun.file(COVERAGE_DOC).text()
  : null;
if (check) {
  if (current !== doc)
    console.error("docs/coverage.md is stale: run `bun run coverage`");
  process.exit(report.failures.length > 0 || current !== doc ? 1 : 0);
}
await Bun.write(COVERAGE_DOC, doc);
console.log("wrote docs/coverage.md");
process.exit(report.failures.length > 0 ? 1 : 0);
