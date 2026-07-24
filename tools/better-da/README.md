# Better DA

A content browser tool for Document Authoring (DA), with Tree, Taxonomy, and Gallery
views, filtering, inline metadata editing, and a self-generating content inventory.

## Add to your project

Register this tool as an app in your DA site so it shows up at `da.live/apps` and can be
launched directly.

Every value below is a literal string — DA does no substitution, so whatever you type in
the sheet is exactly what gets used. `org` and `repo` just need to match your real DA
org/repo. `image` and the `ref` inside `path` are different: they each require you to
have already produced something concrete before you can fill them in — there's no
default or shared value for either one. The example row below uses this project's real
values as of now; update `image` to your own uploaded/published thumbnail, and update
`ref` once this code merges out of `feat-better-da-content-browser`.

1. Open your site's config sheet: `https://da.live/config#/{org}/{repo}/`
2. Add (or use) an **`apps`** tab/sheet with columns: `title`, `description`, `image`,
   `path`.
3. Add a row:

   | Column | Value |
   |---|---|
   | `title` | `Better DA` |
   | `description` | `A better DA for a happier SC` |
   | `image` | `https://main--drago-toolkit--adobedevxsc.aem.page/media/gemini-generated-image-veebzbveebzbveeb.png` |
   | `path` | `https://da.live/app/{org}/{repo}/tools/better-da/better-da?org={org}&repo={repo}&ref=feat-better-da-content-browser` |

4. Save.
5. Visit `https://da.live/apps#/{org}/{repo}` — Better DA should appear as a card there.

## Content inventory (`.da/better-da.json`)

On first load, Better DA checks for `.da/better-da.json` in your repo. If it doesn't
exist, it crawls the whole repo, derives Title/Type/Status/Tags per item, and saves the
result there for next time (shown via a progress modal). You can edit any of these values
directly in the table afterward — edits save back to the same sheet.

## URL overrides

Append `?org={org}&repo={repo}` to force a specific org/repo, regardless of what DA's own
embedding context provides (useful for testing).
