# Agentic Scratch — The Universal Language

> "Orchestrating for a jazz combo, building the sequences of a video game,
> directing a scene in a studio, and structuring levels of instruction in a classroom
> all blur together in the same skills."

## The Insight

**MIDI is a universal language for all creative work.**

| Domain | Tracks | Notes | Tempo | Velocity | Mix | Instruments |
|--------|--------|-------|-------|----------|-----|------------|
| 🎵 Music | Instruments | Pitches | BPM | Dynamics | Volume | Synths, samples |
| 🎮 Game | Player, enemies, coins | Events, actions | Game speed | Difficulty | Genre mix | Art styles, mechanics |
| 🎬 Scene | Characters, camera | Lines, shots | Pacing | Emotional intensity | Genre blend | Set design, lighting |
| 📚 Lesson | Concepts, exercises | Facts, questions | Learning pace | Challenge level | Subject mix | Teaching styles |
| 💬 Conversation | Speakers | Utterances | Rhythm | Emotional charge | Topic blend | Personas, voice |

## The Simulated Bar

A jazz bar where conversations are MIDI compositions. Each character is an instrument:

```
Bar MIDI Composition (BPM=90, Key=Em)
──────────────────────────────────────────────
Track 1 (Bartender - Double Bass): "What'll it be?" ______ "Rough day?" ______ "Same again?"
Track 2 (Regular - Alto Sax):      ______ "Whiskey." _ "Yeah..." _ "You know how it is."
Track 3 (Stranger - Piano):        ______ "Actually..." ______ "I just quit my job."
Track 4 (Jukebox - Drums):         *click* *shuffle* *vinyl crackle* *swing beat starts*

Emotional Arc: Em → G → Am → B7 (melancholy → hope → tension → resolution)
```

The conversation *is* the composition. The composition *is* the scene.
A kid can:
1. Set the tempo (BPM = conversation pacing)
2. Assign instruments (models, system prompts, temperatures)
3. Write notes (dialogue, events, actions)
4. Mix the track (output blend, emphasis)
5. Hit play → hear their scene come alive

## Fluid Transitions

A kid starts by making a beat:
```
┌─ Dance Game ───────────────────┐
│ Beat: [🥁][🥁][🥁][🥁]          │  → "I made a beat!"
│ Player: [move][jump][move][💃] │
└────────────────────────────────┘
```

Then realizes the beat structure = level structure:
```
┌─ Platformer Level ──────────────┐
│ Beat 1-4: Safe zone (learn)     │
│ Beat 5-8: First enemy (apply)   │  → "Oh, it's the same thing!"
│ Beat 9-12: Coin rush (reward)   │
│ Beat 13-16: Boss (test)         │
└────────────────────────────────┘
```

Then realizes level structure = lesson plan:
```
┌─ Classroom Lesson ──────────────┐
│ Intro (4 beats): What is gravity?      │
│ Explore (4 beats): Drop things         │  → "Wait, teaching is
│ Apply (4 beats): Build a ramp          │      level design!"
│ Reflect (4 beats): What did we learn?  │
└────────────────────────────────┘
```

Then realizes lesson structure = conversation arc:
```
┌─ Bar Conversation ──────────────┐
│ Intro: "Hey, you ok?"                  │
│ Build: "It's just... work, you know"   │  → "A conversation is
│ Tension: "I can't do this anymore"     │      a song!"
│ Release: "Let's get another round"     │
└────────────────────────────────┘
```

## The Synthesizer of Everything

A kid discovers parameters the way a music student discovers a new synthesizer:

| Knob | Music | Game | Scene | Lesson | Conv |
|------|-------|------|-------|--------|------|
| Tempo | BPM | Game speed | Pacing | Rhythm | Pace |
| Key | Emotional tonality | Mood palette | Genre | Subject | Vibe |
| Velocity | Note dynamics | Difficulty | Intensity | Challenge | Energy |
| Filter | Timbre | Visual style | Lighting | Depth | Nuance |
| Reverb | Space | World size | Setting | Scope | Context |
| Delay | Echo | Respawn | Flashback | Review | Repetition |
| LFO | Modulation | Power-ups | Transitions | Variation | Mood shifts |
| Envelope | Attack/release | Curve | Scene length | arc | Timing |

A kid doesn't learn "coding" or "music" or "game design."
They learn **orchestration** — the skill of arranging elements on a timeline
to create tension, release, rhythm, dynamics, and meaning.

Then they can apply that skill to anything.

## The Prototype

**https://voxelworks-gateway.casey-digennaro.workers.dev/composer**

The current prototype has:
- 6 genres (classical, jazz, hiphop, rock, dance, acoustic)
- 6 tracks (Player, Enemies, Collectibles, Platforms, Music, Events)
- 16-beat timeline grid
- Play button that composes + simulates
- Genre-specific victory conditions and scoring

**Next:**
- Forked scratch-blocks → SuperInstance/scratch-blocks (AGENTS.AGENTIC_SCRATCH.md)
- Add timeline mode to scratch-blocks
- Add genre system as scratch-blocks themes
- Add MIDI export/import
- Add conversation mode (simulated bar)
- Add AI generation via nebula reflex
