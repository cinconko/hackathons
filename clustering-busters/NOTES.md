cau

# Clustering Busters: running notes

## 14 Nov

- Ringfall built in `pixel-game/`: full HD pixel frame, boss with 3 stages, ring drops in 3 rarities, fisherman shop every 30 s, fists / sword / bow / bombs. 9 rule tests pass, build works.
- Media folder: `pixel-game/public/media/` (`sprites/`, `audio/`, README on how to load files).
- Dev hooks for testing a moment of the fight: `?play`, `&t=30500` (fisherman there), `&stage=3`, `&shop`. Example: http://127.0.0.1:5173/?play&t=30500&shop
- Not tested by hand yet: movement, combat, drops and buying. Play one full fight.
- Removed: a scam-checker backend that was moved here by mistake. It belongs to the separate repo cinconko/clusterbusters, not to this project.
