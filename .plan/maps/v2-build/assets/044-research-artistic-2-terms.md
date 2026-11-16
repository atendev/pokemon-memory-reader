# 044 research: Artistic License 2.0 terms for domain-browser@4.23.0 bundled into a GPL-3.0-or-later binary

Question: what does Artistic-2.0 require of someone who redistributes an UNMODIFIED npm package after mechanical bundling/minification into Bun's runtime binary, shipped inside a GPL-3.0-or-later app on GitHub Releases? Is it GPL-compatible?

Local license copy (quotes below): `scripts/notices/texts/domain-browser_4.23.0__LICENSE.md.txt`. It matches the canonical text https://spdx.org/licenses/Artistic-2.0.html and https://www.perlfoundation.org/artistic-license-20.html (not re-diffed word by word). Copyright line in that file: "Copyright &copy; 2013+ Bevry Pty Ltd".

## Findings

1. FSF verdict: GPL-compatible. Source https://www.gnu.org/licenses/license-list.html (under "GPL-Compatible Free Software Licenses"): "This license is a free software license, compatible with the GPL thanks to the relicensing option in section 4(c)(ii)." Relicensing clause 4(c)(ii) is in the Modified Version section, so the FSF verdict rests on a path that an unmodified package never uses. For an unmodified package, rights come from (2)/(5)/(7)/(8), and the package stays Artistic-2.0 inside the aggregate. No relicensing to GPL is needed or happens.
   - Caveat: the FSF page text was read through a summarizer. The sentence came back identical in two fetches.

2. Definitions (local license text; same as SPDX/Perl Foundation):
   - "Standard Version" refers to the Package if it has not been modified, or has been modified only in ways explicitly requested by the Copyright Holder."
   - "Modified Version" means the Package, if it has been changed, and such changes were not explicitly requested by the Copyright Holder."
   - ""Source" form means the source code, documentation source, and configuration files for the Package."
   - ""Compiled" form means the compiled bytecode, object code, binary, or any other form resulting from mechanical transformation or translation of the Source form."
   - Reading: a mechanical bundle/minify of the unmodified JS (no hand edits) is a "mechanical transformation" of Source, so it is a Compiled form of the Standard Version. Bun then embeds that output in a native binary, which is also a "binary ... resulting from mechanical transformation". The license does not rule on bundlers by name. This is an interpretation. Risk: if the build changes semantics through a patch or polyfill shim, the package could count as a Modified Version, and sections (4)/(6) would apply. A plain bundle does not.

3. Compiled form without Source, section (5): "You may Distribute Compiled forms of the Standard Version without the Source, provided that you include complete instructions on how to get the Source of the Standard Version.  Such instructions must be valid at the time of your distribution.  If these instructions, at any time while you are carrying out such distribution, become invalid, you must provide new instructions on demand or cease further distribution. If you provide valid instructions or cease distribution within thirty days after you become aware that the instructions are invalid, then you do not forfeit any of your rights under this license."
   - Obligation: ship, with each release, complete instructions for getting the Source of domain-browser 4.23.0. They must work when the release goes out. If they break, give new ones on demand or stop distributing. There is a 30-day cure window from awareness.
   - Verified live on 2026-11-16 (HTTP 200): https://registry.npmjs.org/domain-browser/-/domain-browser-4.23.0.tgz and https://github.com/bevry/domain-browser/tree/v4.23.0 .
   - "Distribute" is defined as "providing a copy of the Package or making it accessible to anyone else". A GitHub Release counts.

