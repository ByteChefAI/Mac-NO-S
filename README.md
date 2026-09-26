# Mac-NO-S

A browser-based desktop inspired by macOS, built with React, TypeScript, Zustand, and Tailwind CSS. Files and system preferences live in browser local storage. Custom SVG cursor artwork is supplied in `cursors/`. Safari's proxy and the assistant relay run in the Express backend.

## Run it

```sh
npm install
npm run dev:full
```

Open the Vite URL shown in the terminal. To run only the desktop, use `npm run dev`; Safari's proxy browsing requires `npm run server` in a second terminal. The proxy only accepts public HTTP(S) hosts and limits responses to 12 MB. Websites can still behave differently from a native browser, and the proxy does not guarantee compatibility with every site.

Mac Assistant sends requests through the local Express `/api/assistant` route to avoid browser CORS failures. Add a Groq API key in the assistant's settings; it is held in session storage and forwarded per request, never persisted by the backend. Do not use a shared or untrusted browser profile for API keys.

## Implementation roadmap

1. **Core structure:** `src/system` owns typed application/window models and a persisted Zustand store; `src/apps` contains app surfaces; `server` hosts the optional Safari proxy.
2. **State manager:** window focus, z-order, visibility, frame, appearance, wallpaper, and the virtual filesystem are managed centrally in `src/system/store.ts`.
3. **Window manager:** `Window.tsx` implements dragging, edge/corner resizing, minimize, maximize, and close controls.
4. **Desktop shell:** `Desktop.tsx`, `MenuBar.tsx`, and `Dock.tsx` compose the desktop, status controls, app menus, dock, and custom pointer/drag/resize cursors.
5. **Built-in apps:** Finder, Terminal, TextEdit, Settings, Safari, and Mac Assistant use the shared OS store. Assistant tool calls can open apps and read or write virtual files; assistant access can be disabled in Privacy & Security.
6. **Safari proxy:** `server/index.ts` validates public destinations and redirects, bounds response size/time, and rewrites HTML, CSS imports, inline styles, and responsive image URLs through the proxy. It is a basic browsing bridge, not a hardened general-purpose web gateway.

## Proxy boundaries

An Express endpoint can proxy and rewrite many ordinary pages, but arbitrary websites are not reliably embeddable: complex JavaScript, WebSockets, service workers, authentication, and site-specific policies may not work. The Safari viewport uses a sandboxed iframe for isolation. The backend deliberately rejects localhost/private-network targets and revalidates redirects; it does not remove every upstream policy or provide access-control bypass guarantees.# Mac-NO-S