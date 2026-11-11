# Four Pulls

A static Hacktoberfest chapter page that becomes a short review game. It looks like an event site: a live strip, a green header, four pull requests in the hero, and a 16:9 frame where a session video would sit. Press **Play** and that frame is the desk. Mark the red bugs, leave the yellow notes, and merge four pulls before the three reviews run out.

Scores stay in this browser (`localStorage`). The site has no server, no accounts, and no secrets.

## Play

1. Read the review line above the files.
2. Press the cells marked **Bug**. Notes and clean files cost a review.
3. Clear three rounds to stamp a pull **Merged.**
4. Pull 3 swaps the files once. Pull 4 keeps the marks moving.
5. Leave three letters if you want the score on the board. The board is the top five on this computer.

Keyboard: arrow keys move between files, Enter or Space marks the focused file. The header button **Open a PR** scrolls to the desk.

## Run it locally

```bash
npm install
npm run dev
```

The dev server is [http://127.0.0.1:4731](http://127.0.0.1:4731).

```bash
npm test
npm run build
npm run preview
```

`npm run build` writes a static site to `dist/`.

## Deploy on GitHub Pages

The Vite `base` is `./`, so every asset URL is relative. The same `dist` folder works for a project site (`https://<user>.github.io/<repo>/`) and a user site (`https://<user>.github.io/`).

### GitHub Actions

1. Push this repository to GitHub.
2. In the repo, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs the tests, builds `dist`, and deploys it on every push to `main`.

The first deploy needs the Pages source set to GitHub Actions, or the workflow will fail until that setting exists.

### By hand

```bash
npm run build
```

Upload the contents of `dist/` as the Pages artifact, or push that folder to a `gh-pages` branch. `dist` already contains `index.html`, hashed CSS and JS, the gallery, the favicon, and `.nojekyll` (so GitHub’s Jekyll step does not touch the files). Do not publish the repository root. The dev server is not part of the site.

## Design

The page follows a Hacktoberfest 2026 neo-brutalist system: ink `#10201d`, paper, coral buttons with a hard wine shadow, Barlow Semi Condensed headings, Martian Mono labels, and square corners. Gallery pictures are generated scenes, captioned as cities, and the alt text says they are generated.
