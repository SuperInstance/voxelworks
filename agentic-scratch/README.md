# Agentic Scratch — MIDI for Games

> "Music composition and game making are the same thing."
> Different genres have different scoring, victory conditions, and what makes them great.
> Classical = puzzle. Jazz = sandbox. Hip Hop = flow. Rock = action. Dance = party. Acoustic = story.

## The Core Idea

Instead of vertical Scratch blocks snapped together, **horizontal blocks on a timeline** — exactly like a MIDI sequencer. Each track is a game element (Player, Enemies, Collectibles, Platforms, Music, Events). Each beat is a block. The composition *is* the game.

## Genre → Game Mapping

| Music Genre | Game Genre | Victory | What You Score On |
|-------------|-----------|---------|-------------------|
| **🎻 Classical** | Puzzle / Precision platformer | Perfect sequence completion | Accuracy, minimal moves |
| **🎷 Jazz** | Sandbox / Creative | Hit score target your way | Creativity, unexpected combos |
| **🎤 Hip Hop** | Flow / Rhythm runner | Reach end without breaking combo | Beat accuracy, flow state |
| **🎸 Rock** | Action / Combat | Max energy through the finale | Combos, big moments |
| **💃 Dance** | Party | Keep crowd energy up | Beats followed, move variety |
| **🎵 Acoustic** | Story / Journey | Complete the emotional arc | Story beats, atmosphere |

## Why This Works for Kids

1. **They already understand genres.** A kid knows what "hip hop" feels like vs "classical." We map that to game feel.
2. **Timelines are intuitive.** Kids understand "what happens next" on a timeline. Blocks become notes.
3. **It's musical.** The play button runs the composition. Every block makes a sound. You *hear* your game before you play it.
4. **Victory is creative, not fixed.** Each genre has different win conditions. You don't "win" at jazz the same way you "win" at rock.

## Architecture

```
Genre Template → Track Structure → Block Palette → Timeline Composition → Play/Test

Each genre defines:
- Available block types
- Track layout
- Win conditions  
- Scoring criteria
- Visual theme (colors, fonts, vibe)
```

## How to Play (as a kid)

1. Pick a genre that matches the game you want to make
2. Blocks appear on the palette — drag them to the timeline
3. Each track controls a different part of the game
4. Click blocks on the timeline to remove them
5. Hit ▶ to hear your composition play
6. Each block makes a musical note — you can hear your game
7. When it sounds right, switch to play mode and test it

## The Moat

This can't be copied by Roblox or Minecraft because:
- **It's composition, not construction.** The mental model is different.
- **Genre mastery is the game.** Kids don't just learn to code — they learn what makes each genre tick.
- **Music is universal.** Every kid understands music. Code is scary. Timelines are not.
- **The output is both a game and a song.** Share the URL. Friend hears it. Friend makes their own.