4. Aggregation and linking:
   - (7): "You may aggregate the Package (either the Standard Version or Modified Version) with other packages and Distribute the resulting aggregation provided that you do not charge a licensing fee for the Package.  Distributor Fees are permitted, and licensing fees for other components in the aggregation are permitted. The terms of this license apply to the use and Distribution of the Standard or Modified Versions as included in the aggregation."
   - Free-of-charge distribution on GitHub meets the no-licensing-fee condition. The GPL-3.0-or-later app is "other components"; a GPL license on those parts is not a conflict, because the Artistic terms still apply only to the Package inside it.
   - (8): "You are permitted to link Modified and Standard Versions with other works, to embed the Package in a larger work of your own, or to build stand-alone binary or bytecode versions of applications that include the Package, and Distribute the result without restriction, provided the result does not expose a direct interface to the Package."
   - Condition: the shipped app must not expose a direct interface to domain-browser (for example, re-exporting its `domain` API as the app's public API). A bundled transitive dependency used internally meets this. Open check: this was not verified for this repo's actual use (see gaps).
   - (9): "Works ... that merely extend or make use of the Package, do not, by themselves, cause the Package to be a Modified Version... not subject to the terms of this license." The GPL app code is therefore not pulled into Artistic.
   - GPL side: the GPL requires the combined work as a whole to be under GPL where it is a covered work. The Artistic license permits this under (7)/(8), with no extra restriction. The FSF compatibility verdict covers this.

5. Notice obligations:
   - (2) covers verbatim Source copies: "provided that you duplicate all of the original copyright notices and associated disclaimers". Strictly it applies to Source-form copies. It is not repeated in (5). Conservative practice, and what the repo's notices script does: ship the full license text plus the copyright line anyway.
   - (14) disclaimer: "THE PACKAGE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS" AND WITHOUT ANY EXPRESS OR IMPLIED WARRANTIES." It is not an affirmative duty, and it is included by shipping the full text.
   - (10): "By using, modifying or distributing the Package, you accept this license."
   - (12): "This license does not grant you the right to use any trademark, service mark, tradename, or logo of the Copyright Holder." Do not use the Bevry name or marks in marketing.
   - (13) patent license, with termination if you sue the Package's holder for patent infringement. Informational.

6. Approvals:
   - OSI: https://opensource.org/license/artistic-2-0 : "Approved: June 6, 2007". SPDX license-list-data (https://raw.githubusercontent.com/spdx/license-list-data/main/json/licenses.json) lists `Artistic-2.0` with isOsiApproved=true and isFsfLibre=true.
   - Debian: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/ lists "Artistic license 1.0, 2.0" among its standard short names, with the example "License: GPL-2+ or Artistic-2.0, and BSD-3-clause". It is not a formal DFSG list. The Debian wiki https://wiki.debian.org/DFSGLicenses has no Artistic 2.0 entry of its own. It says "They suggest to use the Clarified Artistic License (also called Artistic License 2.0) instead" and "the original Artistic License is still considered DFSG-free". Artistic 2.0 is OSI-approved, and Debian ships packages under it, but I found no explicit Debian allow-list line.
   - Fedora: not directly confirmed. docs.fedoraproject.org is behind Anubis and returned "Access Denied" twice. A web search summary of https://docs.fedoraproject.org/en-US/legal/allowed-licenses/ says it lists Artistic-2.0 ("Artistic 2.0" legacy name) as allowed in all categories, and that Artistic-1.0-Perl alone is not allowed. This is secondhand.

## Compliance checklist for a release

- Put the full Artistic License 2.0 text (as in the local texts file) in the third-party notices that ship with the release. Include "Copyright (c) 2013+ Bevry Pty Ltd" and the "domain-browser 4.23.0" name and version. The notices script already stores this text.
- Add the section (5) instruction line: "Source of domain-browser 4.23.0: npm tarball https://registry.npmjs.org/domain-browser/-/domain-browser-4.23.0.tgz ; git tag https://github.com/bevry/domain-browser/tree/v4.23.0". Put it in the notices file and the release notes. Re-check that the URLs resolve at each release. If one breaks, fix it within 30 days.
- State that domain-browser is bundled unmodified, so it falls under "Standard Version". Keep the build free of patches to it.
- Release must stay free of any licensing fee for the Package (GitHub free download). No charge for the package itself under (7).
- Do not expose domain-browser's API as a direct public interface of the app (8).
- Do not use Bevry's name or logo for promotion (12).

## Open gaps

- Fedora allowed-list line not read first-hand (bot wall). Debian has no explicit allow-list line for 2.0. Only secondhand and DEP-5 evidence.
- Whether a bundler's tree-shaking, minification or Bun's own transpile counts as "not modified" is an interpretation of "mechanical transformation". The license has no case law or FSF guidance on it that I found.
- Not checked: how domain-browser is actually reached in this repo's build (a transitive dependency of Bun's runtime or of a package, versus a direct import), so the (8) "no direct interface" condition is assumed to hold.
- Not checked: whether the notices script already emits the section (5) source instruction. Only the texts file was read.
- The local license text file was not diffed against the canonical SPDX text.
