# Cultivation System — Design To-Do

Oct 13, 2026 · @Ricardo Gobbi

Every item is a design decision or feature to settle before choosing a framework. Items tagged **\[v1\]** are the smallest slice worth dogfooding for a month; untagged items wait until the core loops prove they hold attention.

## Three paths, three progression models

Each path gets its own math because each grows differently: Main compounds, Body peaks and declines, Soul fluctuates.

| Path | Progress stat | Can it go down? | What earns it | Advancement judged by |
| --- | --- | --- | --- | --- |
| Main | Realm + level (Step 1) or realm tribulations (Nascent Soul and above), plus a class | No | Study, work, research, and any Body/Soul discipline with tangible output | Pre-committed external tribulations |
| Body | Skill ranks (permanent) + fitness tier from the companion's food meter (current) | Skill no; tier yes | Routines pay gold and feed the companion; mastery evidence earns ranks | User-defined mastery per skill; consistency for tiers |
| Soul | Soul color, computed from heart-demon HP | Yes, by design | Winning against heart demons | Demons defeated with none above 70% HP; affects game rewards only, never breakthroughs |

### Main

- [ ] &#91;v1\] Qi Condensation interview: the cultivator's interests for Main, Body and Soul
- [ ] &#91;v1\] Exploration quests for undecided areas; research quests when the cultivator hits a bottleneck
- [ ] &#91;v1\] Foundation Establishment: starter quests to begin practicing, plus dated tribulations for mid, late and great circle, sized to current abilities
- [ ] &#91;v1\] Fast track: a cultivator already in the discipline defines Foundation tribulations and proves they are passed
- [ ] Foundation switch rule: free right after a tribulation, costs Qi mid-level (discourages quitting too early)
- [ ] Class selection at the end of Foundation: ask whether the core discipline relates to Body, Soul, both or neither
- [ ] Core Formation: guide tribulations that define "professional" in the discipline; levels advance at 30/60/90% of tribulations passed, Nascent Soul at 100%; adding a tribulation later lowers the percentage but never the level already reached
- [ ] Nascent Soul: guide tribulations that define "expert"; offer a research quest when unsure; warn against changing them out of self-doubt or overconfidence
- [ ] Spirit Realm: force selecting a new discipline; tribulations are studies and combinations that may shift with findings
- [ ] Realm intro screens stating each realm's purpose and its self-check question (e.g., "Am I an expert, or am I lacking something?")
- [ ] Lore: Nascent Soul needs luck, realms above it need luck and destiny, and no one has demonstrably reached Immortal, which keeps the dream alive
- [ ] Write example tribulations for each realm from Void God to Immortal

**Core realms**

| Step | Realm | Purpose | Levels | Breakthrough |
| --- | --- | --- | --- | --- |
| 1 | Qi Condensation | Discover interests in Main, Body and Soul | Early: interview answered. Mid: 1 area decided. Late: 2. Great circle: 3 | First tribulation: all three areas chosen (changeable later for a price) |
| 1 | Foundation Establishment | Start practicing and test the chosen path | One dated tribulation per level (mid, late, great circle) | All passed; then form a core or change foundation for free, and choose a class |
| 1 | Core Formation (Golden Core) | Become a professional; consistency over single wins | 30% of tribulations: mid. 60%: late. 90%: great circle | 100%: "I consider myself a professional" |
| 1 | Nascent Soul | Become an expert; needs some luck | Tribulations set on entry | All passed: "I consider myself an expert" |
| 2 | Spirit Realm | Study new disciplines and combine them into your own dao | Exploratory tribulations that may shift with findings | You know the bases to create a new discipline |
| 3 | Void God | Forge your own discipline and earn recognition | Tribulations for the discipline to count as real | Discipline recognized |
| 4 | Golden God | Turn recognition into real-world achievements | Real-world achievement tribulations | Followers appear |
| 5 | True God | Build a community with rules that keeps growing | Tribulations that create a legacy | Followers pursue the path on their own |
| 6 | Sovereign | Sustain a legacy over years | Milestones until nothing is left to learn or achieve | Nothing more to learn |
| 7 | Immortal | Challenge your own dao to protect the truth | Endless tribulations that try to prove the zenith wasn't reached | Final realm; no tribulation can break you |

### Classes

