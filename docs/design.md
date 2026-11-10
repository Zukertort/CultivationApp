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

- [ ] &#91;v1\] Qi is the breakthrough currency; each realm and level sets a Qi threshold *(Earning Qi was built in Main part 1. The thresholds come with realms in part 3.)*
- [x] &#91;v1\] Tasks and quests created by the user; a quest bundles several tasks to raise complexity
- [x] &#91;v1\] Quests and tasks expire at their deadline or when completed
- [x] &#91;v1\] One paid extension per expired task or quest, for gold, no longer than its original duration; unpaid, it disappears
- [x] &#91;v1\] Difficulty self-rating per task, relative to current abilities: trivial, easy, mid, hard, deadly
- [x] &#91;v1\] Qi scales with difficulty and complexity; simple tasks pay well in the first two realms and taper off above *(The taper is applied by realm; until part 3 adds realms, every cultivator is in Qi Condensation.)*
- [x] &#91;v1\] Repetition decay: the first two repeats within a level pay full Qi; each later repeat loses 15% of the base, down to a 25% floor *(Built age-based instead, like Body, with no reset at levels; see Rulings 18, 19 and 37.)*
- [x] &#91;v1\] Raising a task's difficulty requires a new named version (Math exercise → Math exercise II)
- [ ] Avatar warning on heavy repetition: "I've completed 'Math exercise' too many times; I need to make it harder to keep growing" *(The rules engine lists stale tasks with `staleTasks`; the avatar message waits for the app.)*
- [x] &#91;v1\] Gold scales with difficulty, number of tasks and duration
- [ ] &#91;v1\] Procrastination tax on every path (Main, Body, Soul) after a set number of days without activity there; a class's cross-credit counts as activity on the paths it covers; the tax hits Qi and gold only, never realm progress, and debt is capped; the Body and Soul taxes are 1/5 of the Main tax *(Built in Main part 1 except class cross-credit, which comes with classes in part 4.)*
- [ ] &#91;v1\] Bonus stacking: every percentage bonus (fitness tier, pose, soul color, class with its Spirit Realm multiplier, items, potions) adds into one pool; scales and wings multiply the total *(Part 1 added the pose Qi bonus and the tier's core Qi bonus, and limited the tier gold bonus to Body and Main gold. Gain potions joined the pool with ruling 58. Classes, soul color and items come in part 4.)*
- [ ] Legendary chances add when several apply to the same event (e.g., Lion 2% + halo ticket 10% + Unique class 2% = 14%); one legendary pool per realm
- [ ] Gold shop: vacations, wearables, armor, weapons, potions, class changes, repairs, extensions
- [ ] Armor reduces Qi losses (e.g., 10 fewer lost); weapons add to Qi gains (e.g., +10); potions boost gold and Qi gains; legendary items boost more *(Gain potions work since ruling 58: +10% gold and Qi for 24 hours. Armor, weapons and legendary items come with gear.)*
- [ ] Items are locked to the current realm; on breakthrough, equipped gear levels up with the cultivator
- [ ] Potions that raise the chance of gear turning legendary when it levels up at a breakthrough *(Legendary potions drop and are stored since ruling 58; their effect comes with gear.)*
- [x] Rare drops on quest completion to keep a variable-reward element *(Main part 1: one server-rolled item roll per completed quest, scaled by its effort; an item is a potion until gear exists. See Ruling 52.)*
- [ ] Economy simulator: a year of synthetic behavior to check inflation, pacing and the numbers flagged across this doc

**Gaps**

- [ ] Numbers for the simulator: the Main tax's grace period and amount, extension prices, vacation lengths and prices, and the Qi cost of editing tribulations or changing discipline *(The Main tax and extension prices have been in the config since Main part 1, provisional per ruling 47. Vacation prices were already set. Step 1 tribulation costs came with part 2 (ruling 67); discipline costs come in part 3.)*

## Breakthroughs and tribulations

A breakthrough is only claimable against criteria written before the attempt, which keeps faking possible but deliberate.

