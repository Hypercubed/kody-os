## 1. Bundle game

- [ ] 1.1 Add the `tictactoe-solo` bundle (board UI, tap-to-claim, random computer reply, win/draw detection, status line, New Game reset) and verify a full game completes against the hosted shell with no navigation
- [ ] 1.2 Verify illegal moves (taken cell, post-game taps) are no-ops with a visible status message and never corrupt the board
- [ ] 1.3 Verify the bundle meets the hosting constraints (inlined assets only, ES2019, single `<style>`, zero external links) and the shell chrome is unchanged around it

## 2. Guide + verification

- [ ] 2.1 Document tictactoe-solo as the second canonical bundle example in `pkg/docs/adding-an-app.md`
- [ ] 2.2 Run static checks and verify live on preview: install → play to a win, a loss, and a draw → remove cleanly
- [ ] 2.3 Verify `openspec validate` passes for the change
