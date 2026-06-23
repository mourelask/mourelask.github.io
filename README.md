# mourelask.xyz

Personal portfolio & blog — gamedev, tech art, and in-between. Built with
[Astro](https://astro.build/) and deployed to GitHub Pages.

## Develop

```sh
npm install                      # install dependencies (first time only)
npx playwright install chromium  # one-time: browser used to render the CV PDF
npm run dev                      # start the dev server at http://localhost:4321
npm run build                    # build the production site to ./dist
npm run preview                  # preview the production build locally
```

> The CV PDF (`npm run cv` / the Publish task) is rendered with headless
> Chromium via Playwright. If you ever see *"Executable doesn't exist …
> chrome-headless-shell"*, just re-run `npx playwright install chromium`.

## In VS Code

Recommended: install the **Astro** extension (VS Code will prompt you from
`.vscode/extensions.json`).

Run tasks with **Ctrl+Shift+P → "Tasks: Run Task"** (or **Ctrl+Shift+B** for
the default preview task):

- **Dev: preview site** — starts the live-reload server; Ctrl+click the
  `localhost:4321` link in the terminal to open it.
- **Build site** / **Preview production build** — build and check the final output.
- **Publish: build, commit & push** — prompts for a commit message, then
  builds, commits everything, and pushes (which triggers the GitHub Pages
  deploy). Requires the git remote to be set up once first.

> If a task reports "node not found", reload the window
> (**Ctrl+Shift+P → "Developer: Reload Window"**) so the terminal picks up the
> newly installed Node.

## Writing posts

Blog posts live in `src/content/blog/<slug>/index.md`. Each post needs this
frontmatter:

```yaml
---
title: "My post title"
description: "A short summary used in listings and meta tags."
pubDate: 2024-06-15
tags: ["unity", "shaders"]
draft: false          # optional — true hides it from the site & feed
updatedDate: 2024-06-20  # optional
---
```

Media (images, gifs, videos) goes in `public/media/blog/<slug>/` and is
referenced with an absolute path, e.g.
`![alt](/media/blog/<slug>/picture.png)` or
`<video src="/media/blog/<slug>/clip.mp4" controls loop muted playsinline></video>`.

Edit the About page at `src/pages/about.mdx`, and site-wide settings
(title, nav, social links) in `src/consts.ts`.

## CV / résumé

`src/data/resume.ts` is the single source of truth for your experience,
education and skills. It feeds **all three** of:

- the About page's Experience / Education / Skills sections,
- the print-styled `/cv` page, and
- the downloadable PDF (`public/Konstantinos_Mourelas_CV.pdf`).

Edit `resume.ts`, then run `npm run cv` to rebuild and regenerate the PDF
(the Publish task does this automatically). Preview the CV layout at `/cv`.

## Deploying

Pushing to `main` triggers the workflow in `.github/workflows/deploy.yml`,
which builds the site and publishes it to GitHub Pages.

One-time setup on GitHub: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

### URL configuration

`astro.config.mjs` controls the deployed URL:

- **Custom domain** (e.g. `mourelask.xyz`) or **user site**
  (`<username>.github.io`): set `site` accordingly and keep `base: "/"`.
- **Project repo** (`<username>.github.io/<repo>/`): set
  `base: "/<repo>/"`. Note that the media in `public/` is referenced with
  absolute `/media/...` paths, so a project-repo base would require prefixing
  those — a custom domain or user site is the simpler path.

For a custom domain, also add a `public/CNAME` file containing the domain
(e.g. `mourelask.xyz`).