- [x] &#91;v1\] Declare a tribulation: specific, checkable result plus a deadline, written before starting
- [ ] &#91;v1\] A breakthrough needs both the realm/level Qi threshold and the tribulations passed
- [ ] &#91;v1\] Lock criteria once declared; editing or deleting a tribulation costs Qi in every step and is logged visibly (a cultivator may discover a tribulation was wrong or needs to be more specific); adding one is free in Step 1; the only free change is switching the foundation discipline right after a Foundation tribulation *(Step 1 prices and the integrity log entries were built in Main part 2 (ruling 67). Step 2+ prices come with Step 2, and the free foundation switch with realms in part 3.)*
- [x] &#91;v1\] Claim flow: optional LLM review that flags points the cultivator may have missed; the cultivator decides and confirms "I solemnly swear I have passed this tribulation"; optional evidence attachment (file, link, photo) *(Main part 2: the oath, evidence references and an LLM review marker, always "skipped" until the LLM review exists; see New to-dos.)*
- [x] &#91;v1\] Missed deadline: no extensions; the tribulation fails, Qi is lost, and it stays in place for the cultivator to set a new date; extra tasks are required before the next attempt, even if the result is now within reach *(The Qi and gold lost are the extra tasks required: ruling 65.)*
- [ ] &#91;v1\] Adding tribulations never demotes a level; changing the core discipline costs Qi and sends the cultivator back to early Core Formation, not Foundation
- [ ] Verified vs. self-reported badge on each breakthrough
- [ ] Manual override to advance any realm, logged as such (the game must remain finishable)
- [ ] &#91;v1\] Tribulation passed with Qi short: marked "passed, waiting for Qi"; the breakthrough triggers once the threshold is reached

**Gaps**

None open.

## Rest, failure and recovery

The comeback after a bad week must cost less than quitting the app, or users leave.

- [ ] &#91;v1\] Vacations: rest periods bought with gold; the avatar travels to visit the Nine Marvels; tribulation deadlines keep their dates, and the request screen says so *(The deadline rule was built in Main part 2; the screens and the avatar wait for the app.)*
- [ ] &#91;v1\] Closed-door cultivation: a free "feeling ill / burnout" button; the avatar enters a cave; up to 14 days at a time and 30 days per quarter; tribulation deadlines extend by the days spent inside, and the request screen says so *(The deadline rule was built in Main part 2; the screens and the avatar wait for the app.)*
- [ ] &#91;v1\] While resting (vacation or closed-door): no tax, the companion sleeps (no food loss) and the soul is frozen (no demon growth)
- [x] &#91;v1\] Qi deviation: entered when procrastination-tax debt hits its cap; a short comeback quest clears both the state and the debt

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
  - Tribulation and core quest deadlines at 72, 48, 24 and 1 hour left *(in the push plan since Main parts 1 and 2, tribulations first)*
  - The soul turning Broken (a demon above 90% HP)
  - A defeated demon within 5% of reviving, or any demon within 5% of 70% HP
  - The companion within 5% of empty
  - An equipped item within 5% of breaking
- [ ] &#91;v1\] On a day with nothing urgent, one daily push reminding the cultivator to check the to-do list
- [ ] &#91;v1\] Everything else (rewards, expiring tasks, tax, chronicle ready) goes to the in-app notification list, read on login
- [ ] Quiet hours
- [x] During vacation, mute everything except tribulation deadlines (they keep running) and the return date; during closed-door cultivation, mute everything except the return date *(Main part 2: the push plan mutes the current rest and adds a return-date push.)*

**Gaps**

None open.

## Onboarding and integrity

The oath sets the tone; pre-commitment and visible logs do the actual work.

- [ ] &#91;v1\] Oath screen: the user types "I will not fake my achievements and I will cultivate with all my heart."
- [ ] &#91;v1\] The Qi Condensation interview is the onboarding: interests for Main, Body and Soul (see Main)
- [ ] &#91;v1\] First companion: a Turtle at 50% food
- [ ] &#91;v1\] The soul starts Broken until the first heart demon and its counter tasks are identified
- [ ] Integrity log: every override, criteria edit, demon deletion or rename, and self-reported claim on one screen *(Main part 1 records repeated archive-and-restore as `archive_churn` flags, and part 2 records tribulation edits, deletions and claims; the screen waits for the app.)*

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

