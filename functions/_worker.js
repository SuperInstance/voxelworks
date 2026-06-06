/**
 * VoxelWorks Pages Function — routes room paths to directory content
 * and ensures backing assets like game.js resolve correctly.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. Root → redirect to /hub
  if (path === '/' || path === '') {
    return Response.redirect(`${url.origin}/hub`, 302);
  }

  // 2. Direct asset routes (files that exist at room roots)
  //    Game engine assets live in /game-template/ on disk
  if (path.startsWith('/game-template/')) {
    // Let Pages serve it directly from the folder
    return env.ASSETS.fetch(request);
  }

  // 3. Room routes — serve each room's index.html
  const roomDirs = {
    '/hub': '/hub-room',
    '/studio': '/block-editor',
    '/lab': '/asset-lab',
    '/deck': '/ship-deck',
    '/game': '/game-template',
    '/composer': '/agentic-scratch',
  };

  for (const [route, dir] of Object.entries(roomDirs)) {
    if (path === route || path.startsWith(route + '/')) {
      // Try direct file first (e.g., /game/game.js → /game-template/game.js)
      const assetPath = path.replace(route, dir);
      const assetRequest = new Request(`${url.origin}${assetPath}`, request);
      const response = await env.ASSETS.fetch(assetRequest);
      // If file found, serve it
      if (response.status !== 404) return response;
      // Fall back to the room's index.html for SPA routing
      const indexRequest = new Request(`${url.origin}${dir}/index.html`, request);
      return env.ASSETS.fetch(indexRequest);
    }
  }

  // 4. Everything else — try as-is from Pages
  return env.ASSETS.fetch(request);
}
