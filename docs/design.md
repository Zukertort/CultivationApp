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

- [x] &#91;v1\] Qi Condensation interview: the cultivator's interests for Main, Body and Soul *(The InterviewAnswered event (ruling 75); the screen waits for the app.)*
- [ ] &#91;v1\] Exploration quests for undecided areas; research quests when the cultivator hits a bottleneck
- [ ] &#91;v1\] Foundation Establishment: starter quests to begin practicing, plus dated tribulations for mid, late and great circle, sized to current abilities *(Main part 3 built the dated tribulations for mid, late and great circle (ruling 76); starter quests wait for the app's suggested quests.)*
- [x] &#91;v1\] Fast track: a cultivator already in the discipline defines Foundation tribulations and proves they are passed *(Ruling 76: Foundation's Qi thresholds are waived for claims with evidence, logged as fast track.)*
- [x] Foundation switch rule: free right after a tribulation, costs Qi mid-level (discourages quitting too early) *(Rulings 77 and 90: a Main change mid-Foundation costs Qi with no restart; the core discipline is picked for free at the end of Foundation.)*
- [ ] Class selection at the end of Foundation: ask whether the core discipline relates to Body, Soul, both or neither *(The rules record the class since Main part 4 (ruling 113); the question waits for the app.)*
- [x] Core Formation: guide tribulations that define "professional" in the discipline; levels advance at 30/60/90% of tribulations passed, Nascent Soul at 100%; adding a tribulation later lowers the percentage but never the level already reached *(Levels and the never-demote rule were built in Main part 3 (ruling 78); the guidance waits for the LLM.)*
- [ ] Nascent Soul: guide tribulations that define "expert"; offer a research quest when unsure; warn against changing them out of self-doubt or overconfidence *(The locked set and the transcendence were built in Main part 3 (ruling 79); the guidance, the research-quest offer and the warning wait for the app and the LLM.)*
- [ ] Spirit Realm: force selecting a new discipline; tribulations are studies and combinations that may shift with findings
- [x] Realm intro screens stating each realm's purpose and its self-check question (e.g., "Am I an expert, or am I lacking something?") *(After any breakthrough the app opens the Trials tab on the new realm: its purpose, good and bad examples (ruling 87), what to do next and its self-check question.)*
- [ ] Lore: Nascent Soul needs luck, realms above it need luck and destiny, and no one has demonstrably reached Immortal, which keeps the dream alive
- [ ] Write example tribulations for each realm from Void God to Immortal

**Core realms**

| Step | Realm | Purpose | Levels | Breakthrough |
| --- | --- | --- | --- | --- |
| 1 | Qi Condensation | Discover interests in Main, Body and Soul | Early: interview answered. Mid: 1 area decided. Late: 2. Great circle: 3 | First tribulation: all three areas chosen, then locked by the cultivator (free to change until the lock, then for a price) |
| 1 | Foundation Establishment | Start practicing and test the chosen path | One dated tribulation per level (mid, late, great circle) | All passed; then form a core, picking the core discipline for free, and choose a class |
| 1 | Core Formation (Golden Core) | Become a professional; consistency over single wins | 30% of tribulations: mid. 60%: late. 90%: great circle | 100%: "I consider myself a professional" |
| 1 | Nascent Soul | Become an expert; needs some luck | No levels: a set defined and locked within 90 days of entering (ruling 79) | All passed: "I consider myself an expert" |
| 2 | Spirit Realm | Study new disciplines and combine them into your own dao | Exploratory tribulations that may shift with findings | You know the bases to create a new discipline |
| 3 | Void God | Forge your own discipline and earn recognition | Tribulations for the discipline to count as real | Discipline recognized |
| 4 | Golden God | Turn recognition into real-world achievements | Real-world achievement tribulations | Followers appear |
| 5 | True God | Build a community with rules that keeps growing | Tribulations that create a legacy | Followers pursue the path on their own |
| 6 | Sovereign | Sustain a legacy over years | Milestones until nothing is left to learn or achieve | Nothing more to learn |
| 7 | Immortal | Challenge your own dao to protect the truth | Endless tribulations that try to prove the zenith wasn't reached | Final realm; no tribulation can break you |

### Classes

Classes customize how tasks count across paths, so a fighter's training routine can also be core cultivation. They don't depend on the discipline (a dancer may pick any class) and can be changed with gold. The more paths a class covers, the lower its gold bonus: Unique (core only) highest, Soul or Body (dual) middle, Hybrid (triple) lowest.

