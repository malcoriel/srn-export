# Changelog

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
