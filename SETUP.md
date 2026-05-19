# Setup — first push to GitHub

The package is initialised as a git repo locally with one commit. To get it onto GitHub so your dev friend can install from it:

## 1. Create the empty GitHub repo

In a browser, go to <https://github.com/new>:

- **Repository name**: `match-shapes`
- **Owner**: `itaydreyfus`
- **Visibility**: public (private also works, but your friend will need to be added as a collaborator OR install via a deploy key)
- **Don't initialise** with a README/LICENSE/.gitignore — those already exist locally.
- Click **Create repository**.

## 2. Push from this machine

```bash
cd /Users/itaydre/match-shapes
git remote add origin git@github.com:itaydre/match-shapes.git
git push -u origin main
```

(Use the `https://github.com/...` URL instead of `git@` if you don't have SSH keys configured.)

The first push will also trigger the auto-release workflow once GitHub Actions runs.

## 3. Tell your dev friend to install it

In their project's `package.json`:

```json
{
  "dependencies": {
    "match-shapes": "github:itaydre/match-shapes#main"
  }
}
```

Then `npm install`.

## 4. Daily workflow — making changes available

```bash
cd /Users/itaydre/match-shapes
# Edit src/showcaseShapes.tsx (add shape, tweak params, etc.)
git add -A
git commit -m "Tweak vortex_disc spinner camera"
git push
```

On their next deploy / `npm install`, your friend's app picks up the change.

For **truly hands-off propagation**, your friend can set up:

- **Dependabot** on their repo (auto-PRs updates when `main` of `match-shapes` advances) — `.github/dependabot.yml` with `package-ecosystem: npm` and a daily schedule.
- **A scheduled CI rebuild** (e.g., GitHub Actions cron at `0 6 * * *` that runs `npm update match-shapes` and redeploys).
- **Pin to commits** (`#<sha>`) — opposite tradeoff: pinned = stable but manual updates.

## 5. Bumping the version (optional)

The auto-release workflow tags every push with a date-stamped version. If you want manually-managed semver tags too:

```bash
# Edit package.json — bump "version": "0.1.0" → "0.2.0"
git add package.json
git commit -m "Release 0.2.0"
git tag v0.2.0
git push --tags
```

Then your friend can pin to that:

```json
"match-shapes": "github:itaydre/match-shapes#v0.2.0"
```
