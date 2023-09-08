# Changelog

## Version 0.9.19 (2023-09-08)

### Fixes

* Adjusted showing movement information in realistic movement mode only when helper grid is shown.
* Adjusted position and colors of the helper grid.
* Optimized room connection performance and fixed excessive server load coming from it.

## Version 0.9.18 (2023-09-07)

### New

* Fancy rocket guidance system, not yet available to use anywhere.
* Implemented very dumb trajectory-guided movement for new realistic movement mode.

### Fixes

* Fixed several server-crash issues.
* Fixed font loading issues, especially in Firefox. Adjusted fonts for 3d objects to be the same.
* Adjusted a bit buggy auto-targeting to never include the source of the target selection.
* Numerous internal refactorings.

## Version 0.9.17 (2023-05-28)

### New

* Experimental and not-yet-controllable rocket shooting mode.

### Fixes

* A lot of visual positioning issues for game objects were fixed, the coordinate system is now y-axis-up everywhere.
* Fixed more issues with not updating planets properly outside of camera view.
* Optimized network usage a lot, improved both client and server performance.
* Fixed bugs where main menu couldn't be opened after closing the dialogue window.
* Fixed a bug where it was possible to dismiss otherwise non-closable dialogue window via esc.

## Version 0.9.16 (2023-01-23)

### Fixes

* Fixed a bug where ships were not updated properly when they were outside the camera view.
* Fixed a bug where planets were not updated properly when they were outside the camera view.

## Version 0.9.15 (2023-01-22)

### New

* Added experimental movement mode for ships with more realistic speed, acceleration and momentum conservation.
* Added velocity capabilities for game object and used them to make ship wrecks continue flying forward after being
  destroyed.
* Potentially introduced some bugs with health and item pickup effects, which will be fixed later.

### Fixes

* Fixed a time discrepancy between ship blow up moment and ship wreck appearance, which should lead to better UX.

## Version 0.9.14 (2023-01-15)

### Fixes

* Added an explanation for play button being disabled in case of version mismatch.
* Fixed a problem with server version observability.

## Version 0.9.13 (2023-01-15)

### Fixes

* Restored replay capabilities and the test replay.
* Fixed a bug that led to jerky planet movement in case of counter-clockwise rotation.
* Augmented build system for better observability of versions.

## Version 0.9.12 (2023-01-11)

### Fixes

* Optimized client performance and network bandwidth usage even more.

## Version 0.9.11 (2023-01-11)

### Fixes

* Optimized client performance and network bandwidth usage.

## Version 0.9.10 (2023-01-10)

### Fixes

* More client-side performance improvements.
* Fixed a bug where non-player ships were not moving smoothly after leaving a planet.
* Restored 4 bots in CargoRush mode.
* Restored broken leaderboard.

## Version 0.9.9 (2023-01-08)

### New

* Added a better explosion shader

### Fixes

* Improved overall client performance
* Fixed ship explosion-related performance issues

## Version 0.9.8 (2023-01-05)

### Fixes

* Build system upgrade

## Version 0.9.7 (2023-01-05)

### Fixes

* Repaired the build problems that broke the last release

## Version 0.9.6 (2023-01-05)

### Fixes

* Significantly improved performance of pirate defence
* Generally optimized network traffic consumption

## Version 0.9.5 (2022-12-07)

### Fixes

* Changelog text fix
* Fixed the width of the random portrait button on the main screen

## Version 0.9.4 (2022-12-07)

### Fixes

* Build chain issues fixes that prevented previous releases

## Version 0.9.3 (2022-12-06) - failed release

## Version 0.9.2 (2022-12-06)

### New

* Introduced better performance metrics

### Fixes

* Improved PirateDefence performance

## Version 0.9.1 (2022-12-04)

### New

* Re-introduced display of server vs client state desync time
* Introduced closing UI windows by pressing esc

### Fixes

* Fixed some synchronization bugs
* Fixed server crash issue for long-running rooms
* Fixed a bug where active dialogue and other windows hotkeys were triggering background actions like shooting when
  pressing 1-2 and other keys.

## Version 0.9.0 (2022-12-03)

### New

* A huge rewrite of the networking and state synchronization
* Likely huge amount of bugs added, fixes coming soon
* Camera moves more smoothly now

### Fixes

* Some unknown amount of bugs fixed, mostly ship position related

