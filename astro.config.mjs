// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Update `site` to your final URL. For a custom domain use e.g. "https://mourelask.xyz".
  // For a GitHub user/org site use "https://<username>.github.io".
  site: "https://mourelask.github.io",
  // If you deploy to a *project* repo (https://<username>.github.io/<repo>/),
  // set base to "/<repo>/". For a user site or custom domain, leave it as "/".
  base: "/",
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: "github-dark-default",
      wrap: false,
    },
  },
});
