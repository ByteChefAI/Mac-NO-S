# Mac-NO-S

A browser-based desktop inspired by macOS, built with React, TypeScript, Zustand, and Tailwind CSS. Files and system preferences live in browser local storage. It can be installed as a PWA using the repository logo; its service worker caches the app shell and static resources while bypassing API requests. Custom SVG cursor artwork is supplied in `cursors/`. Safari's proxy and assistant APIs run in the Express backend.

## Run it

```sh
npm install
npm run dev:full
```

Open the Vite URL shown in the terminal. To install the PWA locally, run `npm run build` followed by `npm run preview:full`, then open `http://localhost:4173` in a supported browser and use its Install control. Service-worker installation is enabled in production builds, not the Vite development server. To run only the desktop, use `npm run dev`; Safari's proxy browsing requires `npm run server` in a second terminal. The proxy only accepts public HTTP(S) hosts and limits responses to 12 MB. Websites can still behave differently from a native browser, and the proxy does not guarantee compatibility with every site.

Mac Assistant defaults to Groq's `qwen/qwen3-32b` tool-capable chat model, discovers the models available to your key, and sends requests through the local Express `/api/assistant` route to avoid browser CORS failures. Add a Groq API key in the assistant's settings; it is held in session storage and forwarded per request, never persisted by the backend. Do not use a shared or untrusted browser profile for API keys.

Use the screen icon in the menu bar to ask Mac Assistant to analyze a shared screen, window, or tab. The browser displays its normal share picker; the app captures and sends one downscaled frame to an available vision-capable Groq model, then immediately stops the capture. Screen sharing is never kept running in the background.

Hey Mac voice control requires microphone permission and a browser with Web Speech recognition support. The first-run desktop callout explains the wake phrase and enables listening. Once enabled, it listens while the app or installed PWA is open; browser security does not allow a website to listen outside its own running page or after it is closed. The top menu bar's microphone button is push-to-talk: press and hold to record, then release to send the audio to Groq Whisper for transcription and command handling. Assistant actions animate a labeled cursor through Dock, Finder, and TextEdit controls instead of mutating files behind the interface. Spoken file and app commands operate on Mac-NO-S's virtual filesystem and desktop, not the host computer's shell or arbitrary host files.

## Implementation roadmap

1. **Core structure:** `src/system` owns typed application/window models and a persisted Zustand store; `src/apps` contains app surfaces; `server` hosts the optional Safari proxy.
2. **State manager:** window focus, z-order, visibility, frame, appearance, wallpaper, and the virtual filesystem are managed centrally in `src/system/store.ts`.
3. **Window manager:** `Window.tsx` implements dragging, edge/corner resizing, minimize, maximize, and close controls.
4. **Desktop shell:** `Desktop.tsx`, `MenuBar.tsx`, and `Dock.tsx` compose the desktop, status controls, app menus, dock, and custom pointer/drag/resize cursors.
5. **Built-in apps:** Finder, Terminal, TextEdit, Settings, Safari, and Mac Assistant use the shared OS store. Assistant tool calls can open apps and read or write virtual files; assistant access can be disabled in Privacy & Security.
6. **Safari proxy:** `server/index.ts` validates public destinations and redirects, bounds response size/time, and rewrites HTML, CSS imports, inline styles, and responsive image URLs through the proxy. It is a basic browsing bridge, not a hardened general-purpose web gateway.

## Proxy boundaries

An Express endpoint can proxy and rewrite many ordinary pages, but arbitrary websites are not reliably embeddable: complex JavaScript, WebSockets, service workers, authentication, and site-specific policies may not work. The Safari viewport uses a sandboxed iframe for isolation. The backend deliberately rejects localhost/private-network targets and revalidates redirects; it does not remove every upstream policy or provide access-control bypass guarantees.# Mac-NO-S