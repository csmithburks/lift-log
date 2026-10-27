# Lift Log

> A full-featured, Strong-style workout tracker I built for myself. It runs as an iPhone home-screen app with no App Store, no account and no subscription, and it imports an existing Strong history so switching costs nothing.

**Built with:** Expo / React Native (≈4,000 lines of JavaScript) · runs in Expo Go and as an installable web app (PWA) · all data stays on the phone

---

## What shaped the build

1. **Zero switching cost.** It imports a Strong CSV export, so history, PRs and charts come across on day one. Adoption problems are usually migration problems.
2. **Train the way people actually train.** Supersets, timed holds, carries and rowing intervals are first-class, not hacks on top of weight × reps.
3. **No laptop needed after setup.** It's deployed once as a web app, saved to the iPhone home screen, and picks up new versions on the next launch after a redeploy.

## Features

**Train**
- Templates: create, edit, reorder, start a workout from one, save any finished workout as a template
- Live workout: timer, notes, warm-up/drop/failure sets, a "Previous" column, reorder exercises
- Rest timer with ±15s and skip, plus per-exercise and per-superset rest times saved in templates
- **Supersets:** link exercises, and rest starts only after the last exercise in the round

**Beyond weight × reps**
- Five exercise types: weight & reps, time, distance & time, weight & time, weight & distance. That covers rowing, running, planks, farmer's walks and sled pushes.
- Built-in stopwatch for timed sets, pace calculation, and time/distance PRs

**Progress**
- Personal records detected when you finish (heaviest, estimated 1RM, set volume)
- Exercise charts (est. 1RM, heaviest, volume, reps), records and history
- Weekly volume chart on the profile

**Own your data**
- Import Strong's CSV · export CSV · full JSON backup and restore

## Product decisions

| Decision | Why |
|---|---|
| Local-first storage (AsyncStorage) | No backend to run or pay for, it works offline in the gym, and there's no account to create |
| Web app on the home screen instead of the App Store | Skips the review process and the $99/yr developer fee; one deploy updates the phone |
| Strong CSV import as a launch feature | Removes the biggest reason not to switch |
| Exercise "kinds" as data (`src/kinds.js`) | Adding a new measurement type means adding a config entry, not new screens |

## Project structure

```
App.js                      # navigation shell
src/WorkoutScreen.js        # live workout, sets, supersets, rest timer
src/HistoryScreen.js        # past workouts, repeat a workout
src/ExercisesScreen.js      # per-exercise charts and records
src/ProfileScreen.js        # weekly chart, settings, import/export
src/kinds.js                # exercise measurement types
src/csv.js                  # Strong CSV import / CSV export
src/components/             # TemplateEditor, RestTimerBar, LineChart, WeeklyBars…
```

## Run it

```bash
npm install
npx expo start                 # open in Expo Go
npx expo export -p web         # build the web app
npx eas-cli@latest deploy --prod
```

Open the deployed URL in Safari → Share → **Add to Home Screen**.

<!-- TODO Chris: add 2-3 phone screenshots (live workout, exercise chart, history) in docs/ and link them here -->

---

*Built by [Chris Smith-Burks](https://www.linkedin.com/in/christophersmith-burks) with Claude as a pair programmer. Not affiliated with Strong; Lift Log only reads its CSV export format.*
