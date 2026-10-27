# Leisure Suit Jeff: EGA Remix

An 80s Sierra-style, parser-driven adventure, remixed with 16-color EGA pixel art in place of the original ASCII scenes. Type commands like `look`, `take report`, `give cake to merv`, or `go to costco`.

**Play online:** https://fullstackjefsong.github.io/leisure-suit-jeff-ega-remix/

**Stuck?** Read the 1987-style magazine strategy guide: https://fullstackjefsong.github.io/leisure-suit-jeff-ega-remix/walkthrough.html (spoilers!)

Act I: "In Search of the Lost Paycheck" — get paid, fix the car, clean the suit, and get a good night's sleep before the reunion.

Features an original AdLib-style FM soundtrack (swing lounge title theme, a theme for each location, jingles and sound effects), synthesized live in the browser. Type `SOUND OFF` or click ♪ to mute.

The title screen and all 12 rooms are painted pixel-by-pixel into a 320x200 canvas using the fixed 16-color EGA palette (`js/graphics.js`), and change as you take items, fix the car, and so on. Story, parser, puzzles, and soundtrack are identical to the original [Leisure Suit Jeff](https://github.com/fullstackjefsong/leisure-suit-jeff).

- Run locally: open `index.html` in a browser.
- Tests: `node test/walkthrough.js`
- Design notes: [DESIGN.md](DESIGN.md)