- [x] &#91;v1\] Class choice at the end of Foundation Establishment, grouped as Soul, Body, Hybrid and Unique *(Ruling 113: CoreFormed carries it.)*
- [x] &#91;v1\] Cross-path tasks: a core quest or task can be tagged to also count for Body (as a routine paying gold) or Soul (damage to a chosen heart demon), as the class group allows; logged once, never twice *(Rulings 116, 117 and 124.)*
- [x] &#91;v1\] Class gold and Qi bonuses apply to all gains and come from the current class only; switching replaces them, never stacks *(Ruling 115.)*
- [x] Class change in the gold shop; changing class forfeits all soul and pet wearables *(Rulings 114 and 118: 500 gold, held wearables forfeited. Priced in the Store's Services and bought on the Realm screen (ruling 163); blocked while dead (ruling 164).)*
- [x] Soul class drops after a successful tribulation: soul wearables (e.g., freeze a heart demon for a week); legendary ones add visuals and bonus demon damage *(Rulings 118 and 119; legendary versions wait for gear.)*
- [x] Body class drops after a successful tribulation: pet wearables (e.g., keep the Lion for a month, or a halo ticket); legendary ones add visuals and bonus gold *(Rulings 118 and 119; legendary versions wait for gear.)*
- [x] Hybrid class drops after a successful tribulation: a soul wearable or a pet wearable (50/50), never both *(Ruling 119.)*
- [x] Unique class drops: +2% legendary chance after a tribulation *(Ruling 120: a 2% legendary-item roll on each passed tribulation.)*
- [x] Class drops never amplify negative soul effects *(Class bonuses apply to gains only (ruling 115), and a soul wearable only freezes growth.)*
- [ ] Avatar look changes with class
- [ ] Class gear (robes, weapons, items) per class; off-class gear keeps only 20% of its bonus
- [ ] Spirit Realm: the class locks on entry, then the soul takes the class avatar's form; class bonuses and drops multiply by step (×2 in Step 2 up to ×7 in Step 7) *(The lock was built in Main part 4 (ruling 123); the form and the multipliers come with Step 2.)*

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

- [x] &#91;v1\] Skill: user-defined disciplines with user-defined ranks; the user decides what mastery means (e.g., blue belt in BJJ, clean deadlift technique past a bodyweight threshold); ranks are never lost *(SkillDefined and SkillRankAchieved; a lower rank is rejected.)*
- [x] &#91;v1\] Mastery evidence: a photo (belt, credential) or a link (video); editable when the skill improves further *(Evidence on SkillRankAchieved; the same rank can be recorded again with new evidence.)*
- [ ] &#91;v1\] Exercises and routines defined and adjusted by the user; show average values for their bodyweight and age group as reference only *(Defining and versioning are built (BodyActivityDefined); the reference averages need data and the app.)*
- [x] &#91;v1\] Each logged exercise or routine pays gold to the cultivator and treats to the companion: an exercise gives 10, a routine (dance class, BJJ session, gym routine) gives 200; at most 2 routines a day count *(BodyActivityLogged; the 2-routine cap also covers class cross-credit (ruling 116).)*
- [x] &#91;v1\] Turtle can be fed with single exercises; from Panda on, the user creates routines, since exercises alone can't keep up with daily food loss *(Set by the food economy numbers and checked in the simulator.)*
- [x] &#91;v1\] Companion food meter: 100% promotes to the next animal, 0% demotes; the new animal starts at 50% in both directions *(`tierStartFraction` 0.5.)*
- [x] &#91;v1\] The Turtle never leaves: at 0% it stays hungry until fed
- [x] &#91;v1\] Daily food loss scaled by tier, sized so each tier holds at its target cadence (food economy table below) *(`weeklyLoss` per tier, checked in the simulator.)*
- [x] &#91;v1\] Food repetition decay penalizes stagnation, not consistency: a version of an exercise or routine pays full treats and gold for 4 weeks after its first completion, however often it is done, then loses 15% a week down to 25% until the cultivator levels it up ("BJJ" → "BJJ II") *(Rulings 18 and 19.)*
- [ ] &#91;v1\] Companion animal per tier, with behavior animations; the avatar's body never changes *(The tier is in the rules; the animals and animations wait for the app.)*
- [ ] Companion behaviors fire once a day (tier table below) *(Cosmetic, for the app. The Horse's unequip is cosmetic too: gear keeps counting (ruling 144). The equipment damage is in the rules since ruling 144.)*
- [x] Equipment durability: damage accumulates on one random equipped item; at 100% the item is lost; repair with gold, cost scaled by the item's tier *(Ruling 144, by slot since ruling 147: the companion damages every armor worn that day, by fitness tier; a failure's 20% hits one worn item, armor or weapon (ruling 166); repairs priced by the item's value.)*
- [x] Pricing rule: repairing one item always costs less than the Qi and gold a failed tribulation takes without gear, legendary items included *(Ruling 144; a test checks every realm and kind.)*
- [x] Avatar warning when equipment is close to breaking ("My equipment is almost broken; I should repair it before it's lost") *(At 95% damage, on the Realm and Store screens, plus a push (ruling 144); a "getting damaged" line from 50%, in the app only, and a computed before-deadline warning with one-tap Swap and Repair (rulings 149, 153).)*
- [x] Failing a tribulation deals 20% damage to one random equipped item, while the gear reduces the Qi and gold lost *(Rulings 142, 144 and 147: the armor worn at the deadline lowers both; the 20% hits one item worn at the deadline, armor or weapon, by a deterministic pick (ruling 166). Stats double per realm (ruling 171).)*
- [ ] Breakthrough attempt cinematic; the Horse never unequips during it *(Waits for the app.)*
- [x] Lion petting: once a day, a small amount of Qi *(Ruling 127: CompanionPetted, 3 Qi with multipliers.)*
- [x] Pet wearable that keeps the companion's tier (bonuses included) for 30 days; worn at Lion, it keeps the Lion *(Superseded by ruling 118: the keep pet wearable holds the current tier, Lion included, for 30 days.)*
- [x] Golden ticket: with the Lion at 100% food, each completed routine earns a ticket for the roulette (odds table below) *(BodyActivityLogged; RouletteSpun with server-rolled prizes.)*
- [x] Golden dragon scale: a wearable worth +5% Qi and +10% gold gains, compounding with each scale worn; the "legend of the nine scales" lore entry *(Roulette prize; the bonuses join the multipliers. The lore entry waits for the lore bible.)*
- [x] Golden wings: wearing nine scales unlocks a creation cinematic; the scales merge into the wings and free their slots; the wings give +50% Qi gains and +100% gold gains, never break, and only one set can be worn *(Nine scales merge into wings; the cinematic waits for the app.)*
- [x] Anomaly flag: a second set of wings on one account is logged as a likely bug or exploit *(`second_wings` anomaly.)*
- [x] Poses unlocked by number of skills mastered (Standing to King); never lost *(`poses` config; masteries are never lost.)*
- [x] Halo: one halo and one ticket per skill mastered; halo hidden 1 month after the last mastery; one ticket per breakthrough, extras saved until 3 months after their mastery *(Visible 30 days after the last mastery, tickets for 90 days; since Main part 3 a ticket adds to a level-up's or breakthrough's legendary roll, the one expiring first (rulings 83, 97).)*

**Gaps**

None open.

**Fitness tiers** (from the companion's food meter)

| Tier | Companion behavior (once a day) | Equipment damage (per day, ruling 144) | Daily food loss | Gold after exercise | Qi on core tasks/quests | Extra |
| --- | --- | --- | --- | --- | --- | --- |
| Turtle | Bites you | 5% | Lowest | +1% | — | — |
| Panda | Sits on you | 3% | Low | +10% | — | — |
| Horse | Throws you off and unequips gear and weapons (never during a breakthrough attempt) | 2% | Medium | +20% | +10% | — |
| Tiger | Scares you with its claws | 1% | High | +30% | +15% | — |
| Lion | Protects you; pet it once a day for a little Qi | — | Highest | +35% | +15% | +2% legendary item chance on every level-up and breakthrough (ruling 111) |

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

**Halo** (an adornment above the avatar, not a pose): each skill mastered grants a halo and one halo ticket. The halo stays visible for 1 month after the last mastery. A ticket from a mastery in the last 3 months adds +10% legendary item chance to the next level-up or breakthrough; one ticket per roll, extras saved (rulings 83, 97).

### Soul

Soul training is exploring and expressing yourself. Soul tasks fight heart demons, and the demons' HP sets the Soul color, which changes game rewards only, never breakthroughs.

- [x] &#91;v1\] Soul tasks: meditation, journaling, therapy, artistic work; every completed soul task damages its linked heart demon *(SoulTaskLogged; class cross-credit can also hit a demon (ruling 116).)*
- [x] &#91;v1\] Weakening colors trigger on any single demon: Violet above 70% HP, Black above 80%, Broken above 90% (or no demon defined); more demons means more ways to fall *(`evaluateSoulColor`.)*
- [x] &#91;v1\] Soul color evaluated at the end of the day, so a demon that crosses 70% can still be pushed back before the drop *(`endOfDay`; rest freezes it (ruling 8).)*
- [x] &#91;v1\] Growth colors require no demon above 70%, plus minimums of demons created and defeated: Green 1 and 1, Blue 3 and 3, Red 6 and 6, Golden all defeated with at least 7 *(Rulings 2 and 5.)*
- [x] &#91;v1\] Identifying the first demon moves the cultivator from Broken to White *(`first_demon` color change.)*
- [x] &#91;v1\] One drop roll per completed soul task, at the current color's rates *(Server-rolled by polarity, at most 3 a day (rulings 9-11).)*
- [x] &#91;v1\] Translucent and Rainbow clocks reset when any defeated demon revives *(The Golden clock (ruling 2).)*

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

- [ ] &#91;v1\] Inner loop (minutes): one-tap task completion with instant Qi or gold, treats for the companion or damage to a demon, and a short System message *(Every logging event pays at once in the rules; the one-tap screen and the System message wait for the app.)*
- [ ] &#91;v1\] Middle loop (1–3 weeks): a level, skill rank, companion tier or defeated demon at least every few weeks per active path *(Measured by the cadence report (`tools/sim/src/cadence.ts`): Main pays every 3-4 weeks except through Nascent Soul, Body every few weeks until Lion and then through golden tickets, and Soul only while the cultivator keeps up with their demons; see New to-dos.)*
- [x] &#91;v1\] Outer loop (months to years): realm breakthroughs through tribulations *(Main parts 2 and 3.)*
- [x] No combined character level: the realm is the headline, and Body and Soul show as the companion and the aura *(The rules have no character level; realm, companion tier and soul color are separate.)*
- [x] Target cadence table: expected time per layer and per realm for a consistent user, used to tune numbers *(From the cadence report; see the table below. Simulator values.)*
- [ ] Suggested quests from the cultivator's own paths (exploration, research, seek new demons); every other task and quest is created by the cultivator *(Waits for the LLM and the app.)*

**Target cadence** (week each layer is first reached in the cadence report: daily mid study, gym and soul practice 3 times a week, a new demon every 4 weeks up to 7, the honest tribulation plan; simulator values)

| Layer | Week reached |
| --- | --- |
| Foundation Establishment | 1 |
| Core Formation | 17 (10 with a weekly hard project) |
| Nascent Soul | 67 |
| Spirit Realm | about 117 (27 months in the realm simulator) |
| Panda, Horse, Tiger, Lion | 0.1, 1.4, 4.4, 12.7 (2 routines a week stops at Tiger, week 11) |
| Green, Blue, Red, Golden | Green at 3. Hitting one demon per session: Blue at 11 when focused, Red at 83 with daily practice, never Golden. With soul quests (each session hits every demon, ruling 14), 3 a week: Blue 11, Red 23, Golden 28; 2 a week: Golden 31, and Rainbow by the end |

## Economy

Qi pays for breakthroughs and gold buys gear and rest; repeated tasks pay less each time, so only harder, more complex quests keep Qi flowing, which is the anti-stagnation mechanic.

- [x] &#91;v1\] Qi is the breakthrough currency; each realm and level sets a Qi threshold *(Since ruling 169 the Qi is spent per tribulation instead: completing one costs its realm's price, 350, 700 and 1,400 Qi, and only completed tribulations count toward levels and realms; the realm factor scales every Qi price (ruling 170).)*
- [x] &#91;v1\] Tasks and quests created by the user; a quest bundles several tasks to raise complexity
- [x] &#91;v1\] Quests and tasks expire at their deadline or when completed
- [x] &#91;v1\] One paid extension per expired task or quest, for gold, no longer than its original duration; unpaid, it disappears
- [x] &#91;v1\] Difficulty self-rating per task, relative to current abilities: trivial, easy, mid, hard, deadly
- [x] &#91;v1\] Qi scales with difficulty and complexity; simple tasks pay well in the first two realms and taper off above *(The taper is applied by realm; until part 3 adds realms, every cultivator is in Qi Condensation.)*
- [x] &#91;v1\] Repetition decay: the first two repeats within a level pay full Qi; each later repeat loses 15% of the base, down to a 25% floor *(Built age-based instead, like Body, with no reset at levels; see Rulings 18, 19 and 37.)*
- [x] &#91;v1\] Raising a task's difficulty requires a new named version (Math exercise → Math exercise II)
- [ ] Avatar warning on heavy repetition: "I've completed 'Math exercise' too many times; I need to make it harder to keep growing" *(`staleTasks` lists them; the avatar message waits for the app.)*
- [x] &#91;v1\] Gold scales with difficulty, number of tasks and duration
- [x] &#91;v1\] Procrastination tax on every path (Main, Body, Soul) after a set number of days without activity there; a class's cross-credit counts as activity on the paths it covers; the tax hits Qi and gold only, never realm progress, and debt is capped; the Body and Soul taxes are 1/5 of the Main tax *(Main part 1; class cross-credit counts as activity since part 4 (ruling 116).)*
- [x] &#91;v1\] Bonus stacking: every percentage bonus (fitness tier, pose, class with its Spirit Realm multiplier, items, potions) adds into one pool; scales and wings multiply the total *(Fitness tier, pose, class, gain potions and the worn weapon share the pool, scales and wings multiply it (rulings 35, 58, 115, 143). The class's Spirit Realm multiplier comes with Step 2. Soul color changes drop chances, not percentage bonuses.)*
- [ ] Legendary chances add when several apply to the same event (e.g., a breakthrough into Nascent Soul: 20% base + Lion 2% + halo ticket 10% = 32%); each realm has its own pool of legendary items that can drop, since gear is realm-locked *(The chances add since Main part 3 (rulings 94, 111), and a legendary potion adds 5% to a realm breakthrough since ruling 141. The Unique class's 2% is its own roll on each passed tribulation (ruling 120). The realm pools come in Roadmap part 4 (ruling 121).)*
- [x] Gold shop: vacations, wearables, armor, weapons, potions, class changes, repairs, extensions *(Roadmap part 3: the Store's Shop sells the realm's robe, shop armor and weapon and gain potions; Services holds vacations, with the class change and extensions priced there and bought where they're used (rulings 159-163). Wearables, legendary items and legendary potions stay drop-only (ruling 160).)*
- [ ] Armor reduces Qi losses (e.g., 10 fewer lost); weapons add to Qi gains (e.g., +10); potions boost gold and Qi gains; legendary items boost more *(Gain potions since ruling 58. Armor lowers a failure's Qi and gold, weapons add a percentage to every Qi gain (rulings 142, 143). Stats double per realm (ruling 171). Legendary gear's stats are in the config ladder (ruling 138); getting it comes in Roadmap part 4.)*
- [x] ~~Items are locked to the current realm; on breakthrough, equipped gear levels up with the cultivator~~ *(Superseded by ruling 138: gear never levels up; each realm has fixed stats, and gear of the current or a lower realm can be worn.)*
- [x] ~~Potions that raise the chance of gear turning legendary when it levels up at a breakthrough~~ *(Superseded by ruling 141: a legendary potion adds 5% to the next realm breakthrough's legendary roll.)*
- [x] Rare drops on quest completion to keep a variable-reward element *(Main part 1: one server-rolled item roll per completed quest, scaled by its effort; an item is a potion until Roadmap part 4 adds legendary items. See Ruling 52.)*
- [x] Economy simulator: a year of synthetic behavior to check inflation, pacing and the numbers flagged across this doc *(`tools/sim`: Body food, Soul, Main, tribulations, realms and classes.)*

**Gaps**

- [ ] Numbers for the simulator: the Main tax's grace period and amount, extension prices, vacation lengths and prices, and the Qi cost of editing tribulations or changing discipline *(The Main tax and extension prices since Main part 1, Step 1 tribulation costs since part 2, and the realm thresholds and discipline costs since part 3; all provisional.)* *(Vacation lengths and prices: ruling 161.)*

## Breakthroughs and tribulations

A breakthrough is only claimable against criteria written before the attempt, which keeps faking possible but deliberate.

- [x] &#91;v1\] Declare a tribulation: specific, checkable result plus a deadline, written before starting
- [x] &#91;v1\] A breakthrough needs both the realm/level Qi threshold and the tribulations passed
- [ ] &#91;v1\] Lock criteria once declared; editing or deleting a tribulation costs Qi in every step and is logged visibly (a cultivator may discover a tribulation was wrong or needs to be more specific); adding one is free in Step 1; the core discipline is picked for free at the end of Foundation (ruling 90) and Nascent Soul's set is free to change until it's locked (ruling 79) *(Step 1 prices and integrity-log entries since Main part 2 (ruling 67); late edits and deletions priced from the failure loss since part 3 (ruling 93); free edits and deletions before the Nascent Soul lock (ruling 79). Step 2+ prices come with Step 2.)*
- [x] &#91;v1\] Claim flow: optional LLM review that flags points the cultivator may have missed; the cultivator decides and confirms "I solemnly swear I have passed this tribulation"; optional evidence attachment (file, link, photo) *(Main part 2: the oath, evidence references and an LLM review marker, always "skipped" until the LLM review exists; see New to-dos.)*
- [x] &#91;v1\] Missed deadline: no extensions; the tribulation fails, Qi is lost, and it stays in place for the cultivator to set a new date; extra tasks are required before the next attempt, even if the result is now within reach *(The Qi and gold lost are the extra tasks required: ruling 65.)*
- [x] &#91;v1\] Adding tribulations never demotes a level; changing the core discipline costs Qi and sends the cultivator back to early Core Formation, not Foundation *(Rulings 77, 78 and 85.)*
- [ ] Verified vs. self-reported badge on each breakthrough *(Claims record evidence and the LLM review marker; the badge waits for the LLM review.)*
- [x] Manual override to advance any realm, logged as such (the game must remain finishable) *(Ruling 84.)*
- [x] &#91;v1\] Tribulation passed with Qi short: marked "passed, waiting for Qi"; the breakthrough triggers once the threshold is reached *(`realmStatus` reports `waitingForQi`.)*

**Gaps**

None open.

## Rest, failure and recovery

The comeback after a bad week must cost less than quitting the app, or users leave.

- [x] &#91;v1\] Vacations: rest periods bought with gold; the avatar travels to visit the Nine Marvels; tribulation deadlines keep their dates, and the request screen says so *(RestStarted at 20 gold a day; deadlines keep their dates (ruling 70). The screens and the avatar wait for the app.)* *(Since ruling 161: priced by realm in days of income, at most 14 days at a time and 30 in any 91.)*
- [x] &#91;v1\] Closed-door cultivation: a free "feeling ill / burnout" button; the avatar enters a cave; up to 14 days at a time and 30 days per quarter; tribulation deadlines extend by the days spent inside, and the request screen says so *(RestStarted, free, 14 days at a time and 30 a quarter; deadlines extend (ruling 70). The screens and the avatar wait for the app.)*
- [x] &#91;v1\] While resting (vacation or closed-door): no tax, the companion sleeps (no food loss) and the soul is frozen (no demon growth) *(Rest skips the tax, food loss and demon growth (ruling 8); since ruling 167 it freezes the food meter both ways, so no treats either.)*
- [x] &#91;v1\] Qi deviation: entered when procrastination-tax debt hits its cap; a short comeback quest clears both the state and the debt

**Gaps**

None open.

## Heart demons and vows

A heart demon is a thought, feeling, mood or behavior the cultivator wants to change. Demons grow on their own unless fought, so ignoring Soul never protects you from them.

- [x] &#91;v1\] Create a heart demon: what to change, one or more positive tasks that counter it, and negative tasks (habits) that feed it; every demon starts at 50% HP *(HeartDemonCreated, at 50% HP.)*
- [ ] &#91;v1\] Creation warning: make sure you want to fight this demon, because deleting one has a cost *(Waits for the app.)*
- [x] &#91;v1\] A soul task links to exactly one demon; a soul quest can link to several (one meditation session can attack several demons) *(Task ids are unique across demons; a soul quest links at least 2 (ruling 14).)*
- [x] &#91;v1\] Completing a positive task damages its demon by 5% HP; logging a negative task heals it by 10% *(`positiveDamage` 5, `negativeHeal` 10.)*
- [x] &#91;v1\] Passive growth: after 3 days without a positive task, a demon heals 1% a day; the rate rises with soul color, up to twice as fast at Rainbow *(Ruling 3; a soul wearable can freeze it (ruling 118).)*
- [x] &#91;v1\] Defeated demons keep growing passively; a defeated demon that climbs back to 50% HP revives
- [x] &#91;v1\] At most one new demon per week *(Ruling 4.)*
- [x] &#91;v1\] Deletion lock: a demon can't be deleted in its first week, so nobody stays White forever by deleting demons before they reach 70% *(`demon_deletion_locked`.)*
- [x] &#91;v1\] Deleting with a growth color: the soul drops to White, with a warning first *(Ruling 1; the warning waits for the app.)*
- [x] &#91;v1\] Deleting at White: allowed, but with no demon left at the end of the day the soul drops to Broken
- [x] &#91;v1\] Deleting with a weakening color: the last demon can't be deleted, and each deletion feeds the remaining demons until at least one is at 80% HP *(Ruling 7.)*
- [x] &#91;v1\] Renaming: an undefeated demon can be renamed and its tasks redefined, for a cultivator who wants to fight a different demon first; locked while defeated, allowed again after revival (as is deletion); a renamed demon below 50% HP goes to 50%, one above keeps its HP *(HeartDemonRenamed.)*
- [ ] "Seek new demons" flow when the cultivator lacks enough to advance (guided reflection, LLM prompts) *(Waits for the LLM and the app.)*
- [x] Awakening alert before a demon's HP crosses 70%, 80% and 90%, and at day's end if one is above 70% *(`demonAlerts` projects each crossing; showing them waits for the app.)*

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
- [ ] Equipment slots: 1 armor, 1 weapon, 1 pet wearable, 1 soul wearable, 9 golden dragon scales (freed when the wings form), golden wings *(Armor and weapon slots and the stash since ruling 137; wearables, scales and wings are inventory counts until the avatar screen.)*
- [ ] Gear: armor and weapons per class, each with a durability bar *(Class-neutral base gear with durability bars since part 2 (rulings 137-145); class gear comes later.)*
- [ ] Cave abode: the same cave used for closed-door cultivation, upgraded with gold and decorated with cosmetic items from the shop
- [ ] Rest visuals: the avatar in its cave during closed-door cultivation, visiting the Nine Marvels on vacation; the companion asleep and the aura frozen
- [ ] Spirit Realm: the avatar becomes a spirit in its class avatar's form
- [ ] Layered 2D sprites so class look, pose, aura, halo, gear, wearables, wings and companion combine independently
- [ ] Cinematics: breakthrough attempt, realm breakthroughs, golden wings creation; animations for levels, poses and soul color changes
- [x] Items are only obtained (shop, drops, roulette), never crafted *(The rules have no crafting; every item comes from a server-rolled drop or the roulette.)*

**Gaps**

None open; alchemy and techniques are dropped.

## Notifications

Few and meaningful; guilt-trip spam is how Duolingo's notifications became a meme.

- [x] &#91;v1\] Push notifications only for losses that are close, at most 3 a day, most urgent first: *(`pushAlertPlan`.)*
  - Tribulation and core quest deadlines at 72, 48, 24 and 1 hour left *(in the push plan since Main parts 1 and 2, tribulations first)*
  - The soul turning Broken (a demon above 90% HP)
  - A defeated demon within 5% of reviving, or any demon within 5% of 70% HP
  - The companion within 5% of empty
  - An equipped item within 5% of breaking *(ruling 144: at the reminder time on the day the companion's damage takes the worn armor to 95%; with Swap and Repair actions, ruling 149)*
  - Worn armor a failure would break, with a tribulation due within 72 hours *(rulings 149, 153: damage plus the failure plus the companion's damage until then reaches 100%; with Swap and Repair actions)*
- [x] &#91;v1\] On a day with nothing urgent, one daily push reminding the cultivator to check the to-do list *(Ruling 128: at a chosen local time, 9:00 by default, muted during rest.)*
- [ ] &#91;v1\] Everything else (rewards, expiring tasks, tax, chronicle ready) goes to the in-app notification list, read on login *(Waits for the app.)*
- [x] Quiet hours *(Ruling 129: alerts inside them move to just before they start, never dropped.)*
- [x] During vacation, mute everything except tribulation deadlines (they keep running) and the return date; during closed-door cultivation, mute everything except the return date *(Main part 2: the push plan mutes the current rest and adds a return-date push.)*

**Gaps**

None open.

## Onboarding and integrity

The oath sets the tone; pre-commitment and visible logs do the actual work.

- [x] &#91;v1\] Oath screen: the user types "I will not fake my achievements and I will cultivate with all my heart." *(CultivatorCreated requires the exact text; the screen waits for the app.)*
- [x] &#91;v1\] The Qi Condensation interview is the onboarding: interests for Main, Body and Soul (see Main) *(InterviewAnswered.)*
- [x] &#91;v1\] First companion: a Turtle at 50% food
- [x] &#91;v1\] The soul starts Broken until the first heart demon and its counter tasks are identified
- [ ] Integrity log: every override, criteria edit, demon deletion or rename, and self-reported claim on one screen *(Every one of these is in the integrity log since engine pass 5 (ruling 130 added demon deletions and renames), with tribulation closures, faked passes, repents, deaths and archive churn; the screen waits for the app.)*

## Data and architecture requirements

Stack: TypeScript end to end, with React Native (Expo) for iOS, Android and web, and one rules package shared by the app, the server and the economy simulator.

- [x] &#91;v1\] Event-sourced store: only raw events are saved; Qi, gold, realms, companion food, demon HP, soul color and item durability are derived *(`@cultivation/rules` derives everything by replay.)*
- [x] &#91;v1\] A user ID on every event, so multi-user and social need no redesign
- [x] &#91;v1\] Versioned rules engine, so rebalancing replays history instead of migrating balances *(`rulesVersion` in the config.)*
- [ ] &#91;v1\] Offline-first logging that takes under 2 seconds *(Waits for the app.)*
- [ ] &#91;v1\] Mobile app with push notifications; engagement lives on the phone *(The push plan is in the rules; the app is not started.)*
- [x] Rules engine shared between client and server (one implementation of the game math) *(The simulator uses it; the app and server will import the same package.)*
- [x] &#91;v1\] Random outcomes (drops, roulette, companion behaviors) are stored as events, so replaying history under new rules never re-rolls them *(Every roll is a server-rolled outcome in an event; companion behaviors are cosmetic and need none.)*
- [ ] Export of all events (JSON/CSV) so the user owns the record *(Waits for the server and the app.)*
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

- [x] `taxForecast` shows pending postponed tax per task *(Ruling 131.)*
- [x] Revoking a false tribulation claim *(Ruling 126 for the current realm; repent for earlier realms, rulings 101-107.)*
- [ ] The LLM review on tribulation claims, and the verified vs self-reported badge
- [x] Linking a quest to a tribulation as its preparation *(Ruling 132: display only.)*
- [x] Integrity-log entry when closed-door rest starts within 72 hours of a tribulation deadline (visible, not penalized) *(Ruling 86.)*
- [x] Part 3 must restrict tribulation item rolls to tribulations that count toward the current realm (ruling 68); the daily-24h-tribulation persona earns 4x the honest rolls under the 7-day cap alone *(Ruling 82.)*
- [x] Deleting or editing late should cost more than failing (ruling 67), but a failure under ruling 80 can now take far more than the flat delete and late-edit prices *(Ruling 93.)*
- [x] Ruling 80's failure loss also hits tribulations that don't count toward the realm (e.g. in Qi Condensation it takes the balance down to 45) *(Ruling 89: no tribulation is ever non-counting.)*
- [x] Nascent Soul's 1,500 Qi takes an honest studier about 5 months when tribulations pass quickly; the design says years *(Ruling 87: kept at 1,500 with no time floor; the realm's purpose says it takes years.)*
- [x] Every level-up earns a legendary roll, but without the Lion or a halo ticket its chance is 0 *(Ruling 94.)*
- [x] Every Core Formation tribulation counts, so a daily 24-hour tribulation earns 52 item rolls a year against an honest 13; only the 7-day cooldown limits it *(Accepted as lying to yourself: ruling 99.)*
- [x] A late edit is rejected when Qi is below a quarter of the threshold (ruling 67), while a deletion is floored and never rejected (ruling 93) *(Ruling 100.)*
- [ ] The Spirit Realm spirit quoting a Nascent Soul tribulation from the hall of fame (ruling 96) waits for the narrative layer
- [ ] A realm-specific message with good and bad examples on the tribulation creation screen (ruling 87); later, an LLM check of the fit
- [x] A core discipline change returns to early Core Formation, and climbing its levels again earns new legendary rolls; only a repent blocks re-rolls (ruling 103) *(Allowed: ruling 111.)*
- [x] After 5 repents in a realm, every further repent kills the avatar; revival takes a week of work, so a cycler dies about every 3 weeks (57 deaths in 4 years in the simulator) *(Intended: ruling 110.)*
- [x] Lion pet wearables can only be worn at Lion, so a Body or Hybrid cultivator below Lion holds them unused (a studier Warrior got 3 in a year and wore none); they are forfeited at a class change *(Ruling 118: the pet wearable keeps the current tier, at any tier.)*
- [ ] Legendary versions of class wearables (visual plus bonus demon damage or gold) come in Roadmap part 4
- [x] Roadmap part 3: set real shop prices against the physical-practice personas *(Ruling 159: prices in days of physical-practice income per realm.)*
- [ ] Soul cadence: each demon needs a positive task about every 8 days just to hold (3-day grace, then 1% a day). Hitting one demon per session, 3 sessions a week fall behind with several demons and the soul ends Broken; daily practice reaches Red at week 83. With soul quests (one session hitting every demon, ruling 14), 2 sessions a week reach Golden by week 31 and end Rainbow, and after the 7 defeats the Soul middle loop has no payoff but the color clocks (longest gap 74 weeks). No retuning proposed yet *(Roadmap part 5: no retuning; soul quests as the default way to log soul practice; a new-demon persona checks the middle loop.)*
- [ ] Remove the temporary on-device roller (`apps/mobile/src/lib/roller.ts`) once the server rolls; it writes the same roll events, so the log needs no migration
- [x] Dev-only scenario loader for testing: builds a cultivator by generating and replaying a real event log (the simulator personas as seeds), plus a time-travel control to advance the clock. It exists only in the development build profile and is excluded from release builds; no cheat events in the rules engine *(Ruling 136.)*
- [ ] Immortal (and every realm above Spirit Realm) waits for Step 2+; the full-climb dev scenario stops at Spirit Realm until then
- [x] Gear dodge: companion damage only hit worn items, so taking gear off before midnight avoided it *(Resolved by ruling 147: every armor worn at any point that day takes the damage. Weapon wear by use was removed by ruling 166.)*
- [x] Ruling 80's "down to 75% of the threshold" absorbed armor's Qi saving on the next failure *(Resolved by rulings 147 and 153: armor applies after the ruling 80 loss, so an armored cultivator ends above the 75% line by the armor's Qi on every failure, and the before-deadline warning protects the armor.)*
- [x] Repairing at the 95% warning was too late against a failure *(Resolved by rulings 149 and 153: the computed before-deadline warning with one-tap Swap and Repair.)*
- [x] A new realm's free robe went to the stash when armor was worn *(Resolved by ruling 149: the System shows it with a "Wear" option.)*
- [x] A soul "lose item" drop with no potions held lost nothing *(Resolved by ruling 146: it takes stash gear, never worn gear; with nothing held, nothing is lost.)*
- [x] ~~Part 2 choices to confirm~~ *(Superseded: no buying, selling or repairing while dead (ruling 150); legendary potions drunk explicitly (ruling 151); selling at 70% of the value (ruling 155). The repent penalty order and full repairs stand (ruling 152).)*
- [x] *(Fixed with proposal E: the plan reads the realm after the day's claims and completions.)* The realm simulator's honest tribulation plan declares Core Formation's set of 6 in Nascent Soul when the breakthrough happens earlier the same day (the plan reads the realm once at the start of the day), instead of the set of 4 due at 6-12 months. Fixing it changes realms.csv and the cadence report
- [x] The 80% risk line missed the same night's companion damage *(Ruling 153: the line is computed, damage plus the failure's 20% plus the companion's damage until the deadline; 75% at Turtle for a deadline today. The simulator's failing beginner now loses no robe.)*
- [x] For a cultivator who never fails, armor was only a cost *(Ruling 154: without armor the companion takes Qi and gold instead; ruling 155 cut repairs to 10% of the value. The honest studier pays about 16 gold a year in robe repairs against 158 Qi and 158 gold without armor.)*
- [x] Repairing before selling paid from Core Formation shop gear up *(Ruling 155: a sale is 70% of the value, a full repair at most 10%, so repairing before selling now always pays, by design; no loop, since no item sells for its buy price.)*
- [x] Deleting an open tribulation or a late edit was floored while a failure left debt *(Ruling 156: they leave unforgivable debt too.)*
- [x] Ruling 148 choices: debt beyond the cap is dropped, and at the cap unforgivable debt replaces forgivable debt *(Accepted, ruling 156, with the fix that only new debt starts deviation again.)*
- [x] Ruling 146 and 151 choices: a soul "lose item" follows the repent order; an armed legendary potion survives repents and is lost at death *(Accepted, ruling 156.)*
- [x] ~~Weapon wear values (simulator values): 0.15% for a quick task or any other Qi gain, 0.4% a session, 1% a day, 2.5% a project. A daily session wears a shop weapon out in about 8 months; with ruling 155's prices its repairs cost about 1.6 gold a month. No weapon push (accepted, ruling 156); the Store and Realm screens warn at 95%~~ *(Superseded: ruling 166 removed weapon wear by use.)*
- [ ] The armor pushes' Swap and Repair buttons use notification categories; they need a phone test (Expo Go may not show them; a plain tap opens the Store)
- [x] Roadmap part 3: tune the unarmored-loss factor *(Ruling 162: 2, from the sweep; an unarmored Turtle loses 15.5-15.8% of its gold income. 1.5 gave 11.6-11.9%.)*
- [x] Weapon prices, after the payback report *(Ruling 166 removes weapon wear by use; the weapon's prices and bonuses are part of the realm scaling plan (proposal E), with its payback projected there: 2, 14 and 37 days saved in Foundation, Core Formation and Nascent Soul for a studier.)*
- [x] The Qi Condensation banker banks 7 to 29 Foundation gear sets in 12 months *(Ruling 165: no cap; any realm's gear can be bought there and kept in the stash.)*
- [x] Shop armor doesn't pay for itself in Foundation for physical practice (84 gold for 34 avoided) *(Accepted, ruling 166.)*
- [x] Prices are nearly flat across realms while gear stats grow about 5 times: higher-realm gear is cheap for its stats *(Planned in proposal E: gear stats and one-time prices double per realm, recurring costs stay the same share of income. Awaiting review.)*
- [x] Ruling 150's scope while dead *(Ruling 164: nothing can be bought, closed-door rest stays free.)*
- [x] A free robe kept as insurance costs only its forgone sale, about 1.7-1.8 days of income, under the 2-day bar for an absorbed item penalty (a bought robe or gain potion costs 2.5) *(Accepted; with values doubling per realm (ruling 172), only Foundation's robe is under 2 days.)*
- [x] Vacations let a training cultivator climb tiers (food frozen while gym sessions fed the companion) *(Ruling 167: any rest freezes the food meter both ways. Re-run: the capped studier stays at Tiger, as without vacations.)*
- [x] A rest timed between training days still pauses food decay while the training days feed: an uncapped vacationer who rests on the days between gym sessions reached Lion. The cap (30 days in 91) holds the capped studier at Tiger *(Accepted under the cap (ruling 161) and the oath (ruling 173).)*
- [x] Ruling 167 choice: a routine at Lion with a full meter earns its golden ticket during rest *(Accepted, ruling 167.)*
- [x] Realm scaling (proposal E) *(Built: rulings 168-173.)*
- [ ] Upload claim evidence when the server exists (Roadmap part 6): photos are local references in the app's documents folder until then (ruling 175), so they are lost with the app's data and can't be reviewed by the LLM yet
- [ ] Phone test: the evidence picker (gallery, camera and links), and the admin mode toggle hiding the override
- [ ] Spirit Realm's completion cost (8K under ruling 169's doubling) is set when Step 2 designs its tribulations
- [ ] Replay my dogfooding log under rules 1.26.0 and review its anomalies: export it from the dev panel ("Export the log"), then run `pnpm --filter @cultivation/sim replay <file>`; each anomaly is a bug or an expected skip, tracked here
- [ ] Replaying an existing log under ruling 169: claims made under the old thresholds replay as awaiting completion (no TribulationCompleted events exist), so levels and realms drop until they are completed in the app; events the new state rejects are skipped and flagged (ruling 168), and breakthrough rolls of steps that no longer happen become orphan anomalies
- [x] The goblin who sells the free robes ends a year about 27 gold ahead of the honest play (74 Qi behind), and 46 ahead when it buys a cheaper robe back: bounded once per realm per lifetime (ruling 158), now worth more with prices doubling per realm (a Nascent Soul robe sells for about 118) *(Accepted, bounded: ruling 158.)*
- [x] Nascent Soul takes the honest studier 19 months (1.6 years) under ruling 169, at 4.8 months per completion *(Accepted, ruling 169: achievement-paced.)*
- [x] The weapon saves 1-2 days in Foundation (7 days of income), 14-25 in Core Formation (12.8 days) and 37 in Nascent Soul (25.7 days): in Foundation it doesn't pay *(Accepted, like Foundation armor (ruling 166); it pays from Core Formation.)*
- [x] Gain potions return 1-3% of their price in gold (a daily potion: 1,596-6,620 gold a year for 20-192 extra gold and 30-118 extra Main Qi). No loop, but a poor buy *(Intended: they're for big completion days. The big-day drinker (a potion only on the morning it completes a quest's project-effort milestone, about 51 a year) spends 2,314-2,356 gold for 841-858 gold back (0.4 per gold) and 3,134 extra Main Qi (1.3 Qi per gold), against 0.0 for the daily drinker. Still no loop.)*
- [ ] Fix the expo lint error in `apps/mobile/src/lib/notify.ts`: `AndroidImportance` not found in the `expo-notifications` namespace (there since before part 2)
- [x] Ruling 154 choices: the unarmored loss is floored at the balances, never debt, and keeps going while dead; a revived avatar gets no free robe again *(Accepted, ruling 158; the shop sells robes, ruling 157.)*
- [x] Free robes couldn't be sold, so they piled up in the stash *(Ruling 158: robes sell like other gear. The goblin confirms buying and reselling a robe always loses gold; selling the free robes gains at most their value once per realm per lifetime, e.g. 56 gold for the yellow robe while wearing a bought white one.)*

### Roadmap (Nov 19, 2026)

The order for the next sessions. Each part's plan is confirmed before it is built.

1. **Dev-only scenario loader** (simulator personas as seeds) with time travel, excluded from release builds. It makes the later parts testable.
2. **Base gear** *(done: rulings 137-158, merged from gear/base)*, the start of the gear system (small): class-neutral base armor (robes) and weapons per realm, with fixed stats per realm (ruling 138: gear never levels up). A free white robe on reaching Foundation Establishment. Small stats: armor reduces the Qi lost on a tribulation failure, weapons add to Qi gains (simulator values). Durability (companion damage, tribulation failure damage, repairs) is included here or comes right after, since buying replacements only matters once gear can be lost.
3. **Gold shop** *(done: rulings 159-167, merged from shop/gold; realm scaling followed it: rulings 168-173, built on realm-scaling)*, small: base gear of any realm (ruling 165; to replace lost equipment or save ahead), the existing priced services (vacations, class change, extensions) and gain potions. Legendary items and class wearables stay drop-only. Priced against the physical-practice personas.
4. **Legendary items**: a legendary roll gives the legendary version of the current realm's gear (ruling 121's pool per realm), plus the legendary class wearables. A proposal for what Unique classes get.
5. **Soul cadence**, no retuning. Soul quests (one session hitting several demons, ruling 14) are the intended practice, and the app makes a session-as-quest the default way to log soul practice. After Golden, the middle loop is finding new demons: a new demon dips the color until defeated, but the Golden clock keeps running (ruling 2). A simulator persona adds a demon about every 6 weeks, with a report of the middle-loop gaps.
6. **Minimal server** (Hono), local first: takes over all rolls (then the temporary roller is deleted), plus an LLM provider interface (Groq or Gemini via config; Gemini's free tier only with test data, since free prompts may be used by Google) and a privacy filter. Soul content is never sent unless opted in. No API keys in the app.
7. **LLM review of tribulation claims**, and the fit check at declaration (the realm purpose and the cultivator's field as context). The LLM checks that claim and evidence match the criteria; it can't verify the achievement, so the badge is "evidence reviewed", not "verified".
8. **Narrative**: chapters on breakthroughs and tribulation outcomes (pass or fail; not deletions or extensions), using the logs for context. The decided rules stay: tone chosen by the cultivator (pep talk, heroic, mocking), Soul content opt-in, demon names as written. Whether the weekly chronicle stays is still to be asked. Includes the Spirit Realm quote (ruling 96).

## Rulings

Decisions made while implementing the rules engine. They are settled: future sessions apply them without asking again. Where code and a ruling disagree, the ruling wins: fix the code. Where code and the rest of docs/design.md disagree, ask before changing either. A ruling a later one changed is rewritten in place to state the current rule, with an "(amended by N)" note.

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
15. A gained "item" is a potion, either kind 50/50 (ruling 58), until Roadmap part 4 adds legendary items to the drops; a lost item takes, in the repent order, a gain potion, then a class wearable, then a legendary potion, then stash gear, never worn gear and never a legendary item, scales or wings; with nothing to take, nothing is lost. *(Amended by rulings 58, 145 and 146.)*
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
33. The tax hits Qi and gold, never realm progress. It is deducted from the balances; what they can't cover becomes debt (balances never go below 0), and future gains repay the debt first. Debt is capped, and Qi deviation starts at the cap. The amounts are simulator values. *(The cap scales with the realm factor: ruling 170.)*
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
52. The realm taper applies to Qi only, and quests pay no gold bonus. A completed quest without a cancelled member earns one item roll: rolled on the server and stored in the event, at a chance scaled by the same effort bands (about 2% for a day of work, 8% for a week, 25% for a year), always below a tribulation's, and at most 2 quest rolls per local day. The item is a potion, either kind 50/50, until Roadmap part 4 adds legendary items. *(Amended by ruling 58.)*
53. Finished one-time tasks will be dropped from the replayed state in a later change; the name's decay history keeps what matters.
54. A completed quest's bonus is the cap for its members' days of work times their own Qi, without the curve limit from ruling 38, so the bands are what quests pay. A quest holds up to 52 members (weekly milestones for a year); the year band is reached by more members, not by a bigger effort unit.
55. A new version of a recurring task, created the same day the old one is archived or replacing it while open, takes over the old version's count for that day or week, so leveling up never owes tax.
56. "Work on this task today" counts as Main activity only if a Main task was completed in the last 14 days (rest excluded). Otherwise it is logged but neither counts nor uses up the task's cap. *(The 14-day rule is replaced by ruling 59.)* Work-on stays once per task per day; recurring tasks get no lifetime cap, since their missed occurrences are already taxed.
57. The cultivation streak is cosmetic: the number of days without Main idle. It breaks on the idle tax's condition (Main idle past its grace), also on days when an active recurring task replaces the idle tax with ticks; rest pauses it; it gives no rewards.
58. Potions are never crafted. Every potion drop (a soul or quest item, a tribulation item, a roulette potion) is 50/50 a gain potion or a legendary potion, rolled by the server within the same roll; gain potions are also sold in the shop, legendary potions never (ruling 160). Both are stored in the stash and drunk with a PotionUsed event. A gain potion adds +10% to the additive gold and Qi pool for 24 hours, one active at a time. A legendary potion is armed for the next realm breakthrough's legendary roll (+5%), one armed at a time; level-ups don't spend it, it survives repents and is lost at death. All potion numbers are simulator values. *(Amended by rulings 141, 151, 156 and 160.)*
59. "Work on this task today" postpones Main's idle tax instead of cancelling it; the 14-day rule from ruling 56 is removed. A day when Main would owe idle tax but for work-on, that day's tax is put on the task last worked on. Completing the task cancels its postponed tax; cancelling it, or letting it fail (expired past its extension window), charges all of it. The comeback quest forgives debt from idle tax and missed occurrences, but not debt from postponed tax; gains repay that part of the debt first. *(Ruling 148: unpaid tribulation failure losses are unforgivable debt too.)*
60. A quest may pay slightly more than one task of the same work (e.g. 4 hard days as a quest 481 Qi, one hard project 470). The bonus is paid in stages: each completed member pays its share at once, with the cap for the effort completed so far, not the planned effort; once every member is done, the total equals the cap for the whole quest. Stages already paid are kept if a member is later cancelled or fails.
61. Milestones stay quest members, not tribulations. A member that expires past its extension window fails and no longer blocks the quest: the quest completes when every other member is completed, cancelled or failed. The item roll still requires that no member was cancelled or failed. A quest whose members all failed or were cancelled is gone.
62. Part 3 sets the realm Qi thresholds against honest personas, not the hard-project-every-week one.
63. Accepted choices from Main part 1: a new version takes over the count only when the period type matches; any Main completion counts as a completion; the streak also breaks on days a recurring task replaces the idle tax with ticks; a gain potion boosts every gold and Qi gain, soul drops and the roulette included; a lost item takes a gain potion first; one server roll decides both a drop and its potion kind.

**Main path, part 2: tribulations (Nov 10, 2026)**

64. Part 2 builds the tribulation lifecycle: declare, lock, edit, delete, claim, fail and reschedule. Each tribulation records the realm it was declared in; Part 3 decides which tribulations a breakthrough needs and how they count.
65. A failure costs Qi and gold: the Qi part is ruling 80's 25% of the realm's cost (K times the realm factor; ruling 170), the gold part is 45 (simulator value), less the worn armor's reduction (rulings 142, 147). It is taken from the balances; what they can't cover becomes unforgivable debt, repaid first from gains, and new debt at the cap (scaled by the realm factor) starts Qi deviation (rulings 148, 156, 170). The loss is the "extra tasks before the next attempt": there is no separate task counter. One worn item takes 20% damage (ruling 166). *(Amended by rulings 80, 92, 142, 147, 148, 166 and 170.)*
66. Deadlines are at least 24 hours and at most 365 days out, with no limit on open tribulations. A failure is applied at the first local midnight after the effective deadline, or at the next event about that tribulation if sooner, and is dated at the deadline; a claim is allowed up to the deadline. A failed tribulation has no deadline until the cultivator sets a new one; rescheduling is free and repeatable, and every failure costs again.
67. The title and criteria can be edited, never the deadline. Step 1 prices: an edit is free within 1 hour of declaring (still logged), costs 20 Qi times the realm factor (ruling 170) during the first three quarters of the time from declaration (or the last reschedule) to the deadline, and costs a failure's loss (the ruling 80 Qi loss plus the failure gold) in the last quarter, so a late edit can't turn a hard tribulation into an easy one cheaply; the tribulation stays open (ruling 100). Deleting an open tribulation costs a failure's loss plus 2% (ruling 93); deleting a failed one costs 40 Qi times the realm factor, since the failure was already paid. Still rejected without enough Qi: an early edit or an edit of a failed tribulation (20 Qi times the factor) and deleting a failed tribulation (40 Qi times the factor). Never rejected: a late edit, deleting an open tribulation and deleting a faked pass; what the balances can't cover becomes unforgivable debt (ruling 156). A passed tribulation can't be edited; deleting one is only for a faked pass of the current realm (ruling 126). Adding is free in Step 1. From Step 2 on, adding is paid and editing and deleting cost the normal prices only, since tribulations become part of the discovery phase; those prices are set when Step 2 is built. All are simulator values. *(Amended by rulings 93, 100, 156 and 170.)*
68. Passing pays no Qi or gold. A passed tribulation earns one item roll at 50%, rolled by the server (a potion, either kind 50/50, until Roadmap part 4 adds legendary items), outside the daily roll cap, at most one per 7 days. Every tribulation counts toward its realm (ruling 89), and the class drop is a second roll under the same cooldown (ruling 119). *(Amended by rulings 82, 89 and 119.)*
69. A claim counts as Main activity; declaring, editing and rescheduling don't. A claim carries the oath "I solemnly swear I have passed this tribulation.", optional evidence references (file, link or photo) and an LLM review marker. There is no LLM yet, so the marker is "skipped".
70. Closed-door rest pushes tribulation deadlines back like any deadline (up to 14 days at a time and 30 days a quarter), with no extra limit; the simulator measures the maximum delay. Vacation keeps them. Entering it carries an oath (ruling 173). *(Amended by ruling 173.)*
71. Tribulation edits, deletions and claims are recorded in the integrity log.
72. Accepted choices from Main part 2: a closed-door rest started at the exact deadline extends it, for tribulations and tasks alike, since that is the last moment a claim or completion is allowed; editing a failed tribulation costs 20 Qi; the free first hour applies only after declaring, not after a reschedule; a drop stored on a claim inside the 7-day cooldown is ignored.

**Main path, part 3: realms and levels (Nov 11, 2026)**

73. Part 3 builds Step 1 only: Qi Condensation, Foundation Establishment, Core Formation and Nascent Soul. Passing Nascent Soul enters Spirit Realm, where progression stops until Step 2 is built.
74. Level-ups and realm breakthroughs cost no Qi: they happen automatically once their conditions hold (ruling 169: Qi is spent completing each tribulation instead), except Foundation to Core Formation, which waits for the cultivator's choice: form a core, or change foundation for free. *(Amended by rulings 90 and 169.)*
75. An AreaDecided event records the choice for Main, Body or Soul. Each area's first decision raises Qi Condensation one level (mid, late, great circle). The breakthrough to Foundation needs no tribulation claim and no Qi: it happens when the cultivator, with all three decided, confirms the lock (ruling 133). Changing a decided area follows ruling 88.
76. Foundation tribulations count in the order they're completed (ruling 169): the first completed reaches mid, the second late, the third great circle. Rescheduled ones still count; deleted ones don't. Fast track: a Foundation tribulation claimed with evidence has its completion cost paid at once by the evidence, exactly (no gain multipliers, never toward debt, no surplus Qi), for every Foundation tribulation, the ones past the first three included; those claims are logged in the integrity log. *(Amended by ruling 169.)*
77. A Main (foundation) change mid-Foundation costs Qi but doesn't restart Foundation or remove tribulations; the core discipline is picked, for free, with the end-of-Foundation choice (ruling 90). Changing the core discipline from Core Formation on costs Qi, closes all the old discipline's tribulations at no cost (passed ones stay in the record) and returns the cultivator to early Core Formation (ruling 91). *(Amended by rulings 90 and 91.)*
78. Core Formation's set is the tribulations declared in it under the current discipline. Its percentage counts completed tribulations (ruling 169), once the set holds at least 5; deleted tribulations leave the set, failed ones and claims awaiting completion stay as not completed. Levels come at 30, 60 and 90% completed, and the breakthrough to Nascent Soul at 100%. Adding a tribulation lowers the percentage but never a level already reached. *(Amended by ruling 169.)*
79. Nascent Soul has no levels: completing every tribulation in its set (ruling 169) transcends to Spirit Realm. On entering, the cultivator defines the set and locks it with an explicit event within 90 days (time for a research quest on what "expert" means); a set left unlocked is locked as it stands at the first midnight after day 90. Until the lock, edits and deletions are free (still logged) and claims are rejected. After it, adding is allowed and free in Step 1 (ruling 67; adding only makes the breakthrough harder), and edits and deletions cost the normal prices (rulings 67 and 93). *(Amended by ruling 169.)*
80. A tribulation failure takes 25% of the realm's cost (K times the realm factor: 87.5 Qi in Foundation, 175 in Core Formation, 350 in Nascent Soul, 700 in Spirit Realm); if the balance would still be above 75% of that cost, it takes enough to bring it down to 75%, so a failure always means extra work. The gold loss stays flat at 45. The simulator reports the largest single failure loss. *(Applies to every tribulation: ruling 92. Base amended by ruling 170.)*
81. ~~Qi thresholds for levels and breakthroughs~~ *(Replaced by ruling 169: no level or breakthrough threshold; each claimed tribulation is completed for its realm's cost, K = 350 in Foundation (its total stays 1,050 for three), 700 in Core Formation, 1,400 in Nascent Soul.)*
82. A passed tribulation earns its item roll only if it counts toward the current realm's breakthrough (rulings 76, 78, 79); the 7-day cooldown stays. *(Every tribulation counts since ruling 89.)*
83. Every level-up and realm breakthrough earns one server-rolled legendary-item roll. Its chance is the base chance (ruling 94: 2% for a level-up, more for a realm breakthrough, raised by ruling 111), plus the Lion's 2%, plus one halo ticket if one is available (+10%, used up), plus an armed legendary potion on a realm breakthrough (+5%, spent; ruling 151). A legendary item is stored in the inventory until Roadmap part 4 turns it into the current realm's legendary gear. *(Amended by rulings 94, 111, 141 and 151.)*
84. A RealmOverride event advances one level or realm, ignoring Qi and tribulations. It costs nothing and is logged in the integrity log. It is an admin tool, not a player option: the game stays finishable through fixes, not self-overrides. The app shows it only in a development build with the dev panel's admin mode on, never in release builds (ruling 174). The engine keeps the event, for existing logs, repents of overrides and admin use. *(Amended by ruling 174.)*
85. Levels never go down: not from the tax, tribulation failures, deleting a counted tribulation, or adding one. Only a discipline change (ruling 91) or a repent (ruling 102) moves the cultivator back.
86. Starting closed-door rest within 72 hours of an open tribulation's deadline adds a visible integrity-log entry; it is never penalized.

**Main path, part 3 review (Nov 11, 2026)**

87. Each Step 1 realm's tribulations have a purpose, kept with good and bad examples as a constant in the rules and shown when declaring one. Qi Condensation: no tribulations; choosing the three areas is its tribulation. Foundation: goals to conquer to discover which field of expertise you will pursue; they may span different fields. Core Formation: tangible achievements to become a professional in the chosen path. Good: passing a course, earning a credential, a professional license. Bad: "work on task 1", "complete project 1", "attend a class" (those are tasks or quests). Nascent Soul: tangible achievements that earn expertise and recognition in the path. Good: teaching the field at a recognized institution, building a successful company, reaching 1 million subscribers for a business, being cited in the field. Bad: earning a credential (Core Formation), "complete project 1" (a task or quest), "attend a class". In every realm, tasks and quests create the milestones toward a tribulation or help with daily life. Real achievement, not Qi, sets Nascent Soul's pace (ruling 169 replaced its 1,500 Qi: four completions of 1,400). *(Amended by ruling 169.)*
88. In Qi Condensation, changing an area is free until the breakthrough, which locks all three. After it, changing Body or Soul costs Qi, and changing Main follows rulings 90 and 91.
89. No tribulation is ever "non-counting": every tribulation declared in Foundation, Core Formation or Nascent Soul counts toward its realm. Declaring one in Qi Condensation, or in Spirit Realm until Step 2, is rejected.
90. Foundation tribulations may span different fields and are never wiped. A Main change mid-Foundation costs Qi but doesn't restart Foundation or remove tribulations. The core discipline is picked, for free, with the end-of-Foundation choice (CoreFormed carries it).
91. From Core Formation on, a discipline change costs Qi, closes all the old discipline's tribulations (open, failed and passed) at no cost, and returns the cultivator to early Core Formation. Passed ones stay in the record.
92. Ruling 80's loss applies to every tribulation; there is no flat-loss exception.
93. Deleting an open tribulation costs the ruling 80 failure loss plus 2% in Qi, and the failure gold plus 2%, taken like a failure: never rejected, and what the balances can't cover becomes unforgivable debt (ruling 156), so deleting is never cheaper than failing. A late-quarter edit costs the same as a failure (ruling 100). An early edit stays at 20 Qi and deleting an already-failed tribulation at 40 Qi, both times the realm factor (ruling 170). *(Amended by rulings 156 and 170.)*
94. Every level-up and realm breakthrough's legendary roll has a 2% base chance; the Lion's 2% and a halo ticket's 10% add to it. *(Realm breakthroughs' base chances raised by ruling 111.)*
95. Deleting from a locked Nascent Soul set costs the ruling 93 price. The transcendence needs at least 1 completed tribulation in the set. *(Amended by ruling 169.)*
96. Each breakthrough records the tribulations it consumed. A "conquered tribulations" projection (a hall of fame) lists them for the app, and the Spirit Realm spirit quotes a Nascent Soul tribulation from it.
97. Accepted choices from Main part 3: ~~Foundation's breakthrough Qi is waived only when all three counted passes had evidence~~ (gone with ruling 169: Foundation has no breakthrough threshold); a level-up uses the halo ticket that expires first; an override earns no legendary roll, and one at the end of Foundation skips the choice (the core discipline stays the current Main area); an area decision needs the interview, and a change isn't a new decision; locking needs at least 1 tribulation, and with nothing declared at the end of the 90 days the window starts again; a discipline change in Spirit Realm is rejected until Step 2.

**Main path, part 3 review, round 2 (Nov 11, 2026)**

98. Foundation has no tribulation cap. The first three passed set mid, late and great circle; more can be declared, and each counts toward Foundation (item rolls under the 7-day cooldown, and the hall of fame at the breakthrough). *(Counting is by completion: ruling 169.)*
99. Farming item rolls with daily short tribulations is accepted as lying to yourself; the 7-day cooldown stays the only limit.
100. A late-quarter edit costs the same as a failure (the ruling 80 Qi loss plus the failure gold, never rejected; what the balances can't cover becomes unforgivable debt, ruling 156) but is not a failure: the tribulation stays open with its deadline, and armor neither reduces it nor takes damage. *(Amended by ruling 156.)*
101. Repent is available only from Nascent Soul upward, to admit that tribulations of the previous realm were faked; faked tribulations of the current realm aren't repented, they are deleted as faked at the open-deletion price (ruling 126). A Repented event carries the text "I acknowledge that at least one of my tribulations was faked and I solemnly swear I will not do it again." and the ids of the previous realm's tribulations marked as faked (at least one). Those become failed at no cost and need a new date. An override into the current realm can be repented the same way, with no tribulations to mark.
102. A repent drops the cultivator, willingly, to the previous realm, at the level recalculated from that realm's tribulations still passed: the second exception to ruling 85, alongside discipline changes. The realm left closes its tribulations at no cost (they stay in the record) and resets its lock, so re-entering means defining and locking a new set (ruling 79); the closing works as for a discipline change (ruling 91). *(Reference corrected: the set and its lock are ruling 79.)*
103. A repent refunds no Qi. Legendary items earned by the repented breakthrough and its level-ups are removed if still held, and re-reaching those milestones earns no new legendary roll.
104. Repent escalation, counted per realm over the cultivator's lifetime: the 1st has only the effects above; the 2nd loses 1 inventory item; the 3rd loses 2 items and 25% of gold; the 4th loses the whole inventory, 50% of gold and 30% of Qi; the 5th and later lose the whole inventory, all gold and all Qi, and the avatar dies. Each penalty takes what exists; missing items aren't converted into gold or Qi.
105. More than 3 repents in one realm adds an integrity-log flag (e.g. cycling Nascent Soul to Core Formation for item rolls).
106. Death: everything can still be logged, but nothing pays Qi, gold or drops; the companion and heart demons keep running. The cultivator revives by creating and completing a revival quest of at least a week of work (ruling 51's week band). *(Ruling 150: nothing is bought, sold or repaired while dead either.)*
107. Repents and deaths are logged in the integrity log, and repented tribulations leave the hall of fame.
108. Every tribulation deletion goes in the integrity log, including free ones before a Nascent Soul lock and closures from a discipline change or a repent: a reminder not to rush decisions (for an honest deletion) or a reminder of cheating (for a dishonest one).
109. Accepted choices from Main part 3: a breakthrough closes the realm's open and failed tribulations at no cost; Nascent Soul claims are rejected before the lock; Spirit Realm has no tribulations until Step 2; the core discipline is picked for free with CoreFormed; a late edit takes the failure gold as well as its Qi.

**Main path, part 3 review, round 3 (Nov 11, 2026)**

110. The repent death loop is intended: from the 5th repent in a realm on, every repent kills the avatar and takes the whole inventory, all gold and all Qi. The repent counter is per realm, lifetime, and never resets; ascending to the next realm (e.g. from Nascent Soul to Spirit Realm) doesn't reset it.
111. Re-climbing after a core discipline change earns legendary rolls again ("eternal student" is a life choice). Realm breakthroughs pay more than level-ups: the base legendary chance on a breakthrough into Foundation is 5%, Core Formation 10%, Nascent Soul 20% and Spirit Realm 30%; level-ups stay at 2%. The Lion's 2% and a halo ticket's 10% add to both. All simulator values.
112. Accepted choices from Main part 3: a repent takes items least valuable first: gain potion, class wearables (soul, halo, keep), legendary potion, stash gear by sell price (never worn gear), scale, legendary item, wings (amended by rulings 118, 145 and 152); it undoes the breakthrough into the realm left and the previous realm's level-ups above the new level, cancels their unrecorded rolls, and blocks re-rolls only for milestones that earned a roll (an override never did); returning from Spirit Realm keeps Nascent Soul's lock and set; while dead, Qi, gold, golden tickets, inventory, debt repayment and drop rolls earned are all held back, losses still apply, and halo tickets are untouched; a revival quest is any quest defined after death, completed with no member cancelled or failed, with at least 7 days of work, and it pays nothing itself; faked tribulations don't add to their failure count; a Nascent Soul deadline passing before the lock fails normally (deleting before the lock is free); closures at a breakthrough are logged too.

**Main path, part 4: classes (Nov 11, 2026)**

113. A class is mandatory to enter Core Formation. It is chosen with the end-of-Foundation choice: CoreFormed carries it, and that first choice is free. A RealmOverride out of Foundation must carry one too (the class field is ignored on other overrides). Before Core Formation there is no class and no class bonus; from Core Formation on there is always one.
114. Changing class (a ClassChosen after the first) costs 500 gold (simulator value), with no cooldown, and is rejected without the gold. It is allowed from Core Formation until Spirit Realm locks it. The deterrent is losing the held wearables (ruling 118).
115. A class's gold and Qi bonuses join the additive pool on every gain (Body, Main, Soul drops, roulette; every Qi gain, Main included), never on losses, tax or failure costs. They come from the current class only.
116. A Main task or quest member can be tagged when defined to also count for Body, Soul, or both, as the class group allows (Body classes: Body; Soul classes: Soul; Hybrid: both; Unique: none). A paying completion then adds, for Body, a routine's treats (200) and a routine's gold (10 base, with multipliers), counted against the 2-routines-a-day cap; for Soul, one positive task's damage to the chosen demon, with no soul drop roll. It counts as activity on those paths for the tax. A session is logged once, never also as a Body activity.
117. Only tasks of session effort or longer can be tagged. Work-on earns no cross-credit.
118. Class wearables are consumables held in the inventory. A soul wearable freezes one chosen demon's growth for 7 days. A pet wearable either keeps the companion at its current tier for 30 days (no food loss and no demotion, while promotions still work; worn at Lion, it keeps the Lion) or grants a halo ticket; the server rolls which kind, 50/50. Wearing one activates it, and it is used up when the effect ends. Legendary versions (visual plus bonus demon damage or gold) come in Roadmap part 4. Changing class forfeits the held soul and pet wearables. *(Amended: part 4, not "with gear".)*
119. Class drop: a second server roll on each passed tribulation, under the same 7-day cooldown. Base chance 50%; Soul classes get a bonus by growth soul color, Body classes by fitness tier, and weakening colors and lower tiers never reduce it. Hybrid uses the higher of its two bonuses and drops a soul or pet wearable, 50/50, never both. All numbers are simulator values.
120. Monk and Sorcerer (Unique) get, in place of a wearable drop, a 2% legendary-item roll on each passed tribulation, under the 7-day cooldown. It doesn't apply to level-ups or breakthroughs.
121. "One legendary pool per realm" means each realm has its own set of legendary items that can drop, because gear is realm-locked; it is not about the chance. It comes in Roadmap part 4. *(Amended: part 4, not "with gear".)*
122. The class is independent of the discipline: it is kept through a discipline change, a repent and death. While dead nothing pays, so class bonuses and cross-credit gold pay nothing; demon damage still applies.
123. The class locks when Spirit Realm is entered: ClassChosen is then rejected. A repent from Spirit Realm to Nascent Soul unlocks it.
124. Tags the current class doesn't allow (after a class change) are ignored when the task completes, never rejected.
125. Accepted choices from Main part 4: Soul classes' drop bonus by soul color is green +2%, blue +4%, red +6%, golden +8%, translucent +10% and rainbow +12%, and Body classes' by tier is Panda +2%, Horse +4%, Tiger +6% and Lion +8% (simulator values); Hybrid drops a soul wearable 50%, a keep pet wearable 25% and a halo pet wearable 25%; Body cross-credit is scaled by the Main task's repetition decay, and only a paying completion earns cross-credit; a second soul wearable on a frozen demon, or a second keep while one is active, is rejected; a class change forfeits only held wearables, and worn ones keep running; a repent takes wearables right after gain potions (soul, then halo, then keep); while dead, wearable gains and class drops are held back like other drops; ClassChosen is rejected before Core Formation.

**Engine pass 5 (Nov 11, 2026)**

126. A claimed tribulation of the current realm, completed or awaiting completion, can be deleted as faked at the open-deletion price (ruling 93), taken like a failure, and is logged as tribulation_faked. The level reached stays (ruling 85), but the count toward the next step uses only tribulations still completed (ruling 169): in Foundation a later completion takes its place among the three; in Core Formation the percentage drops until it's replaced. The Qi paid to complete it is not refunded (ruling 170). A pass of an earlier realm is repented instead (rulings 101-107). Item and class drops the claim earned are kept. *(Amended by ruling 169.)*
127. Petting the Lion (CompanionPetted) pays 3 Qi with the Qi multipliers, once a local day, only at Lion. It isn't Body activity, and while dead it pays nothing (simulator value).
128. On a day with no other push, a daily reminder pushes at a local time the cultivator chooses (DailyReminderSet; 9:00 by default). It is muted during any rest; the rest's return date is that day's push.
129. Quiet hours (QuietHoursSet, a local window that may wrap past midnight; null turns them off): a push that falls inside them moves to just before they start, never later and never dropped. When the window's start has already passed, it goes out at once.
130. Demon deletions and renames are logged in the integrity log (demon_deleted, demon_renamed).
131. `taxForecast` lists each task's pending postponed tax: a one-time task's is charged the midnight after its extension window; a recurring task's only if it is cancelled (no date).
132. A quest may name a tribulation it prepares for (display only, no reward effect). The tribulation must exist and not be deleted.

**Dogfooding changes (Nov 11, 2026)**

133. Qi Condensation is only for cultivators undecided in at least one path. Its breakthrough threshold is 0. Once all three areas are decided, the app asks "Lock these areas and break through?"; confirming logs an AreasLocked event and breaks through at once. Before it, areas change for free (ruling 88). Choosing "decide later" keeps the cultivator in Qi Condensation, with the message: "Not sure yet? Create tasks and quests to explore this path. When you've decided, lock your areas to break through."
134. In Qi Condensation, Main tasks and quests pay gold but no Qi (and record no Qi toward a quest's bonus), so an undecided cultivator can't bank Qi and everyone enters Foundation on equal footing. Other Qi sources (soul drops, Lion petting, roulette) are unchanged.
135. App forms: a deadline is a calendar date, due at 23:59 local time that day, shown with the days left. Effort keeps its options (Quick, Session, Full day, Project) as its own field, "Effort: how much work this takes", with a description under each (under 30 min, 1-2 h, a day's work, several days of work); it stays self-rated and locked at creation (ruling 25). The due date is a separate section. After any breakthrough the app opens the Trials tab on the new realm's purpose, examples, next steps and self-check question.

**Dev scenarios (Nov 19, 2026)**

136. Development builds have a scenario loader with time travel; release builds leave it out (it is required only under `__DEV__`, and `check:release` fails if its code is in a production bundle). A scenario is a real event log built by running simulator personas through the rules engine (the shared package `@cultivation/scenarios`), ending just before today, with the scenario database's own user id (amended after review: not the real log's); there are no cheat events. Scenarios live in their own local database (cultivation-scenario.db), and the real log (cultivation.db) is never written by dev tools. Time travel moves only the app's clock, forward only, and only while the scenario database is open; going back means reloading the scenario. The scenarios: fresh start; Qi Condensation with all areas decided; Foundation early and one tribulation from great circle; Core Formation mid with class wearables; Nascent Soul before the lock; Spirit Realm (fast) and the full Step 1 climb; Body at Lion; Soul at Red with six defeated demons (Golden needs seven); a dead avatar; the first repent; a tribulation due tomorrow; Qi deviation at the debt cap; closed-door rest pushing a deadline back.

**Base gear (Nov 21, 2026)**

137. Gear has one armor slot and one weapon slot. The Store screen has two tabs, Shop and Stash: gear not worn lives in the stash, where it can be worn, repaired or sold for 70% of its value less damage, robes included (rulings 155, 158); worn gear is taken off first. While dead nothing is bought, sold or repaired (rulings 150, 164). Trading comes with the social layer. In Qi Condensation the cultivator wears ordinary clothes, but any realm's gear can be bought there and kept in the stash (ruling 165). *(Amended by rulings 150, 155, 158, 164 and 165.)*
138. Gear never levels up: each realm has fixed stats per item kind, and a breakthrough doesn't change worn gear. This replaces "on breakthrough, equipped gear levels up" and closes the level-up-then-repent exploit. The stat ladder at any realm R: free robe (R) < shop gear (R) < free robe (R+1) < legendary (R) < shop gear (R+1). Gear of the current or a lower realm can be worn, never a higher realm's; after a repent, worn gear of the realm left moves to the stash.
139. A free robe is given on first entering each realm, once per lifetime, by breakthrough or override: Foundation white, Core Formation yellow, Nascent Soul blue, Spirit Realm green. It is worn if the armor slot is empty, else it goes to the stash. After a repent the higher robe stays in the stash, and re-entering the realm gives none.
140. GearBought buys any realm's shop armor or weapon, or its robe, in any realm, Qi Condensation included (ruling 165: the event names the realm, the current one by default) (kind "robe", armor only, at the robe's value: half the realm's shop armor price; ruling 157), worn if the slot is empty and it is wearable (its realm or lower), else into the stash. Buying costs 100% of that realm's price. Prices (armor, weapon, robe): Foundation 84, 117 and 42 (about 5, 7 and 2.5 days of physical-practice income; ruling 159), doubling per realm (ruling 172): Core Formation 168, 234 and 84, Nascent Soul 336, 468 and 168, Spirit Realm 672, 936 and 336 gold. There is no free weapon. *(Amended by rulings 157, 159, 165 and 172.)*
141. A legendary potion adds 5% to the next realm breakthrough's legendary roll once drunk (armed) with an explicit PotionUsed event, one armed at a time; level-ups don't spend it, and a held potion not drunk adds nothing. *(Amended by ruling 151; amends ruling 83.)*
142. Worn armor lowers the Qi and the gold a tribulation failure takes, by a flat amount per item (robe, shop, legendary): Qi 8/12/20 in Foundation, doubling per realm (Core Formation 16/24/40, Nascent Soul 32/48/80, Spirit Realm 64/96/160; ruling 171), and gold 4/6/10 in every realm, like the failure's flat 45 gold; never below 0. It applies after the ruling 80 loss is computed, so an armored cultivator ends above the 75% line by the armor's Qi on every failure. Failures only: not late edits, deletions, tax or soul losses. Damage never weakens a stat: an item keeps its full effect until it breaks. With no armor worn, a failure takes the full ruling 80 loss; its 20% damage hits the weapon if one is worn, else nothing (ruling 166). *(Amended by rulings 147, 166 and 171.)*
143. A worn weapon adds a percentage to the additive Qi pool on every Qi gain: shop 2, 4, 8 and 16% from Foundation to Spirit Realm, legendary 1.5 times the shop item (3, 6, 12, 24%), so a weapon is never better than the next realm's shop weapon. *(Amended by ruling 171.)*
144. Durability, by slot (ruling 147): at each local midnight closing a day without rest, the companion damages every armor worn at any point that day: Turtle 5%, Panda 3%, Horse 2%, Tiger 1%, Lion none; it continues while dead, and with no armor worn it takes Qi and gold instead (ruling 154). A tribulation failure damages one item worn at its deadline by 20%, armor or weapon (ruling 166); passing never damages gear, and the weapon doesn't wear with use. No event carries damage; replay derives it. At 100% the item is lost. A repair restores an item fully, worn or in the stash, for 10% of the Foundation value of the same kind and slot, prorated by damage, in every realm (rulings 155, 172), always less than a failure's Qi and gold. Warnings: the avatar's "getting damaged" line from 50% (in the app only); at 95% a push at the reminder time that day and the avatar's "My equipment is almost broken; I should repair it before it's lost."; and the computed before-deadline warning (ruling 153), the last two with one-tap Swap and Repair (ruling 149). Damage carries over breakthroughs. Existing logs get their robes and damage by replay. The Horse's unequip behavior is cosmetic: gear keeps counting. *(Amended by rulings 147, 149, 153, 154, 155, 166 and 172.)*
145. Repent penalties ("1 item", "2 items", "whole inventory") take from the stash and held consumables, never worn gear. Death (the 5th repent in a realm and later) also takes worn gear, leaving the avatar in ordinary clothes. Ruling 15 extends: a soul "lose item" drop never hits worn gear. *(Soul "lose item" and stash gear: ruling 146.)*

**Base gear review (Nov 21, 2026)**

146. A soul "lose item" drop takes one item in the repent order (a gain potion, then class wearables, then a legendary potion), then stash gear, least valuable by sell price first; never worn gear (ruling 15), and never scales, legendary items or wings. With nothing to take, nothing is lost: missing items aren't converted (ruling 104).
147. Damage goes by slot; there are one armor and one weapon slot. The companion's daily damage (ruling 144's amounts) hits every armor worn at any point that local day and still held, so taking armor off before midnight doesn't avoid it and swapping armor during a day damages each; the weapon isn't hit by the companion. A failure's 20% hits one item worn at the deadline, armor or weapon, a deterministic pick (ruling 166); every gear event first applies missed deadlines, so a swap after a deadline can't move the damage. Passing never damages gear, and nothing wears with use. Armor lowers a failure's Qi and gold after the ruling 80 loss is computed, so an armored cultivator ends above the 75% line by the armor's amount on every failure; failing without armor always costs more, and so does wearing weaker armor to protect a better one. *(Amended by rulings 154 and 166: weapon wear by use removed.)*
148. There is no sleep state. What a tribulation failure's loss can't take from the balances becomes debt that the comeback quest can't forgive, like postponed tax (ruling 59): it is repaid first from future gains, and Qi deviation still starts when the debt reaches its cap. This amends ruling 65's "never debt". At the cap, unforgivable debt takes the place of forgivable debt. *(Ruling 156: late edits and open deletions leave this debt too; only new debt starts deviation again.)*
149. Before-deadline warning: when a failure of a tribulation due within 72 hours would break the worn armor (the line computed by ruling 153), the avatar warns, and a push goes out 72 hours before the deadline. That warning and the 95% push offer two one-tap actions: "swap with the best stash armor" (wearable, one the same line wouldn't break, the best failure reduction, then the least damaged) and "repair". Nothing is ever swapped automatically. A new realm's free robe put in the stash because armor is worn is shown by the System with a "Wear" option. *(Amended by ruling 153: the 80% line is computed.)*
150. While dead, nothing can be bought (gear, gain potions, vacations, extensions, class changes), and selling, repairing and all Qi and gold gains are forbidden (ruling 106); the Store blocks purchases. Closed-door rest is free and stays available. *(Amended by ruling 164; it amended ruling 137, which forbade only selling.)*
151. Legendary potions are stored in the stash and drunk with an explicit PotionUsed event (potion "legendary"). Drinking arms +5% for the next realm breakthrough's legendary roll, one armed at a time; level-ups don't use it, and a held potion not drunk adds nothing. This amends ruling 141's automatic use.
152. Accepted part 2 choices: repent penalties take stash gear after potions and wearables and before scales, least valuable by sell price first; a repair always restores an item fully, stash items included; the sell price (25% of the realm's shop price for the slot, half for a robe, double for legendary, less damage) stays provisional, checked by a goblin simulator persona that looks for arbitrage (buy-to-sell loops, selling free robes, repairing before selling). *(Sell price replaced by ruling 155.)*

**Base gear review, round 2 (Nov 21, 2026)**

153. Armor warnings. From 50% damage the avatar says "My armor is getting damaged; I should take care of it." in the app (no push). The before-deadline warning replaces ruling 149's 80% line with a computed one: for a tribulation due within 72 hours, it warns when the worn armor's damage plus a failure's 20% plus the companion's damage at every midnight until the failure is applied (the first midnight after the deadline, included) would reach 100%; 75% at Turtle for a deadline today, 80% at Lion. It also warns when the worn weapon is at 80% or more, since a failure's 20% may pick it (ruling 166; in the app, no push). It keeps the two one-tap actions (Repair fixes the item at risk; Swap is for armor), and the swap picks a stash armor that line wouldn't break. The push goes out 72 hours before the deadline; the projection doesn't change as the days pass. *(Weapon: amended by ruling 166.)*
154. Companion damage without armor: at a midnight that would damage armor, if no armor was worn at any point that day, the companion takes Qi and gold instead, each 2 times what repairing that damage on Foundation's shop armor would cost, in every realm (ruling 172) (simulator value, ruling 162), floored at the balances. There is none in Qi Condensation, where gear doesn't exist yet, none at Lion and none on rest days. With ruling 155's lower repairs, armor pays for itself in everyday use. The wear model: armor wears when taking damage (the companion, failures); the weapon only when a failure's 20% picks it (ruling 166). *(Amended by ruling 162: the factor is 2; wear model by ruling 166; Foundation's armor in every realm by ruling 172.)*
155. Pricing rules (part 3 sets the final numbers): an item's value is its realm's shop price for the slot times its kind's factor (robe half, shop 1, legendary double). Buying costs 100% of the price; selling pays 70% of the value, less its damage's share, robes included (ruling 158); a full repair costs 10% of the Foundation value of the same kind and slot, prorated by damage, so repairs stay a fixed share of income while one-time prices double (ruling 172). The goblin persona finds no loop: no buyable item sells for its price, and buying and reselling a robe always loses gold. *(Amended by rulings 158 and 172.)*
156. Debt: deleting an open tribulation, deleting a faked pass and a late edit leave what the balances can't cover as unforgivable debt, like a failure, so deleting is never cheaper than failing (ruling 93). Accepted: debt beyond the cap is dropped, and at the cap unforgivable debt takes the place of forgivable debt; deviation starts only when new debt is added, so debt the comeback leaves at the cap doesn't re-trigger it in a loop. Also accepted: a soul "lose item" follows the repent order (ruling 146), an armed legendary potion survives repents and is lost at death (ruling 151), and the weapon has no push. *(The weapon wear behind "no push" is gone: ruling 166.)*

**Base gear review, round 3 (Nov 22, 2026)**

157. The shop sells each realm's robe at its value, half the realm's shop armor price (Foundation 42, Core Formation 84, Nascent Soul 168, Spirit Realm 336 gold; rulings 159, 172), as the cheap way back into armor for a cultivator without one: GearBought with kind "robe", armor only. *(Prices amended by rulings 159 and 172.)*
158. Robes sell like other gear: 70% of their value, less damage (amending ruling 155's "free robes can't be sold"). Free robes are granted once per lifetime per realm, so the gold they create is bounded; buying and reselling a robe always loses gold (the goblin persona checks it). Accepted ruling 154 choices: the unarmored loss is capped at what the cultivator holds and never becomes debt; it continues while dead; a revived avatar gets no free robe again and can buy one (ruling 157).

**Gold shop (Nov 27, 2026)**

159. Shop prices are set in days of physical-practice income in each realm, measured by the simulator (3 years: Qi Condensation 13.5 gold a day, Foundation 16.7, Core Formation 18.2, Nascent Soul 18.2, Spirit Realm 18.3 from its 275-day stay): shop armor about 5 days, shop weapon about 7, the robe half the armor (2.5). All are simulator values; ruling 140 lists them. *(One-time gear prices double per realm from Foundation's: ruling 172.)*
160. Gain potions are sold in the shop (a PotionBought event), in every realm, Qi Condensation included, at a simulator price never below Foundation's robe: Qi Condensation and Foundation 42 gold, Core Formation, Nascent Soul and Spirit Realm 46 (about 2.5 days of income). Legendary potions stay drop-only, like legendary items and class wearables: gold must not buy legendary chance. Buying a potion while dead is rejected (ruling 150).
161. Vacations are capped: at most 14 days at a time and at most 30 days in any 91 (a vacation ended early counts only the days taken), and priced per day by realm, about one day of physical-practice income: Qi Condensation 14 gold, Foundation 17, Core Formation, Nascent Soul and Spirit Realm 18 (simulator values). The reason: actions still pay during rest (ruling 8) and decay doesn't age (ruling 19), so an uncapped vacation lets a cultivator earn with every punishment frozen. Potions and vacations can be bought in Qi Condensation; gear still can't (ruling 137).
162. Kept from the part 3 review: the class change at 500 gold (27.4 days of physical-practice income in Core Formation and Nascent Soul); extension pricing as it is (the item's base gold, at least 5); ruling 143's weapon bonuses; weapon prices are set by ruling 172. The unarmored-loss factor is 2, from a sweep of 1.0 to 3.0 that puts an unarmored Turtle at 15.5-15.8% of its gold income (1.5 gave 11.6-11.9%). *(Amended by ruling 172.)*
163. The Store has a third tab, Services: vacations are bought there, and the class change and extensions are shown with their prices and bought where they're used (the Realm screen, the Tasks tab).

**Gold shop review (Nov 27, 2026)**

164. While dead nothing can be bought: gear, gain potions, vacations, extensions and class changes (the Store blocks them). Selling and repairing stay forbidden. Closed-door rest is free, so it stays available. This amends ruling 150.
165. Shop gear of any realm, robes included, can be bought in any realm, Qi Condensation included, at that realm's price, and kept in the stash: GearBought names the realm (the current one by default; required in Qi Condensation). It can be worn only from its own realm on; the wearing rule is unchanged. There is no cap on what a Qi Condensation banker saves. The goblin re-run: buying Spirit Realm's weapon and selling it straight back loses about 3,840 gold a year. This amends rulings 137 and 140.
166. Foundation shop armor's failure to pay for itself at Lion is accepted. Passing a tribulation never damages gear, and nothing wears with use: ruling 147's weapon wear is removed. A failure's 20% hits one item worn at the deadline, armor or weapon, a deterministic pick (an FNV-1a hash of the tribulation id and its failure count); with only a weapon worn it hits the weapon. Since the weapon can break on a failure, the before-deadline warning also covers a worn weapon at 80% or more (in the app). This amends rulings 142, 144, 147, 153 and 156.
167. Any rest, vacation or closed-door, freezes the food meter both ways: no decay and no treats, so rest can't buy tiers. Body activity still pays as usual. The vacationer re-run: the capped studier stays at Tiger, as without vacations. Accepted: a routine at Lion with a full meter earns its golden ticket during rest (the meter is frozen full).

**Realm scaling (Nov 28, 2026)**

168. A replay never throws. An event the current rules reject (a log written under older rules, or a bug) is skipped and recorded as a replay anomaly with its reason (like ruling 16), and the replay goes on; skipped events don't move the clock. The dev panel lists the open log's anomalies and exports the log as JSON for the simulator's replay command. Test fixtures replay strictly: a skipped fixture event fails the test. Bugs and anomalies are tracked in New to-dos (no GitHub issues until the MVP).
169. Completing a tribulation is a purchase. A claimed tribulation is "passed, awaiting completion" until the cultivator confirms spending its realm's completion cost in Qi from the balance (debt can't pay), with a "Complete tribulation" button (TribulationCompleted); a "Ready to complete" prompt shows whenever the balance covers a waiting claim. Costs: K = 350 in Foundation, 2K in Core Formation, 4K in Nascent Soul; Qi Condensation has none, and Spirit Realm none until Step 2. The order of completion is the order that counts (Foundation's three). Only completed tribulations count toward levels, the Core Formation percentage and the transcendence. An awaiting claim is never a failure, can't be edited, and can be deleted as faked or repented; leaving the realm closes it at no cost. It is a purchase, so it is blocked while dead (ruling 164). Item and class rolls stay at the claim, under the same 7-day cooldown. In Foundation, a claim with evidence has its cost paid at once by the evidence, exactly (no gain multipliers, never toward debt, no surplus), for every Foundation tribulation, logged in the integrity log (ruling 76). This replaces the level and breakthrough Qi thresholds (rulings 74, 81), Nascent Soul's 1,500 Qi (ruling 87) and ruling 97's evidence condition. Real achievement, not Qi, sets Nascent Soul's pace.
170. The realm factor is 1, 1, 2, 4 and 8 from Qi Condensation to Spirit Realm. Every Qi price scales with it: the failure loss (25% of K times the factor, with the 75% line against it; ruling 80), edit and deletion prices, area and discipline change prices, and armor's Qi reduction (ruling 171). The debt cap scales with it too. Qi paid is never refunded: not on a repent, a faked deletion or a discipline change, and passing again means completing again.
171. Gear stats double per realm, keeping the stat ladder: armor's Qi reduction robe 8, shop 12, legendary 20 in Foundation, doubling per realm, with gold reductions flat (4, 6, 10) like the failure's flat gold; legendary armor stays under twice the same realm's shop armor. Weapons: shop 2, 4, 8, 16%; legendary 1.5 times the shop item.
172. Gold income is flat across realms. One-time purchases (shop gear and robes) double per realm from Foundation's prices, so saving for them, and pre-buying (ruling 165), is meaningful. Recurring costs stay the same share of income in every realm: a repair costs 10% of the Foundation value of the same kind and slot, prorated; the unarmored loss is based on Foundation's shop armor in every realm; vacations and gain potions keep their flat prices (rulings 160, 161).
173. Entering closed-door rest carries the oath "I solemnly swear I am not faking illness or burnout." (a constant, like the claim oath; the app requires a checkbox). It is required for events from rules 1.26.0 on (at or after Nov 28, 2026, UTC), so older closed-door events still replay. Closed-door rest starting within 3 days of a vacation's end adds a visible integrity-log entry, never penalized (like ruling 86). There is no shared rest cap: using closed-door rest to extend a vacation is lying to yourself. A simulator persona does it, to measure the effect (like ruling 24's "rates everything deadly"): over a year the extender adds 112 closed-door days to its 120 vacation days, logs 4 integrity entries, and ends at the same tier as an honest rester (Tiger), with about 4% less gold.
174. Controls that write events not meant for normal play are admin only. They live in the app's dev tree (src/dev), so release bundles leave them out, and in a development build they show only while the dev panel's admin mode is on (off by default; Expo Go always runs with __DEV__ set, so __DEV__ alone isn't enough). The release check fails if the admin override is in a release bundle. The audit found one such control, the realm override (ruling 84); every other control in the app writes events of normal play. The temporary on-device roller writes roll events by itself, standing in for the server, and is no player control.
175. The claim form attaches evidence (ruling 69): links, and photos from the gallery or the camera, up to 10. Until the server exists nothing is uploaded: a photo is copied into the app's documents folder and the claim stores that local reference. The claim's confirmation says what the evidence does: in Foundation it completes the tribulation at once, logged as a fast-track claim (rulings 76, 169); in other realms it is only stored with the claim, and completing still costs the realm's Qi.
