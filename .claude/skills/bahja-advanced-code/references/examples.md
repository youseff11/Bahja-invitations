# Which snippet to start from

All of these are in `docs/snippets/`. Read the closest one before writing; they already solve the mounting quirks.

| Need | Start from | Why |
|---|---|---|
| Full-screen intro with interaction (envelope, seal, card) | `intro-wedding-lilly-yousef-luxe.html` | The most polished reference:<br>• velvet background, gold frame symbols<br>• wax seal halves cloned by script<br>• canvas petals and dust<br>• timed class sequence, `__lbIntro.open()`, `is-done` cleanup |
| Same, simpler or older look | `intro-wedding-lilly-yousef.html` | The pre-upgrade version, useful to compare against |
| Text over the intro **video** | `intro-engagement-zein-yara.html` | Overlay text timed with the intro video, no cover |
| Text over a **section video** (cover/hero) | `engagement-tarek-laila.html`, `engagement-zein-yara-v2.html` | The video-sized root plus the `ResizeObserver` fit and translate correction; animations start after the intro opens |
| Cover / hero section replacing the default names | `hero-wedding-yousef-lilly.html`, `hero-white-roses.html`, `engagement-kirollos-mary.html`, `cover-christian-youssef-marina.html` | Hiding the template's own name/date and rendering custom ones |
| Quran verse (آية) section | `ayah-gold-frame-luxe.html`, `ayah-gold-frame-delicate.html`, `ayah-gold-glass.html`, `ayah-white-minimal.html`, `ayah-arch-roses.html` | Arabic typography inside gold frames. The ayah pulse lesson (opacity only) applies here |
| Christian verse | `verse-christian-gold-frame.html`, `verse-christian-wedding-gold-frame.html` | |
| Countdown | `countdown-gold-rings.html` | |
| Ceremony time / clock | `ceremony-clock.html` | |
| Timeline / story | `timeline-gold-path.html`, `timeline-engagement-slides.html` (RTL-safe arrows), `timeline-engagement-clock.html` | |
| Agenda | `agenda-christian-wedding.html` | |
| Location | `location-christian-gold.html`, `location-christian-ivory.html` | |
| RSVP styling | `rsvp-gold-light.html` | Styles the app's own RSVP block (`.lb-rsvp-*`) |

Name new files `<kind>-<event>-<names>[-variant].html`, for example `intro-engagement-omar-nour.html`.
