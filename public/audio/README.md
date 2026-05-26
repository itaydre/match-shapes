# Match-card audio assets

The `MatchBrazilArgentina` composition expects three files in this folder:

| File | Purpose | Suggested length |
|---|---|---|
| `crowd.mp3` | Stadium ambience, loops underneath the whole video | 5–15 s |
| `goal.mp3` | Single "GOOOOL" cheer, played once per goal | 2–4 s |
| `whistle.mp3` | Final whistle, played at full-time | 1–2 s |

Drop royalty-free `.mp3` files at exactly those paths. Recommended sources (CC0 / royalty-free):

- https://pixabay.com/sound-effects/search/crowd/
- https://mixkit.co/free-sound-effects/sport/
- https://freesound.org (sort by CC0)

After adding files, render:

```
npx remotion render MatchBrazilArgentina out/br-ar.mp4
```
