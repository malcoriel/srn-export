# Changelog

## Version 0.6.1 (2021-05-07)

### New
* Proper star map that replaces quick jump menu. Press M to display.
* Somewhat limited jumps (not any-to-any) and better randomized star systems.
* Star sizes are now a bit more varied.

## Version 0.6.0 (2021-05-01)

### New
* Multiple star systems support (press E to toggle teleport menu). So far, no quests or spawning there.

### Fixes
* Atmosphere of planets in the dialogue window is no longer white, and now properly matches the planet color.
* Small visual spacing bugfix for version display.

## Version 0.5.12 (2021-04-24)

### New
* Better stars background, no more disappearing and moving stars.

## Version 0.5.11 (2021-04-24)

### New
* Nicer-looking atmosphere for planets.

## Version 0.5.10 (2021-04-10)

### New
* Improved star shader generation, now stars can be of different colors and not look horrible.

### Fixes
* Fixed several client crashes caused by wrong texture filenames.

## Version 0.5.9 - lost by mistake

## Version 0.5.8 (2021-04-07)

### New
* Improved planet visualization, now the colors are much more varied.

## Version 0.5.7 (2021-03-28)

### New

* The planet visualization upgrade! Now everything is a Jupiter-like gas planet.

### Fixes

* Corrected z-index of entities on minimap, so that ships are no longer hidden behind the planets.
* Fixed lack of minimap moving on minimap clicks on planets and ships.

## Version 0.5.6 (2021-03-23)

### Fixes
* Added restarting server on error.

## Version 0.5.5 (2021-03-23)

### Fixes

* Repaired failing floating-point calculation, that led to generating significantly less planets and sattelites than
  intended

## Version 0.5.4 (2021-03-22)

### New

* Loader UI for loading heavy assets.

### Fixes

* Fixed server crash on merging items.
* Improved server stability.

## Version 0.5.3 (2021-03-21)

### Fixes

* Fixed incorrect line width for quest arrow.

## Version 0.5.2 (2021-03-21)

### New

* Replaced the quest trajectory line with a quest direction marker.

### Fixes

* Fixed the frame desync problem between main view and names overlay.
* Shared client-server code stability improvements.

## Version 0.5.1 (2021-03-18)

### Fixes

* Fixes for objects visibility (camera culling optimization):
  * No more star's "after-effects" when it leaves the camera view gradually.
  * No more "dead" planet copies matching last visible planet position.

## Version 0.5.0

### New

* Trading. Now every planet has a dynamic, randomly-updated market.
* Full-fledged trade interface replacing old "sell minerals" option.
* Splitting, merging, and rearranging items in the inventory.
* New types of items with their own icons. Mineral icons reworked.
* Saving, loading, downloading and generation of sandbox states.
* Generating sandbox state from the seed (you can view the current seed in the menu of the active game).
* Cheats menu in sandbox mode - now with 2 cheats, one for free items, another for invulnerability.
* Better UX for windows, some dark backdrops and refining of prompt windows.
* Dying now is fined by detracting 1000 SB from the player's budget.
* All control panel buttons now have hotkeys.

### Fixes

* Some clarifications about what is Sandbox mode
* Fixed a bug with styled borders - now direction of the ornament makes sense.

## Version 0.4.3

### New

* Sandbox mode for playing with planets. Highly experimental. Press G to enter the quick menu.
* Visual effects for pressing buttons via hotkeys.

### Fixes

* A bug where 'N' hotkey was able to open any window.

## Version 0.4.2

### New

* Fancy hotkeys for buttons.

### Fixes

* Incorrect hotkey behavior when the chat is used.

## Version 0.4.1

### New

* Bots dialogue delays are now a bit random, to avoid funny action mirroring.

### Fixes

* Fixed a bug where entering a tutorial room led to removal of all ships from the main room.

## Version 0.4.0

### New

* Private game rooms.
* A tutorial mode (so far the only purpose for private rooms).
* Significant visual rework of the dialogue window.
* Visual rework of the scrollable ui elements.
* Quit hotkey (press Q in the main menu when in-game).

### Fixes

* Server-side code maintainability issues.
* Some network bugs.

## Version 0.3.14

### New

* Prepared server-side infrastructure for tutorial rooms.

### Fixes

* Restored missing hp & money display.

## Version 0.3.13

### Fixes

* Further optimized client-side rendering, reduced CPU usage significantly at the cost of some throttled visual changes.

## Version 0.3.12

### Fixes

* Optimized client-side rendering, reduced CPU usage.

## Version 0.3.11

### New

* Inventory system.
* Minerals now have to be sold on the planets.
* Improved dialogue system.

### Fixes

* When you die carrying a quest item now, you'll fail the quest.
* Fixed a bug with duplicating planets.

## Version 0.3.10

### Fixes

* More simulation CPU improvements. Experimental simulation culling by camera.

## Version 0.3.9

### New

* In-game chat.
* PRNG-based system generation with seed exposure in the menu.

### Fixes

* Simulation CPU performance improvements.
* Better window toggling, minimized mode is not skipped anymore.

## Version 0.3.8

### New

* Global chat in lobby.
* Changelog display.

## Version 0.3.7

### Fixes

* Fix bots freezing on planets.

## Version 0.3.6

### Fixes

* Significantly improved server-side performance.

## Version 0.3.5

### New

* Money display in the controls panel.
* Link to the telegram channel on the leaderboard.

## Version 0.3.4

### New

* Minerals now spawn in the asteroid belts and can be tractored to gain money.

### Fixes

* Various visual glitches.
* Incorrect minimap coordinates and viewframe.
* Problems with client-server logic desync.

## Version 0.3.3

### New

* Planet outlines on the minimap for the better visibility.

### Fixes

* Dockerization, restarts in case of a crash.
* Reconnection issues fixed.
* Client CPU leaks fixed.

## Version 0.3.2

### New

* Asteroid belts!
* New system generation algorithm to include them.
* Ships are now visible on the minimap.

## Version 0.3.1

### New

* Ships can die and respawn

### Fixes

* Better leaderboard showing at the end of the game

## Version 0.3.0

### New

* Awesome window system with custom borders!
* Much better ping/fps panel.
* Help, leaderboard, quest windows reworked.
* Overhead timer panel.
* You can now burn when you are near the star... but not die - yet.

### Fixes

* Improved network performance
* Lighter CPU load on both client and server
* Better FPS

### Older version history was not recorded