Classes customize how tasks count across paths, so a fighter's training routine can also be core cultivation. They don't depend on the discipline (a dancer may pick any class) and can be changed with gold. The more paths a class covers, the lower its gold bonus: Unique (core only) highest, Soul or Body (dual) middle, Hybrid (triple) lowest.

- [ ] &#91;v1\] Class choice at the end of Foundation Establishment, grouped as Soul, Body, Hybrid and Unique
- [ ] &#91;v1\] Cross-path tasks: a core quest or task can be tagged to also count for Body (as a routine paying gold) or Soul (damage to a chosen heart demon), as the class group allows; logged once, never twice
- [ ] &#91;v1\] Class gold and Qi bonuses apply to all gains and come from the current class only; switching replaces them, never stacks
- [ ] Class change in the gold shop; changing class forfeits all soul and pet wearables
- [ ] Soul class drops after a successful tribulation: soul wearables (e.g., freeze a heart demon for a week); legendary ones add visuals and bonus demon damage
- [ ] Body class drops after a successful tribulation: pet wearables (e.g., keep the Lion for a month, or a halo ticket); legendary ones add visuals and bonus gold
- [ ] Hybrid class drops after a successful tribulation: a soul wearable or a pet wearable (50/50), never both
- [ ] Unique class drops: +2% legendary chance after a tribulation
- [ ] Class drops never amplify negative soul effects
- [ ] Avatar look changes with class
- [ ] Class gear (robes, weapons, items) per class; off-class gear keeps only 20% of its bonus
- [ ] Spirit Realm: the class locks on entry, then the soul takes the class avatar's form; class bonuses and drops multiply by step (×2 in Step 2 up to ×7 in Step 7)

**Gaps**

None open.

| Group | Class | Gold | Qi | Core tasks can also hone | Class drops after a tribulation |
| --- | --- | --- | --- | --- | --- |
| Soul | Bard | +10% | +2% | Soul (demon damage) | Soul wearable |
| Soul | Erudite | +2% | +10% | Soul (demon damage) | Soul wearable |
| Body | Warrior | +10% | +2% | Body (routine gold) | Pet wearable |
| Body | Knight | +2% | +10% | Body (routine gold) | Pet wearable |
| Hybrid | Dancer | +1% | +7% | Body and Soul | Soul or pet wearable (50/50) |
| Hybrid | Acrobat | +7% | +1% | Body and Soul | Soul or pet wearable (50/50) |
| Unique | Monk | +15% | +5% | — | +2% legendary chance |
| Unique | Sorcerer | +5% | +15% | — | +2% legendary chance |

### Body

Body splits into Skill, which unlocks poses that are never lost, and the fitness tier, a companion animal fed by consistent training that leaves if neglected. The avatar's body shape never changes.

- [ ] &#91;v1\] Skill: user-defined disciplines with user-defined ranks; the user decides what mastery means (e.g., blue belt in BJJ, clean deadlift technique past a bodyweight threshold); ranks are never lost
- [ ] &#91;v1\] Mastery evidence: a photo (belt, credential) or a link (video); editable when the skill improves further
- [ ] &#91;v1\] Exercises and routines defined and adjusted by the user; show average values for their bodyweight and age group as reference only
- [ ] &#91;v1\] Each logged exercise or routine pays gold to the cultivator and treats to the companion: an exercise gives 10, a routine (dance class, BJJ session, gym routine) gives 200; at most 2 routines a day count
- [ ] &#91;v1\] Turtle can be fed with single exercises; from Panda on, the user creates routines, since exercises alone can't keep up with daily food loss
- [ ] &#91;v1\] Companion food meter: 100% promotes to the next animal, 0% demotes; the new animal starts at 50% in both directions
- [ ] &#91;v1\] The Turtle never leaves: at 0% it stays hungry until fed
- [ ] &#91;v1\] Daily food loss scaled by tier, sized so each tier holds at its target cadence (food economy table below)
- [ ] &#91;v1\] Food repetition decay penalizes stagnation, not consistency: a version of an exercise or routine pays full treats and gold for 4 weeks after its first completion, however often it is done, then loses 15% a week down to 25% until the cultivator levels it up ("BJJ" → "BJJ II")
- [ ] &#91;v1\] Companion animal per tier, with behavior animations; the avatar's body never changes
- [ ] Companion behaviors fire once a day (tier table below)
- [ ] Equipment durability: damage accumulates on one random equipped item; at 100% the item is lost; repair with gold, cost scaled by the item's tier
- [ ] Pricing rule: repairing one item always costs less than the Qi and gold a failed tribulation takes without gear, legendary items included
- [ ] Avatar warning when equipment is close to breaking ("My equipment is almost broken; I should repair it before it's lost")
- [ ] Failing a tribulation deals 20% damage to one random equipped item, while the gear reduces the Qi and gold lost
- [ ] Breakthrough attempt cinematic; the Horse never unequips during it
- [ ] Lion petting: once a day, a small amount of Qi
- [ ] Lion pet wearable keeps the Lion tier (bonuses included) for a month
- [ ] Golden ticket: with the Lion at 100% food, each completed routine earns a ticket for the roulette (odds table below)
- [ ] Golden dragon scale: a wearable worth +5% Qi and +10% gold gains, compounding with each scale worn; the "legend of the nine scales" lore entry
- [ ] Golden wings: wearing nine scales unlocks a creation cinematic; the scales merge into the wings and free their slots; the wings give +50% Qi gains and +100% gold gains, never break, and only one set can be worn
- [ ] Anomaly flag: a second set of wings on one account is logged as a likely bug or exploit
- [ ] Poses unlocked by number of skills mastered (Standing to King); never lost
- [ ] Halo: one halo and one ticket per skill mastered; halo hidden 1 month after the last mastery; one ticket per breakthrough, extras saved until 3 months after their mastery

