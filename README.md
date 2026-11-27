# Luke Diepenhorst

Static GitHub Pages site, served from the root of `main`.

Live site: https://lukediepenhorst.github.io

## Pages

- [Luke Diepenhorst - Projects](https://lukediepenhorst.github.io/) — landing page
- [Luke's Bot HQ](https://lukediepenhorst.github.io/bot-hq/) — branded low-poly HQ where nine bots walk, meet, and carry files
- [Tulip City Lawn Care](https://lukediepenhorst.github.io/tulip-city-lawn-care/) — fictional demo business (Holland, Michigan)
- [Honolulu Blue Tailgate Co.](https://lukediepenhorst.github.io/honolulu-blue-tailgate/) — fictional demo business (Detroit watch-party site; not affiliated with the NFL or the Detroit Lions)

There is no build step and no server. Any static file server pointed at this folder will do.

## Bot statuses

Statuses on the Bot HQ floor come from [`bot-hq/status.json`](bot-hq/status.json). Edit that file by hand, keep `lastUpdated` current, and refresh the page.

Use one of these status strings:

- `Working`
- `Idle`
- `Waiting on Luke`
- `Done`

The page says the statuses are sample data. The checked-in values are a sample, not a live feed.

Add `?debug=1` to the Bot HQ URL to draw the hallways the bots walk. If a desk is moved onto a hallway, the browser console names the collision.
