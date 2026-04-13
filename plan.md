1. **Move Furnace UI rendering**: Modify `games/builder.js` so that when `isFurnaceOpen` is true, we don't render the floating Furnace panel. Instead, we render the Furnace slots exactly where the Crafting UI normally appears inside the main inventory panel.
2. **Update Furnace UI click coordinates**: Update `handleFurnaceSlotInteraction` check coordinates to match the new slot positions so the user can interact with them.
3. **Hide Crafting UI when Furnace is Open**: Wrap the Crafting grid rendering and drop-target logic in `games/builder.js` with `if (!isFurnaceOpen)` so that it disappears when the Furnace UI is active, preventing visual and functional overlap.
4. **Pre-commit checks**: Run `pre_commit_instructions` and check the tests (e.g. `test_cuj.py`).
5. **Submit**: Submit the change with an appropriate commit message.