## Version 0.8.6 (2022-04-06)

### Fixes

* Fixed a bug when it was impossible to join the game in any mode

## Version 0.8.5 (2022-04-05)

### Fixes

* Fixed lacking help notifications in CargoRush mode
* Improved stability of the game logic

## Version 0.8.4 (2022-03-16)

### Fixes

* Made replays much smoother-looking via interpolation
* Reduced the size of replays

## Version 0.8.3 (2022-02-27)

### Fixes

* Significantly improved replay playing performance
* Restored buttons animation

## Version 0.8.2 (2022-02-27)

### New

* Very crude replay system, now only with a test replay

### Fixes

* Improved test coverage
* Significantly improved determinism of all game rules

## Version 0.8.1 (2022-01-12)

### New

* 2 bots in pirate mode by default

### Fixes

* Friendly bot ships in pirate defence mode are no longer auto-focusable for attack purposes.

## Version 0.8.0 (2022-01-12)

### New

* Added a bot in pirate defence mode that can follow the planet and shoot the pirates.
* Added earning money for killing pirates in pirate defence

### Fixes

* Fixed broken landing on planets in cargo rush mode
* Fixed broken tutorial dialogues
* Fixed various annoying browser errors
* Fixed a bug where minimap object positioning was incorrect after window resize
* Made minimap smaller
* Fixed amount of bots in cargo rush mode
* Optimized performance of the client code added in 0.7.x

## Version 0.7.10 (2021-12-10)

### New

* Added actions bar for more complex ship & player actions
* Added support for shooting with different ship turrets via different abilities
* Implemented showing of the shoot cooldown on those action bar buttons

## Version 0.7.9 (2021-12-04)

### New

* Changed the layout of the UI, money & health are not on top of the system actions panel.
* Leaderboard window is now hidden by default
* New actions bar, currently the only action is shooting
* The amount of pirate ships is now scaled by the amount of players

### Fixes

* No more annoying visual flickering when hovering on buttons in Chrome

## Version 0.7.8 (2021-11-27)

### New

* More pirate ships per wave in the pirate defence mode, but the planet now regenerates health

### Fixes

* Fixed server crash in sandbox mode
* Fixed non-blocked context menu (no more browser menu on right click)
* Now it's impossible to shoot your own ship
* It's impossible now to land on the planet in the pirate defence mode

## Version 0.7.7 (2021-11-27)

### New

* Turrets on ships! Only visual so far, but now ships do not shoot out of their center.

## Version 0.7.6 (2021-11-26)

### New

* Reworked the resources loading system
* Implemented resource preloading during menu stage, so now joining games is faster

### Fixes

* Fixed a bug with annoying screen flickering when a ship was exploding for a first time
* Removed already-buggy 'skip menu' option

## Version 0.7.5 (2021-11-23)

### New

* Explosion sounds!

### Fixes

* Fixed a client freeze bug that happened either after rejoining a room or finishing pirate mode

## Version 0.7.4 (2021-11-21)

### Fixes

* Improved the ship model positioning to make model weight center closer to the object center
* Adjusted explosion parameters to be a bit bigger and noticeable

## Version 0.7.3 (2021-11-21)

### New

* Ship explosions and wrecks added for more fun! For now, very modest and simple.

## Version 0.7.2 (2021-11-09)

### New

* Different configuration of ships for pirate defence - more ships, faster spawn, but they are slower and more brittle.

## Version 0.7.1 (2021-11-08)

### Fixes

* Auxiliary release due to infrastructure failure

## Version 0.7.0 (2021-11-08)

### New

* New game mode - pirate defence. Try to shoot down some pirate ships that are going to capture your home planet.
* Separate autofocusing mechanic for hostile ships (and a separate hotkey to shoot)
* NPC concept, currently used in the pirate defence mode. These ships aren't really players!

### Fixes

* Fixed buggy showing/hiding of leaderboard window on game start/end

## Version 0.6.23 (2021-08-31)

### Fixes

* Improved server performance.
* Fixed several bugs that led to inability to join rooms after leaving them.
* Fixed lack of time-passing after initial state generation, that also led to invalid and unplayable systems.

## Version 0.6.22 (2021-08-29)

### New

* Reworked room system. Now, whenever you join Cargo Rush mode, and nobody is playing, you will always join a new room.
* Improved resource caching and loading speed.

### Fixes

