# Better DA

A content browser tool for Document Authoring (DA), with Tree, Taxonomy, and Gallery
views, filtering, inline metadata editing, and a self-generating content inventory.

## Add to your project

Register this tool as an app in your DA site so it shows up at `da.live/apps` and can be
launched directly.

Every value below is a literal string — DA does no substitution, so whatever you type in
the sheet is exactly what gets used. `org` and `repo` just need to match your real DA
org/repo. `image` and the `ref` inside `path` are different: they each require you to
have already produced something concrete before you can fill them in (see the callouts
below the table) — there's no default or shared value for either one.

1. Open your site's config sheet: `https://da.live/config#/{org}/{repo}/`
2. Add (or use) an **`apps`** tab/sheet with columns: `title`, `description`, `image`,
   `path`.
3. Add a row:

   | Column | Value |
   |---|---|
   | `title` | `Better DA` |
   | `description` | `A better DA for a happier SC` |
   | `image` | a hardcoded URL to a thumbnail *you've* uploaded and published (see below) |
   | `path` | `https://da.live/app/{org}/{repo}/tools/better-da/better-da?org={org}&repo={repo}&ref={ref}` |

4. Save.
5. Visit `https://da.live/apps#/{org}/{repo}` — Better DA should appear as a card there.

**`image` — you must upload and publish one first.** There's no shared/default thumbnail.
Upload an image to your repo (e.g. under `/media/`), publish it, then use its resolved
URL — `https://main--{repo}--{org}.aem.page/media/your-thumbnail.png` (or `.aem.live` once
published to production). Paste that literal URL into the `image` column.

**`ref` — a real branch name, hardcoded, not auto-resolved.** This code currently only
lives on the `feat/better-da-content-browser` branch (not `main`), so until it merges,
`ref` in the `path` value has to be that branch name with slashes replaced by dashes:
`ref=feat-better-da-content-browser`. Once the branch merges to your default branch,
you must go back and edit the `apps` sheet's `path` value to `ref=main` (or drop
`&ref=...` entirely) — DA won't update this for you, and the card will keep pointing at
the old branch until you do.

## Content inventory (`.da/better-da.json`)

On first load, Better DA checks for `.da/better-da.json` in your repo. If it doesn't
exist, it crawls the whole repo, derives Title/Type/Status/Tags per item, and saves the
result there for next time (shown via a progress modal). You can edit any of these values
directly in the table afterward — edits save back to the same sheet.

## URL overrides

Append `?org={org}&repo={repo}` to force a specific org/repo, regardless of what DA's own
embedding context provides (useful for testing).