## New to-dos

Items found while implementing; each waits for a decision or a later part.

- [ ] `taxForecast` shows pending postponed tax per task
- [ ] Revoking a false tribulation claim
- [ ] The LLM review on tribulation claims, and the verified vs self-reported badge
- [ ] Linking a quest to a tribulation as its preparation
- [ ] Integrity-log entry when closed-door rest starts within 72 hours of a tribulation deadline (visible, not penalized)
- [ ] Part 3 must restrict tribulation item rolls to tribulations that count toward the current realm (ruling 68); the daily-24h-tribulation persona earns 4x the honest rolls under the 7-day cap alone

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
8. Rest (vacation or closed-door) freezes only time-driven changes: demon growth, the 3-day grace period, the end-of-day color evaluation and the Golden clock. The color is next evaluated at the first local midnight after the rest ends. The cultivator's own actions apply at once, even during rest (a first demon lifts Broken to White; a deletion at a growth color drops to White).
9. Soul drop rolls follow the task's polarity: positive tasks roll for gains at growth colors (Green to Rainbow); negative tasks roll for losses at weakening colors (Violet, Black, Broken). Positive tasks at a weakening color, negative tasks at a growth color, and any task at White roll nothing.
10. The server rolls drops. A task logged online carries its outcome; for a task or quest logged offline, the server appends a SoulDropRolled event on sync, so offline logging can't skip a roll. The roll uses the soul color at the time of the task.
11. At most 3 drop rolls per local day, across tasks and quests. A soul quest rolls once per linked demon it hits, under that cap.
12. Drop gold is about one routine's worth (10 gold before bonuses). The split of each color's chance between gold, Qi and items, and the drop amounts, are simulator numbers.
13. Violet timing stays as is: with no practice, two relapses a week on a new demon reach Violet in about 1 week and Broken in about 2.
14. A soul quest links at least 2 demons and completes once; demons deleted after the quest was defined are skipped when it completes.
15. Until gear exists, a gained "item" is a potion, and a lost item is a potion, never a legendary. *(Ruling 58 splits potions into two kinds; a lost item takes a gain potion first.)*
16. Stored drop outcomes are never re-rolled. Under rebalanced rules, outcomes beyond what a task now earns are ignored and missing ones become pending; a SoulDropRolled with nothing pending is logged as an anomaly, never applied.
17. On Android the app asks the cultivator once to set its battery usage to Unrestricted, explaining that alerts can arrive late otherwise (One UI held a test alarm for over 7 minutes under the default setting). Both "yes" and "no" are accepted; "no" means alerts may be late, and the app keeps working. Delays are measured again on a development build.

**Main path, part 1: tasks, quests and the tax (Nov 10, 2026)**

