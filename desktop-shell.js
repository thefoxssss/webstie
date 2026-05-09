import { GAME_DIRECTORY_ENTRIES } from "./gameCatalog.js";
import {
    arrangeDesktopIcons,
    createDesktopIcon,
    initDesktop,
    installFallbackOpenGame,
    installTaskbarFallbacks,
} from "./wms.js";

function toOverlayId(gameId) {
    if (gameId === "ttt") return "overlayTTT";
    return `overlay${gameId.charAt(0).toUpperCase()}${gameId.slice(1)}`;
}

installFallbackOpenGame();
installTaskbarFallbacks();
initDesktop();

GAME_DIRECTORY_ENTRIES.forEach((game) => {
    if (game.hidden) return;
    createDesktopIcon({
        id: game.id,
        title: game.title,
        icon: game.icon || "🎮",
        overlayId: toOverlayId(game.id),
    });
});

arrangeDesktopIcons();