* It is now impossible to start playing (to enter the play menu) if the server is down or is of a different version.

## Version 0.6.21 (2021-07-24)

### Fixes

* Less desync for trajectory display - it won't jump as much, specifically for planets.

## Version 0.6.20 (2021-07-23)

### New

* Finally, working ship shooting. Try blowing up some bots!

### Fixes

* Fixed some client crashes related to docking.
* Fixed broken quest notifications substitutions.

## Version 0.6.19 (2021-07-22)

### Fixes

* Fixed ugly max-width for ultra-wide monitors.
* Improved client performance a bit.

## Version 0.6.18 (2021-07-21)

### New

* A better-looking docking and undocking process for the ships.

## Version 0.6.17 (2021-07-04)

### Fixes

* Hide names and effects of now-invisible docked ships.

## Version 0.6.16 (2021-07-04)

### New

* Docked ships are now invisible.

### Fixes

* Removed unnecessary console logging.

## Version 0.6.15 (2021-07-02)

### New

* Space background now has a slight parallax effect relative to camera position.

### Fixes

* Space background is no longer zoomed together with camera.

## Version 0.6.14 (2021-06-29)

### New

* Manual ship movement is now acceleration-turn-based, rather than axis-aligned direction-based. Essentially,
  pressing W does no longer move you up, but rather forward to wherever your ship is facing.
* Disabled ping calculation due to change of the network mechanics (see fixes).

### Fixes

* Improved server-side communication so less data is sent back and forth.
* Somewhat fixed manual movement lags - no more horrible rollbacks, although there are still some little ones.

## Version 0.6.13 (2021-06-26)

### New

* Ships now have more accurate size, matching the selection outline.

### Fixes

* Client-side performance improvements.
* Server-side performance improvements.
* Temporarily disabled context menus as they were impacting rendering too much.

## Version 0.6.12 (2021-06-13)

### New

* Planets and ships are now interactable with, using the new mechanism.
* There is now an auto-focus for the closest interactable object.
* If the object is focused either via mouse or via auto-focus, you can now execute the default (first) interaction by
  pressing E.
* It is possible to shoot at ships now, but it will do nothing apart from the visual effect.

### Fixes

* Slight client performance improvements.

## Version 0.6.11 (2021-06-07)

### New

* Pew-pew! Now it's possible to shoot. Only at minerals and containers, though. Try context menu - Shoot.
* Now the long actions (e.g. system jump and respawn) display their name on top of the progress indicator.

### Fixes

* Server and client performance optimizations

## Version 0.6.10 (2021-06-05)

### New

* Reworked the object interaction system. Now every interactable object
  (containers and minerals, as before) has a context menu that shows possible actions.

### Fixes

* Fixed a bug that caused the main window content to overflow and shor an ugly scroll.

## Version 0.6.9 (2021-05-26)

### New

* Subtle main menu background.

### Fixes

* Temporary removed sandbox commands causing client crashes.

## Version 0.6.8 (2021-05-24)

### New

* Quest window is now replaced with a permanent quest notification.

## Version 0.6.7 (2021-05-14)

### New

* A notifications panel for more interactive and rich information flow.
* Help button and window are now replaced with the new, dismissable, notifications that describe mostly the same thing.
* Better-looking money and HP display.

## Version 0.6.6 (2021-05-12)

### Fixes

* Fixed broken tutorial mode.
* Fixed ugly-looking outline for hp display.

## Version 0.6.5 (2021-05-12)

### New

* Random containers with loot now seeded for every system. Grab them and sell the contents for lots of money.
* When something is picked up - a container, or a mineral, a new fancy visual effect will appear.

### Fixes

* Leaderboard does not look like it has negative scores anymore.

## Version 0.6.4 (2021-05-08)

### Fixes

* Jumps now get cancelled when the game has ended.
* Jumps now get cancelled when the player ship has died.
* It's not possible to schedule multiple jumps at once anymore.
* Play button is now disabled when the server is down.

## Version 0.6.3 (2021-05-08)

### New

* Introduced jumping preparation time for inter-system jumping.

### Fixes

* Star map now gets closed after clicking on it.
* It's no longer possible to jump to non-adjacent systems.

## Version 0.6.2 (2021-05-07)

### Fixes

* Fixed star map background to fill the full window.
* Fixed a bug that led to hanging players (and their ships) after they left the game.

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