18. Main repetition decay is age-based, the same rule as Body: it penalizes stagnation, not consistency. A task pays full value for a set time after its first completion, then loses a share each week down to a floor. Main has its own numbers in the config (simulator values), starting from Body's.
19. Decay age counts only active time: not while resting (on Main and Body) and not while the task is archived.
20. A task is either one-time or recurring, picked with a "One time only" checkbox at creation. A one-time task has a deadline, expires, and can get the one paid extension. A recurring task has a frequency (N per day, week or month, at most 2 per day) and an optional end date; it never expires and gets no extension. Quests have a deadline only, never a frequency.
21. A recurring task's frequency is its payout cap: completions beyond it in a period are logged but pay nothing.
22. Repetition is tracked by task name, so "Math exercise II" starts fresh. Changing a task's difficulty requires a new named version. Resetting decay with a new version at the same rating is accepted: this is a role game, and cheating means lying to yourself. A "Do again" shortcut is fine.
23. Deleting a task archives it, and archived tasks can be restored with their history. Creating a task with an archived task's name restores that task instead, so deleting and recreating never resets decay.
24. Difficulty is self-rated relative to current abilities, with no cap on "deadly"; honesty is the cultivator's responsibility. The simulator keeps a "rates everything deadly" persona to measure the effect.
25. Effort is self-rated and locked at creation. Gold scales with difficulty, effort and the number of tasks, never with the deadline's length.
26. More complex quests give more Qi, through a bonus paid when the quest's last task is completed. The numbers are simulator values.
27. Splitting a task into honestly rated pieces must never pay more than one task, or one quest, of the combined difficulty. A "splitter" simulator persona and the tests check it. *(Ruling 60: a quest may pay slightly more than one task of the same work.)*
28. Simple tasks pay well in the first two realms and taper off above; the taper values are simulator numbers.
29. One extension per one-time task or quest, paid in gold, no longer than the original duration, bought within 3 days after the deadline. Unpaid, the item disappears. Extending a quest extends its unfinished tasks. Tasks can't be edited after creation, and deadlines are at most 1 year out.
30. Tasks and quests follow the tribulation rule during rest: vacation keeps their deadlines; closed-door cultivation extends them by the days spent inside, because the cultivator may be ill. This is an exception to ruling 8.
31. Procrastination-tax activity: on Main, completing a task; on Body, logging an activity (even one over the routine cap); on Soul, a positive task or quest. Defining things never counts. Each path's tax clock starts when the path is chosen in the Qi Condensation interview, so a path the cultivator never starts is still taxed.
32. Main tax: each missed occurrence of a recurring task is one tax tick. With no active tasks, the idle rule applies after 3 days without Main activity. Body and Soul use the idle rule after 7 days, and their tax is 1/5 of Main's. Rest days are never taxed and don't count toward the grace.
33. The tax hits Qi and gold, never realm progress. It is deducted from the balances; what they can't cover becomes debt (balances never go below 0), and future gains repay the debt first. Debt is capped, and Qi deviation starts at the cap. The amounts are simulator values.
34. A comeback quest clears Qi deviation and forgives the remaining debt: complete 3 Main tasks rated easy or harder within 3 days of entering deviation; if the window passes, a new 3-day window starts.
35. Bonuses: the fitness tier's Qi bonus applies only to Main tasks and quests; the pose Qi bonus applies to all Qi gains; the tier gold bonus applies only to Main and Body gold, never to soul drops, the roulette or anything else.
36. The server checks each event's timestamp against when it was received; the rules engine trusts `at`.
37. Repetition decay never resets at a level-up or a realm breakthrough. Only a new named version starts fresh.
38. Payouts use work points: difficulty points (trivial 1, easy 2, mid 4, hard 8, deadly 16) times an effort weight (quick 0.25, session 1, day 4, project 16). Qi follows a convex curve of the points through 1, 3, 8, 20 and 50 Qi at 1, 2, 4, 8 and 16 points, so one task always pays at least as much as the same work in pieces. Gold is linear in the points. A completed quest's total Qi is the lower of the curve at the members' combined points and 1.5 times the members' own Qi; the completion bonus is the difference. This replaces the +10% per task bonus, which rewarded splitting. *(The 1.5 cap is replaced by ruling 51.)*
39. "At most 2 a day" applies to weekly and monthly tasks too, and to one-time tasks sharing a name: a name pays at most 2 completions per local day. A completion over either cap neither pays nor counts as an occurrence. Periods are the local day, the ISO week (from Monday) and the calendar month.
40. A missed occurrence costs Main's daily tax times (days in the period / the task's count), so missing a task's whole schedule costs about one idle day per day for each task.
41. Only active recurring tasks replace Main's idle rule; one-time tasks don't. A day with an active recurring task is never charged idle tax as well.
42. In a partly active period (created, archived, ended or resting during it), the occurrences owed are the count times the active share of the period, rounded down. Archiving just before a period ends still owes the share already due. *(Rounding amended by ruling 48: the exact share is owed.)*
43. Only recurring tasks are archived and restored; deleting a one-time task cancels it (it pays nothing, and its name keeps its history). A name has at most one open task. A recurring task past its end date counts as archived. Cancelling a quest member forfeits the quest's bonus. *(Rulings 60-61: bonus stages already paid are kept; a cancelled member forfeits the item roll.)*
44. The InterviewAnswered event, emitted when the Qi Condensation interview is answered (the early level), starts the tax clocks of all three paths at once. Answering again changes only the interests.
45. Quest members are one-time tasks that share the quest's deadline; a recurring task can't join a quest. *(Amended by ruling 50: a member may have its own earlier deadline.)*
46. Restoring is an explicit event: the restored task keeps its difficulty, effort and decay history and takes the new schedule. Defining a task with an archived task's name is rejected, so the log always shows the restore.
47. Every number from Main part 1 is provisional and will be revisited after dogfooding.
48. Partial periods charge the exact share of the occurrences owed, not a rounded-down count, so archiving a task overnight still owes the hours it was active. Archiving costs nothing beyond that. Restoring the same task 3 or more times within 30 days is flagged in the integrity log. Completing a one-time task, or a recurring task reaching its end date, is never a delete.
49. "Work on this task today" counts as Main activity for the idle tax and pays nothing. It is allowed once per task per local day, on one-time tasks rated day or project effort and on recurring tasks whose period is a week or longer. A one-time task allows at most 3 uses (day effort) or 30 (project effort); after that it must be completed or split into milestones. *(Ruling 56 adds a condition for it to count.)* The app suggests a milestone quest when someone creates a project-sized task.
50. A quest member may have its own deadline, on or before the quest's, so a quest can hold milestones. A milestone expires on its own and can buy its own extension, never past the quest's deadline; a member without a deadline follows the quest's. Recurring tasks can also run per calendar year.
51. A quest's bonus cap scales with its members' total effort in days of work (quick 1/16, session 1/4, day 1, project 4), not with its deadline: about 3.5% for a day of work, 15% for a week and 40% for a year, linear in between and flat beyond. *(Ruling 54: the cap is paid directly.)* When creating a quest, the app shows: "Quests are only for related tasks (related by time or topic)."
52. The realm taper applies to Qi only, and quests pay no gold bonus. A completed quest without a cancelled member earns one item roll: rolled on the server and stored in the event, at a chance scaled by the same effort bands (about 2% for a day of work, 8% for a week, 25% for a year), always below a tribulation's, and at most 2 quest rolls per local day. Until gear exists, an item is a potion. *(Ruling 58: either kind, 50/50.)*
53. Finished one-time tasks will be dropped from the replayed state in a later change; the name's decay history keeps what matters.
54. A completed quest's bonus is the cap for its members' days of work times their own Qi, without the curve limit from ruling 38, so the bands are what quests pay. A quest holds up to 52 members (weekly milestones for a year); the year band is reached by more members, not by a bigger effort unit.
55. A new version of a recurring task, created the same day the old one is archived or replacing it while open, takes over the old version's count for that day or week, so leveling up never owes tax.
56. "Work on this task today" counts as Main activity only if a Main task was completed in the last 14 days (rest excluded). Otherwise it is logged but neither counts nor uses up the task's cap. *(The 14-day rule is replaced by ruling 59.)* Work-on stays once per task per day; recurring tasks get no lifetime cap, since their missed occurrences are already taxed.
57. The cultivation streak is cosmetic: the number of days without Main idle. It breaks on the idle tax's condition (Main idle past its grace), also on days when an active recurring task replaces the idle tax with ticks; rest pauses it; it gives no rewards.
58. Potions are only obtained, never crafted. Every potion drop (a soul or quest item, a roulette potion) is 50/50 a gain potion or a legendary potion, rolled by the server within the same roll. A gain potion, drunk with a PotionUsed event, adds +10% to the additive gold and Qi pool for 24 hours, one active at a time. A legendary potion is stored for now; with gear it will add +5% legendary chance at the next breakthrough, one per breakthrough. All potion numbers are simulator values.
59. "Work on this task today" postpones Main's idle tax instead of cancelling it; the 14-day rule from ruling 56 is removed. A day when Main would owe idle tax but for work-on, that day's tax is put on the task last worked on. Completing the task cancels its postponed tax; cancelling it, or letting it fail (expired past its extension window), charges all of it. The comeback quest forgives debt from idle tax and missed occurrences, but not debt from postponed tax; gains repay that part of the debt first.
60. A quest may pay slightly more than one task of the same work (e.g. 4 hard days as a quest 481 Qi, one hard project 470). The bonus is paid in stages: each completed member pays its share at once, with the cap for the effort completed so far, not the planned effort; once every member is done, the total equals the cap for the whole quest. Stages already paid are kept if a member is later cancelled or fails.
61. Milestones stay quest members, not tribulations. A member that expires past its extension window fails and no longer blocks the quest: the quest completes when every other member is completed, cancelled or failed. The item roll still requires that no member was cancelled or failed. A quest whose members all failed or were cancelled is gone.
62. Part 3 sets the realm Qi thresholds against honest personas, not the hard-project-every-week one.
63. Accepted choices from Main part 1: a new version takes over the count only when the period type matches; any Main completion counts as a completion; the streak also breaks on days a recurring task replaces the idle tax with ticks; a gain potion boosts every gold and Qi gain, soul drops and the roulette included; a lost item takes a gain potion first; one server roll decides both a drop and its potion kind.

