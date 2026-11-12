# CLAUDE.md

## Project overview

Custom JavaScript for a Webflow page, published to npm as `@aw-webflow/security_page` and consumed via the jsDelivr CDN.

- Source: `script.js` (bundled by Parcel)

## Code style

All code must use `var` and ES5 syntax (no `let`/`const`, arrow functions, or template literals) for browser compatibility.

## Deployment

1. Push to GitHub
2. Bump the version in `package.json`, then `npm publish --access public`
3. jsDelivr serves it at `https://cdn.jsdelivr.net/npm/@aw-webflow/security_page@<version>/script.min.js`
4. Update the `<script>` tag in Webflow to the new version