**Gaps**

None open.

**Fitness tiers** (from the companion's food meter)

| Tier | Companion behavior (once a day) | Equipment damage | Daily food loss | Gold after exercise | Qi on core tasks/quests | Extra |
| --- | --- | --- | --- | --- | --- | --- |
| Turtle | Bites you | 5% | Lowest | +1% | — | — |
| Panda | Sits on you | 3% | Low | +10% | — | — |
| Horse | Throws you off and unequips gear and weapons (never during a breakthrough attempt) | 2% | Medium | +20% | +10% | — |
| Tiger | Scares you with its claws | 1% | High | +30% | +15% | — |
| Lion | Protects you; pet it once a day for a little Qi | — | Highest | +35% | +15% | 2% legendary item chance after a breakthrough |

**Food economy** (exercise = 10 treats, routine = 200, at most 2 routines a day; verify in the economy simulator)

| Tier | Target cadence | Meter size | Weekly treat loss | Promotion | Demotion with no training |
| --- | --- | --- | --- | --- | --- |
| Turtle | 1 workout day a week (about 3 exercises) | 30 | 10 | Under 1 week at 3 exercises a week | Never leaves |
| Panda | Holds at 1 routine a week | 800 | 200 | 2 weeks at 2 routines a week | 2 weeks |
| Horse | Holds at 1.5 routines a week | 1,600 | 300 | 8 weeks at 2 a week, under 3 at 3 a week | About 3 weeks |
| Tiger | Holds at 2 routines a week | 3,200 | 400 | 8 weeks at 3 a week, about 4 at 4 a week | 4 weeks |
| Lion | Holds at 2.5 routines a week; 3+ earns golden tickets | 5,000 | 500 | — | 5 weeks (about 25 at 2 a week) |

**Golden ticket roulette**

| Prize | Chance |
| --- | --- |
| Gold | 50% |
| Qi | 30% |
| Potion | 18% |
| Legendary item | 1.9% |
| Golden dragon scale | 0.1% |

**Poses** (from Skill, never lost)

| Pose | Requirement | Bonus |
| --- | --- | --- |
| Standing | Default | — |
| Heroic | 1 skill mastered | +1% Qi gains |
| Warrior | 3 skills mastered | +2% |
| Knight | 6 skills mastered | +3% |
| King | 10 skills mastered | +5% |

**Halo** (an adornment above the avatar, not a pose): each skill mastered grants a halo and one halo ticket. The halo stays visible for 1 month after the last mastery. A ticket from a mastery in the last 3 months adds +10% legendary item chance to the next breakthrough; one ticket per breakthrough, extras saved.

### Soul

Soul training is exploring and expressing yourself. Soul tasks fight heart demons, and the demons' HP sets the Soul color, which changes game rewards only, never breakthroughs.

- [ ] &#91;v1\] Soul tasks: meditation, journaling, therapy, artistic work; every completed soul task damages its linked heart demon
- [ ] &#91;v1\] Weakening colors trigger on any single demon: Violet above 70% HP, Black above 80%, Broken above 90% (or no demon defined); more demons means more ways to fall
- [ ] &#91;v1\] Soul color evaluated at the end of the day, so a demon that crosses 70% can still be pushed back before the drop
- [ ] &#91;v1\] Growth colors require no demon above 70%, plus minimums of demons created and defeated: Green 1 and 1, Blue 3 and 3, Red 6 and 6, Golden all defeated with at least 7
- [ ] &#91;v1\] Identifying the first demon moves the cultivator from Broken to White
- [ ] &#91;v1\] One drop roll per completed soul task, at the current color's rates
- [ ] &#91;v1\] Translucent and Rainbow clocks reset when any defeated demon revives

**Gaps**

None open; renaming has no lock while the demon is undefeated.

| Soul | Condition | Reward effect per soul task |
| --- | --- | --- |
| Rainbow | No demon revived for 1 year | 40% gold chance, 20% legendary item chance |
| Translucent | No demon revived for 1 month | 10% gold chance |
| Golden | All demons defeated (at least 7), no revival for 1 week | 8% gain chance (items, gold or Qi) |
| Red | At least 6 demons created and 6 defeated | 6% gain chance |
| Blue | At least 3 demons created and 3 defeated | 4% gain chance |
| Green | At least 1 demon defeated | 2% gain chance |
| White | At least 1 demon defined (demons start at 50% HP) | Neutral |
| Violet | Any demon above 70% HP | 5% loss chance (items, gold or Qi) |
| Black | Any demon above 80% HP | 10% chance of losing gold |
| Broken | Any demon above 90% HP, or no demon defined | 20% chance of losing gold, 5% chance of losing an item |

## Progression loops

Something must pay out every few minutes, every few weeks and every few years; the middle loop is the one Habitica lacks.

- [ ] &#91;v1\] Inner loop (minutes): one-tap task completion with instant Qi or gold, treats for the companion or damage to a demon, and a short System message
- [ ] &#91;v1\] Middle loop (1–3 weeks): a level, skill rank, companion tier or defeated demon at least every few weeks per active path
- [ ] &#91;v1\] Outer loop (months to years): realm breakthroughs through tribulations
- [ ] No combined character level: the realm is the headline, and Body and Soul show as the companion and the aura
- [ ] Target cadence table: expected time per layer and per realm for a consistent user, used to tune numbers
- [ ] Suggested quests from the cultivator's own paths (exploration, research, seek new demons); every other task and quest is created by the cultivator

## Economy

Qi pays for breakthroughs and gold buys gear and rest; repeated tasks pay less each time, so only harder, more complex quests keep Qi flowing, which is the anti-stagnation mechanic.

- [ ] &#91;v1\] Qi is the breakthrough currency; each realm and level sets a Qi threshold
- [ ] &#91;v1\] Tasks and quests created by the user; a quest bundles several tasks to raise complexity
- [ ] &#91;v1\] Quests and tasks expire at their deadline or when completed
- [ ] &#91;v1\] One paid extension per expired task or quest, for gold, no longer than its original duration; unpaid, it disappears
- [ ] &#91;v1\] Difficulty self-rating per task, relative to current abilities: trivial, easy, mid, hard, deadly
- [ ] &#91;v1\] Qi scales with difficulty and complexity; simple tasks pay well in the first two realms and taper off above
- [ ] &#91;v1\] Repetition decay: the first two repeats within a level pay full Qi; each later repeat loses 15% of the base, down to a 25% floor
- [ ] &#91;v1\] Raising a task's difficulty requires a new named version (Math exercise → Math exercise II)
- [ ] Avatar warning on heavy repetition: "I've completed 'Math exercise' too many times; I need to make it harder to keep growing"
- [ ] &#91;v1\] Gold scales with difficulty, number of tasks and duration
- [ ] &#91;v1\] Procrastination tax on every path (Main, Body, Soul) after a set number of days without activity there; a class's cross-credit counts as activity on the paths it covers; the tax hits Qi and gold only, never realm progress, and debt is capped; the Body and Soul taxes are 1/5 of the Main tax
- [ ] &#91;v1\] Bonus stacking: every percentage bonus (fitness tier, pose, soul color, class with its Spirit Realm multiplier, items, potions) adds into one pool; scales and wings multiply the total
- [ ] Legendary chances add when several apply to the same event (e.g., Lion 2% + halo ticket 10% + Unique class 2% = 14%); one legendary pool per realm
- [ ] Gold shop: vacations, wearables, armor, weapons, potions, class changes, repairs, extensions
- [ ] Armor reduces Qi losses (e.g., 10 fewer lost); weapons add to Qi gains (e.g., +10); potions boost gold and Qi gains; legendary items boost more
- [ ] Items are locked to the current realm; on breakthrough, equipped gear levels up with the cultivator
- [ ] Potions that raise the chance of gear turning legendary when it levels up at a breakthrough
- [ ] Rare drops on quest completion to keep a variable-reward element
- [ ] Economy simulator: a year of synthetic behavior to check inflation, pacing and the numbers flagged across this doc

**Gaps**

- [ ] Numbers for the simulator: the Main tax's grace period and amount, extension prices, vacation lengths and prices, and the Qi cost of editing tribulations or changing discipline

## Breakthroughs and tribulations

A breakthrough is only claimable against criteria written before the attempt, which keeps faking possible but deliberate.

- [ ] &#91;v1\] Declare a tribulation: specific, checkable result plus a deadline, written before starting
- [ ] &#91;v1\] A breakthrough needs both the realm/level Qi threshold and the tribulations passed
- [ ] &#91;v1\] Lock criteria once declared; editing or deleting a tribulation costs Qi in every step and is logged visibly (a cultivator may discover a tribulation was wrong or needs to be more specific); adding one is free in Step 1; the only free change is switching the foundation discipline right after a Foundation tribulation
- [ ] &#91;v1\] Claim flow: optional LLM review that flags points the cultivator may have missed; the cultivator decides and confirms "I solemnly swear I have passed this tribulation"; optional evidence attachment (file, link, photo)
- [ ] &#91;v1\] Missed deadline: no extensions; the tribulation fails, Qi is lost, and it stays in place for the cultivator to set a new date; extra tasks are required before the next attempt, even if the result is now within reach
- [ ] &#91;v1\] Adding tribulations never demotes a level; changing the core discipline costs Qi and sends the cultivator back to early Core Formation, not Foundation
- [ ] Verified vs. self-reported badge on each breakthrough
- [ ] Manual override to advance any realm, logged as such (the game must remain finishable)
- [ ] &#91;v1\] Tribulation passed with Qi short: marked "passed, waiting for Qi"; the breakthrough triggers once the threshold is reached

**Gaps**

None open.

## Rest, failure and recovery

The comeback after a bad week must cost less than quitting the app, or users leave.

- [ ] &#91;v1\] Vacations: rest periods bought with gold; the avatar travels to visit the Nine Marvels; tribulation deadlines keep their dates, and the request screen says so
- [ ] &#91;v1\] Closed-door cultivation: a free "feeling ill / burnout" button; the avatar enters a cave; up to 14 days at a time and 30 days per quarter; tribulation deadlines extend by the days spent inside, and the request screen says so
- [ ] &#91;v1\] While resting (vacation or closed-door): no tax, the companion sleeps (no food loss) and the soul is frozen (no demon growth)
- [ ] &#91;v1\] Qi deviation: entered when procrastination-tax debt hits its cap; a short comeback quest clears both the state and the debt

**Gaps**

None open.

## Heart demons and vows

A heart demon is a thought, feeling, mood or behavior the cultivator wants to change. Demons grow on their own unless fought, so ignoring Soul never protects you from them.

- [ ] &#91;v1\] Create a heart demon: what to change, one or more positive tasks that counter it, and negative tasks (habits) that feed it; every demon starts at 50% HP
- [ ] &#91;v1\] Creation warning: make sure you want to fight this demon, because deleting one has a cost
- [ ] &#91;v1\] A soul task links to exactly one demon; a soul quest can link to several (one meditation session can attack several demons)
- [ ] &#91;v1\] Completing a positive task damages its demon by 5% HP; logging a negative task heals it by 10%
- [ ] &#91;v1\] Passive growth: after 3 days without a positive task, a demon heals 1% a day; the rate rises with soul color, up to twice as fast at Rainbow
- [ ] &#91;v1\] Defeated demons keep growing passively; a defeated demon that climbs back to 50% HP revives
- [ ] &#91;v1\] At most one new demon per week
- [ ] &#91;v1\] Deletion lock: a demon can't be deleted in its first week, so nobody stays White forever by deleting demons before they reach 70%
- [ ] &#91;v1\] Deleting with a growth color: the soul drops to White, with a warning first
- [ ] &#91;v1\] Deleting at White: allowed, but with no demon left at the end of the day the soul drops to Broken
- [ ] &#91;v1\] Deleting with a weakening color: the last demon can't be deleted, and each deletion feeds the remaining demons until at least one is at 80% HP
- [ ] &#91;v1\] Renaming: an undefeated demon can be renamed and its tasks redefined, for a cultivator who wants to fight a different demon first; locked while defeated, allowed again after revival (as is deletion); a renamed demon below 50% HP goes to 50%, one above keeps its HP
- [ ] "Seek new demons" flow when the cultivator lacks enough to advance (guided reflection, LLM prompts)
- [ ] Awakening alert before a demon's HP crosses 70%, 80% and 90%, and at day's end if one is above 70%

**Gaps**

None open; starting numbers are set, to tune in the economy simulator.

## Narrative layer

Turning the user's real logs into a cultivation novel is the feature Habitica and Duolingo cannot copy cheaply.

- [ ] &#91;v1\] Two voices: the System announces events and rewards in short LitRPG-style messages ("Bottleneck loosened"); the avatar voices warnings and self-reflection ("I've completed 'Math exercise' too many times…", "My equipment is almost broken…")
- [ ] &#91;v1\] Weekly chronicle: an LLM-written chapter built from the week's tasks, quests, tribulations, companion and soul changes
- [ ] &#91;v1\] Chronicle tone chosen by the cultivator for each chapter, on good weeks and bad: pep talk, heroic, or mocking
- [ ] &#91;v1\] Soul content in the chronicle is opt-in, with a warning that demon names appear as written, so the details only make sense to the cultivator
- [ ] Chronicle archive readable as a continuous book
- [ ] &#91;v1\] LLM review on tribulation claims: flags points the cultivator may have missed; the cultivator decides
- [ ] LLM tribulation guidance: helps define "professional" (Core Formation) and "expert" (Nascent Soul) for the discipline; suggests research quests when unsure
- [ ] "Seek new demons" guided reflection with LLM prompts
- [ ] Lore bible: world, realms, classes, companions, the Nine Marvels, the legend of the nine scales, luck and destiny above Nascent Soul; tone guide for the LLM
- [ ] Privacy rule for what log content is sent to the LLM

**Gaps**

None open.

## Character and world

The avatar shows the cultivator's whole state at a glance: class look, pose, companion, soul aura, gear and wearables.

- [ ] &#91;v1\] Minimal character screen: name, realm and level, class, skill ranks and pose, companion and food meter, soul color and heart demons, Qi, gold
- [ ] Avatar look set by class (robes, style); the body shape never changes
- [ ] Pose from Skill: Standing, Heroic, Warrior, Knight, King
- [ ] Companion beside the avatar, by fitness tier, with its behavior animations
- [ ] Soul color as the avatar's aura (White to Rainbow; Violet, Black and Broken as cracks or smoke)
- [ ] Halo above the avatar while active
- [ ] Equipment slots: 1 armor, 1 weapon, 1 pet wearable, 1 soul wearable, 9 golden dragon scales (freed when the wings form), golden wings
- [ ] Gear: armor and weapons per class, each with a durability bar
- [ ] Cave abode: the same cave used for closed-door cultivation, upgraded with gold and decorated with cosmetic items from the shop
- [ ] Rest visuals: the avatar in its cave during closed-door cultivation, visiting the Nine Marvels on vacation; the companion asleep and the aura frozen
- [ ] Spirit Realm: the avatar becomes a spirit in its class avatar's form
- [ ] Layered 2D sprites so class look, pose, aura, halo, gear, wearables, wings and companion combine independently
- [ ] Cinematics: breakthrough attempt, realm breakthroughs, golden wings creation; animations for levels, poses and soul color changes
- [ ] Items are only obtained (shop, drops, roulette), never crafted

**Gaps**

None open; alchemy and techniques are dropped.

## Notifications

Few and meaningful; guilt-trip spam is how Duolingo's notifications became a meme.

- [ ] &#91;v1\] Push notifications only for losses that are close, at most 3 a day, most urgent first:
  - Tribulation and core quest deadlines at 72, 48, 24 and 1 hour left
  - The soul turning Broken (a demon above 90% HP)
  - A defeated demon within 5% of reviving, or any demon within 5% of 70% HP
  - The companion within 5% of empty
  - An equipped item within 5% of breaking
- [ ] &#91;v1\] On a day with nothing urgent, one daily push reminding the cultivator to check the to-do list
- [ ] &#91;v1\] Everything else (rewards, expiring tasks, tax, chronicle ready) goes to the in-app notification list, read on login
- [ ] Quiet hours
- [ ] During vacation, mute everything except tribulation deadlines (they keep running) and the return date; during closed-door cultivation, mute everything except the return date

**Gaps**

None open.

## Onboarding and integrity

The oath sets the tone; pre-commitment and visible logs do the actual work.

- [ ] &#91;v1\] Oath screen: the user types "I will not fake my achievements and I will cultivate with all my heart."
- [ ] &#91;v1\] The Qi Condensation interview is the onboarding: interests for Main, Body and Soul (see Main)
- [ ] &#91;v1\] First companion: a Turtle at 50% food
- [ ] &#91;v1\] The soul starts Broken until the first heart demon and its counter tasks are identified
- [ ] Integrity log: every override, criteria edit, demon deletion or rename, and self-reported claim on one screen

## Data and architecture requirements

Stack: TypeScript end to end, with React Native (Expo) for iOS, Android and web, and one rules package shared by the app, the server and the economy simulator.

- [ ] &#91;v1\] Event-sourced store: only raw events are saved; Qi, gold, realms, companion food, demon HP, soul color and item durability are derived
- [ ] &#91;v1\] A user ID on every event, so multi-user and social need no redesign
- [ ] &#91;v1\] Versioned rules engine, so rebalancing replays history instead of migrating balances
- [ ] &#91;v1\] Offline-first logging that takes under 2 seconds
- [ ] &#91;v1\] Mobile app with push notifications; engagement lives on the phone
- [ ] Rules engine shared between client and server (one implementation of the game math)
- [ ] &#91;v1\] Random outcomes (drops, roulette, companion behaviors) are stored as events, so replaying history under new rules never re-rolls them
- [ ] Export of all events (JSON/CSV) so the user owns the record
- [ ] Web client synced with the mobile app, plus multi-user and auth when friends join; possibly published as an open-source repo (MIT or similar)

## Later: social layer

The strongest retention mechanic in games. It starts after single-player v1 holds up for a month: Dao companions first, since witnesses strengthen honesty, and trading last.

- [ ] Dao companions: one accountability partner who can witness breakthroughs
- [ ] Sects: small groups with shared quests and a sect treasury
- [ ] Rivals: opt-in comparison with someone on a similar path
- [ ] Sect tournaments or seasonal events
- [ ] Item trading between cultivators: a golden dragon scale can change hands only once, between accounts older than a set age; golden wings never transfer

**Gaps**

None open.

## Open questions

None open. Each decision is recorded in its section; the remaining numbers are listed for the economy simulator.

## Rulings

Decisions made while implementing the rules engine. They are settled: future sessions apply them without asking again. Where code and this list disagree, the list wins.

**Soul (Nov 8, 2026)**

1. Deleting a heart demon at a growth color drops the soul to White and holds it there (unless a demon pushes it into a weakening color) until the next demon is defeated. Without the hold, the drop would undo itself at the next evaluation, and deleting an undefeated demon would even help toward Golden.
2. Golden clock: it starts when the Golden condition (every demon defeated, at least 7) first holds, and only a revival resets it; a new demon breaks the condition but not the clock. Golden needs 1 week on the clock, Translucent 1 month, Rainbow 1 year, and Translucent and Rainbow also require the Golden condition to hold.
3. Passive-growth multipliers by soul color are simulator numbers, to tune: Broken, Black, Violet and White 1×, Green 1.1×, Blue 1.2×, Red 1.3×, Golden 1.4×, Translucent 1.6×, Rainbow 2×.
4. "At most one new demon per week" means 7 rolling days since the last new demon.
5. "Defeated" in the color ladder counts demons defeated right now, so a revival lowers the count.
6. Deleted demons count as neither created nor defeated.
7. Deleting at a weakening color raises every remaining demon by the same amount until the strongest is at 80% HP.
8. Rest (vacation or closed-door) freezes demon growth, the 3-day grace period, the soul color and the Golden clock. The color is next evaluated at the first local midnight after the rest ends; immediate color changes (first demon, deletion at a growth color) also wait until then.