**Main path, part 2: tribulations (Nov 10, 2026)**

64. Part 2 builds the tribulation lifecycle: declare, lock, edit, delete, claim, fail and reschedule. Each tribulation records the realm it was declared in; Part 3 decides which tribulations a breakthrough needs and how they count.
65. A failure costs Qi and gold (Step 1 simulator values: 65 Qi and 45 gold), taken from the balances, floored at 0, never debt and never a deviation trigger. The loss is the "extra tasks before the next attempt": there is no separate task counter. Part 3 sizes the loss as a share of the current level's Qi threshold, so a failure always means extra work, even with Qi above the threshold. Armor reduction and gear damage come with gear.
66. Deadlines are at least 24 hours and at most 365 days out, with no limit on open tribulations. A failure is applied at the first local midnight after the effective deadline, or at the next event about that tribulation if sooner, and is dated at the deadline; a claim is allowed up to the deadline. A failed tribulation has no deadline until the cultivator sets a new one; rescheduling is free and repeatable, and every failure costs again.
67. The title and criteria can be edited, never the deadline. Step 1 prices: an edit is free within 1 hour of declaring (still logged), costs 20 Qi during the first three quarters of the time from declaration (or the last reschedule) to the deadline, and costs the full failure cost (Qi and gold) in the last quarter, so a late edit can't turn a hard tribulation into an easy one cheaply. Deleting an open tribulation costs 1.5 times the failure cost; deleting a failed one costs 40 Qi, since the failure was already paid. Without enough Qi or gold the change is rejected. A passed tribulation can't be edited or deleted. Adding is free in Step 1. From Step 2 on, adding is paid and editing and deleting cost the normal prices only, since tribulations become part of the discovery phase; those prices are set when Step 2 is built. All are simulator values.
68. Passing pays no Qi or gold. A passed tribulation earns one item roll at 50%, rolled by the server (a potion until gear exists, 50/50 by kind), outside the daily roll cap. Until Part 3, at most one tribulation item roll per 7 days; Part 3 limits rolls to tribulations that count toward the current realm's breakthrough, and Part 4 adds class drops.
69. A claim counts as Main activity; declaring, editing and rescheduling don't. A claim carries the oath "I solemnly swear I have passed this tribulation.", optional evidence references (file, link or photo) and an LLM review marker. There is no LLM yet, so the marker is "skipped".
70. Closed-door rest pushes tribulation deadlines back like any deadline (up to 14 days at a time and 30 days a quarter), with no extra limit; the simulator measures the maximum delay. Vacation keeps them.
71. Tribulation edits, deletions and claims are recorded in the integrity log.
72. Accepted choices from Main part 2: a closed-door rest started at the exact deadline extends it, for tribulations and tasks alike, since that is the last moment a claim or completion is allowed; editing a failed tribulation costs 20 Qi; the free first hour applies only after declaring, not after a reschedule; a drop stored on a claim inside the 7-day cooldown is ignored.
