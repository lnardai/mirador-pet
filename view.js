// A placeholder pet until the art style is settled: a round body, one eye that blinks, a bob, hearts when patted.

/** The pet's modes, as the host lists them, with what the pet says in each until the model answers. */
const LINES = {
  encouraging: "You've got this.",
  motivating: "One more step. Go!",
  calming: "Breathe. One thing at a time.",
  quiet: "…",
  playful: "Boop! Tag, you're it.",
  cheeky: "Oh, another bug? Shocking.",
  wise: "Slow code is still code.",
  curious: "Ooh, what are we building?",
  proud: "Look at you go!",
  sleepy: "*yawn* …still here.",
  grumpy: "Hmph. Fine, I'll watch.",
  dramatic: "Behold! A function is born!",
};

/** The alignments, as the host lists them. */
const ALIGNMENTS = ["lawful good", "neutral good", "chaotic good", "lawful neutral", "true neutral", "chaotic neutral", "lawful evil", "neutral evil", "chaotic evil"];

const RARITIES = { common: "Common", rare: "Rare", legendary: "Legendary" };

/** A five-pointed star's path, for the starry skin and the wizard's hat. */
function star(cx, cy, r) {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    const reach = index % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(angle) * reach).toFixed(2)} ${(cy + Math.sin(angle) * reach).toFixed(2)}`;
  });
  return `M${points.join(" L")} Z`;
}

/** The hats, as the host lists them: their own colours, and their drawing, whose .main parts take a skin. The head's top is at (48, 18). */
const HATS = {
  beanie: { name: "Beanie", rarity: "common", colors: ["#d9534f", "#f4efe4"], svg: `<path class="main" d="M26 28 C26 2 70 2 70 28 Z"/><rect class="accent" x="24" y="22" width="48" height="8" rx="4"/><circle class="accent" cx="48" cy="4" r="5"/>` },
  cap: { name: "Cap", rarity: "common", colors: ["#3f7fd0", "#f4efe4"], svg: `<path class="main" d="M28 26 C28 4 68 4 68 26 Z"/><path class="main" d="M60 21 Q80 19 89 27 Q74 28 60 27 Z"/><circle class="accent" cx="48" cy="9" r="2.5"/>` },
  party: { name: "Party hat", rarity: "common", colors: ["#9b5de5", "#ffd23f"], svg: `<g transform="rotate(-12 48 22)"><path class="main" d="M34 24 L62 24 L48 -18 Z"/><path class="accent" d="M38.7 10 L57.3 10 L55.3 4 L40.7 4 Z"/><circle class="accent" cx="48" cy="-19" r="4"/></g>` },
  flower: { name: "Flower", rarity: "common", colors: ["#f48fb1", "#ffd54a"], svg: [0, 72, 144, 216, 288].map((angle) => `<circle class="main" cx="${(66 + Math.cos((angle * Math.PI) / 180) * 6).toFixed(1)}" cy="${(18 + Math.sin((angle * Math.PI) / 180) * 6).toFixed(1)}" r="5"/>`).join("") + `<circle class="accent" cx="66" cy="18" r="4"/>` },
  top: { name: "Top hat", rarity: "rare", colors: ["#2b2b33", "#c0392b"], svg: `<rect class="main" x="34" y="-14" width="28" height="36" rx="2"/><rect class="accent" x="34" y="12" width="28" height="6"/><rect class="main" x="24" y="20" width="48" height="5" rx="2.5"/>` },
  beret: { name: "Beret", rarity: "rare", colors: ["#c0392b", "#7a1f16"], svg: `<g transform="rotate(-8 48 18)"><ellipse class="main" cx="46" cy="16" rx="26" ry="9"/><rect class="accent" x="45" y="3" width="3" height="6" rx="1.5"/></g>` },
  chef: { name: "Chef's hat", rarity: "rare", colors: ["#fbfbf8", "#d8d6cf"], svg: `<circle class="main" cx="36" cy="2" r="11"/><circle class="main" cx="60" cy="2" r="11"/><circle class="main" cx="48" cy="-5" r="13"/><rect class="main" x="32" y="2" width="32" height="18"/><rect class="accent" x="31" y="16" width="34" height="8" rx="2"/>` },
  viking: { name: "Viking helmet", rarity: "rare", colors: ["#8a919c", "#f1e6c8"], svg: `<path class="accent" d="M30 16 C18 13 11 3 13 -10 C19 1 26 5 34 7 Z"/><path class="accent" d="M66 16 C78 13 85 3 83 -10 C77 1 70 5 62 7 Z"/><path class="main" d="M24 26 C24 -4 72 -4 72 26 Z"/><circle class="accent" cx="48" cy="6" r="2.5"/><circle class="accent" cx="36" cy="14" r="2"/><circle class="accent" cx="60" cy="14" r="2"/>` },
  wizard: { name: "Wizard hat", rarity: "legendary", colors: ["#3b3f9e", "#ffd54a"], svg: `<path class="main" d="M28 23 L68 23 L56 -8 Q55 -24 72 -30 Q48 -28 44 -10 Z"/><ellipse class="main" cx="48" cy="23" rx="29" ry="5"/><path class="accent" d="${star(52, 6, 5)}"/><path class="accent" d="${star(41, 15, 3)}"/>` },
  crown: { name: "Crown", rarity: "legendary", colors: ["#f2c230", "#d6336c"], svg: `<path class="main" d="M28 24 L28 2 L38 13 L48 -4 L58 13 L68 2 L68 24 Z"/><circle class="accent" cx="48" cy="16" r="3.5"/><circle class="accent" cx="36" cy="19" r="2"/><circle class="accent" cx="60" cy="19" r="2"/>` },
};

/** The skins, as the host lists them: what they fill a body or hat with, and the colour of the pet's legs and hands under them. */
const SKINS = {
  ink: { name: "Ink", rarity: "common", fill: "#222", limb: "#222" },
  slate: { name: "Slate", rarity: "common", fill: "#5a6b7d", limb: "#3e4b59" },
  moss: { name: "Moss", rarity: "common", fill: "#5f7f4f", limb: "#435a37" },
  plum: { name: "Plum", rarity: "common", fill: "#6e4a7e", limb: "#4e3359" },
  rose: { name: "Rose", rarity: "common", fill: "#d0839a", limb: "#9c5a6e" },
  stripes: { name: "Stripes", rarity: "rare", fill: "url(#skin-stripes)", limb: "#b0562a" },
  spots: { name: "Spots", rarity: "rare", fill: "url(#skin-spots)", limb: "#3a3a3a" },
  stars: { name: "Starry", rarity: "rare", fill: "url(#skin-stars)", limb: "#1b2a52" },
  gold: { name: "Gold", rarity: "legendary", fill: "url(#skin-gold)", limb: "#8a640a" },
  galaxy: { name: "Galaxy", rarity: "legendary", fill: "url(#skin-galaxy)", limb: "#1b1446" },
};

/** The patterns and gradients the rarer skins fill with; the legendary ones shimmer slowly. */
const SKIN_DEFS = `
  <svg class="skin-defs" width="0" height="0" aria-hidden="true"><defs>
    <pattern id="skin-stripes" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(35)"><rect width="10" height="10" fill="#e07a3f"/><rect width="4" height="10" fill="#f6d6a8"/></pattern>
    <pattern id="skin-spots" patternUnits="userSpaceOnUse" width="18" height="18"><rect width="18" height="18" fill="#efe8d8"/><circle cx="5" cy="5" r="3.5" fill="#3a3a3a"/><circle cx="14" cy="13" r="2.5" fill="#3a3a3a"/></pattern>
    <pattern id="skin-stars" patternUnits="userSpaceOnUse" width="16" height="16"><rect width="16" height="16" fill="#25386b"/><path d="${star(4, 4, 2.4)}" fill="#ffd54a"/><path d="${star(12, 11, 1.7)}" fill="#fff3b0"/></pattern>
    <linearGradient id="skin-gold" x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect">
      <stop offset="0" stop-color="#a8780a"/><stop offset="0.42" stop-color="#f0c63e"/><stop offset="0.5" stop-color="#fff6c2"/><stop offset="0.58" stop-color="#f0c63e"/><stop offset="1" stop-color="#a8780a"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="-1 -1; 1 1" dur="6s" repeatCount="indefinite"/>
    </linearGradient>
    <linearGradient id="galaxy-glow" x1="0" y1="0" x2="1" y2="0.4" spreadMethod="reflect">
      <stop offset="0" stop-color="#1b1446"/><stop offset="0.35" stop-color="#5b2a8c"/><stop offset="0.7" stop-color="#2a4a9c"/><stop offset="1" stop-color="#b56ad0"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="0 0; 2 0" dur="12s" repeatCount="indefinite"/>
    </linearGradient>
    <pattern id="skin-galaxy" width="1" height="1" patternContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#galaxy-glow)"/><circle cx="0.18" cy="0.26" r="0.015" fill="#fff"/><circle cx="0.57" cy="0.12" r="0.012" fill="#fff"/><circle cx="0.78" cy="0.57" r="0.018" fill="#fff"/><circle cx="0.36" cy="0.74" r="0.012" fill="#fff"/><circle cx="0.6" cy="0.86" r="0.01" fill="#fff"/><circle cx="0.3" cy="0.45" r="0.01" fill="#fff"/></pattern>
  </defs></svg>`;

const options = (values) => values.map((value) => `<option value="${value}">${value}</option>`).join("");

const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: light dark; }
  body { margin: 0; font: 13px/1.4 system-ui, sans-serif; color: CanvasText; background: Canvas; }
  .pet { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; user-select: none; }
  .scene { position: relative; width: 100%; max-width: 340px; padding: 4px 0 10px; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; align-items: center; background: linear-gradient(#bfe0f2, #e8f4fa); }
  .scene > .speech, .scene > .stage { z-index: 1; }
  .scene.dawn { background: linear-gradient(#d9c2dd, #f8dcc4); }
  .scene.dusk { background: linear-gradient(#b9a3cf, #f3c3a2); }
  .scene.night { background: linear-gradient(#1c2342, #313c66); }
  .ground { position: absolute; left: -10%; right: -10%; bottom: -34px; height: 56px; border-radius: 50%; background: #b5d8a6; }
  .night .ground { background: #2b3b45; }
  .dawn .ground, .dusk .ground { background: #a5bf96; }
  .sun, .moon { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; }
  .sun { background: #ffd45c; box-shadow: 0 0 14px #ffe08a; }
  .moon { background: #f1efe2; box-shadow: inset -6px -2px 0 #cfccb8; }
  .stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; opacity: 0.7; }
  .scene:not(.night) .stars, .scene:not(.night) .moon, .scene.night .sun { display: none; }
  .skin { fill: var(--body-fill, #222); }
  .limb { fill: var(--limb, #222); }
  .hands { stroke: var(--limb, #222); }
  .white { stroke: #222; stroke-width: 1.5; }
  .night .skin { stroke: #4a5683; stroke-width: 1.5; }
  .hat-art { filter: drop-shadow(0 0 0.6px rgba(0, 0, 0, 0.7)); }
  .hat-art .main { fill: var(--hat-main); }
  .hat-art .accent { fill: var(--hat-accent); }
  .skin-defs { position: absolute; }
  .wardrobe button, .ceremony button { font: inherit; color: inherit; cursor: pointer; }
  .boxes { position: absolute; left: 12px; bottom: 6px; z-index: 2; display: flex; align-items: flex-end; gap: 2px; }
  .boxes button { padding: 0; border: 0; background: none; cursor: pointer; animation: wobble 4s ease-in-out infinite; transform-origin: 50% 100%; }
  .boxes button:nth-child(2) { animation-delay: 0.7s; }
  .boxes button:nth-child(3) { animation-delay: 1.4s; }
  .boxes button:hover { animation-duration: 0.6s; }
  .boxes .more { font-weight: 700; font-size: 12px; color: #222; margin: 0 0 4px 2px; }
  .ceremony { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; background: color-mix(in srgb, Canvas 82%, transparent); backdrop-filter: blur(3px); animation: fade-in 0.25s ease-out; }
  .ceremony[hidden] { display: none; }
  .reveal { position: relative; width: 220px; height: 220px; display: grid; place-items: end center; }
  .rays { position: absolute; inset: -30px; border-radius: 50%; background: repeating-conic-gradient(color-mix(in srgb, var(--rarity) 55%, transparent) 0 10deg, transparent 10deg 24deg); mask: radial-gradient(circle, #000 25%, transparent 68%); opacity: 0; transform: scale(0.3); }
  .opened .rays { opacity: 1; transform: scale(1); transition: opacity 0.4s, transform 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); animation: spin 14s linear infinite; }
  .ceremony[data-rarity="legendary"].opened .rays { animation-duration: 6s; }
  .big-box { position: relative; width: 120px; height: 120px; overflow: visible; }
  .big-box .seam { fill: var(--rarity); opacity: 0; }
  .shaking .big-box .seam { animation: seam var(--shake-ms) ease-in forwards; }
  .shaking .big-box { filter: drop-shadow(0 0 0 var(--rarity)); animation: shake 0.5s ease-in-out infinite, glow-up var(--shake-ms) ease-in forwards; }
  .big-box .lid { transform-box: fill-box; transform-origin: 50% 100%; }
  .opened .big-box .lid { animation: lid-off 0.6s ease-out forwards; }
  .opened .big-box { filter: drop-shadow(0 0 12px var(--rarity)); }
  .prize { position: absolute; left: 50%; top: 20px; transform: translate(-50%, 50px) scale(0.2); opacity: 0; }
  .opened .prize { opacity: 1; transform: translate(-50%, 0) scale(1); transition: transform 0.6s 0.15s cubic-bezier(0.2, 1.5, 0.4, 1), opacity 0.3s 0.15s; }
  .prize svg { filter: drop-shadow(0 0 8px var(--rarity)); }
  .verdict { min-height: 64px; text-align: center; opacity: 0; }
  .opened .verdict { opacity: 1; transition: opacity 0.4s 0.5s; }
  .verdict .rarity { color: var(--rarity); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; }
  .verdict .prize-name { font-size: 20px; font-weight: 700; }
  .verdict .buttons { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }
  .verdict button { padding: 4px 14px; border-radius: 8px; border: 1px solid var(--rarity); background: Canvas; }
  .verdict .wear-prize { background: color-mix(in srgb, var(--rarity) 25%, Canvas); font-weight: 600; }
  .ceremony .hint { font-size: 12px; opacity: 0.6; margin-top: 8px; }
  .opened .hint { visibility: hidden; }
  [data-rarity="common"] { --rarity: #8e959c; }
  [data-rarity="rare"] { --rarity: #4a8cf0; }
  [data-rarity="legendary"] { --rarity: #e0a400; }
  .wardrobe { width: 100%; max-width: 340px; }
  .wardrobe summary { cursor: pointer; font-weight: 600; }
  .wardrobe summary span { font-weight: 400; opacity: 0.65; }
  .wardrobe h4 { margin: 8px 0 4px; font-size: 11px; font-weight: 600; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.04em; }
  .tiles { display: flex; flex-wrap: wrap; gap: 5px; }
  .tile { display: grid; place-items: center; width: 46px; height: 40px; padding: 0; border-radius: 8px; border: 2px solid var(--rarity, color-mix(in srgb, CanvasText 25%, transparent)); background: color-mix(in srgb, CanvasText 5%, transparent); font-size: 11px; }
  .tile[data-rarity="legendary"]:not(:disabled) { box-shadow: 0 0 6px color-mix(in srgb, var(--rarity) 60%, transparent); }
  .tile[aria-pressed="true"] { background: color-mix(in srgb, var(--rarity, CanvasText) 22%, Canvas); outline: 2px solid CanvasText; outline-offset: 1px; }
  .tile:disabled { cursor: default; opacity: 0.4; border-style: dashed; }
  .stage { position: relative; cursor: pointer; }
  .hand, .leg { transform-box: fill-box; }
  .hand.left { transform-origin: 100% 0; }
  .hand.right { transform-origin: 0 0; }
  .leg { transform-origin: 50% 0; }
  .wave .hand.right { animation: wave 1.4s ease-in-out; }
  .stretch .hand.left { animation: stretch-left 1.8s ease-in-out; }
  .stretch .hand.right { animation: stretch-right 1.8s ease-in-out; }
  .shrug .hand.left { animation: shrug-left 0.9s ease-in-out; }
  .shrug .hand.right { animation: shrug-right 0.9s ease-in-out; }
  .tap .leg.right { animation: tap 0.5s ease-in-out 3; }
  .shuffle .leg.left { animation: tap 0.6s ease-in-out 2; }
  .shuffle .leg.right { animation: tap 0.6s ease-in-out 0.3s 2; }
  .hop { animation: hop 0.6s ease-out; }
  .emote { position: absolute; top: 34px; right: -34px; width: 34px; height: 34px; display: grid; place-items: center; border: 2px solid #222; border-radius: 50%; background: #fff; animation: pop 0.25s ease-out; transition: opacity 0.4s; pointer-events: none; }
  .emote::after { content: ""; position: absolute; left: -2px; bottom: -6px; width: 8px; height: 8px; border: 2px solid #222; border-radius: 50%; background: #fff; }
  .emote.leaving { opacity: 0; }
  .emote .spiral { animation: spin 2s linear infinite; transform-origin: 12px 12px; }
  .emote .rays { animation: glow 0.8s ease-in-out infinite alternate; }
  .emote .vein { animation: throb 0.5s ease-in-out infinite alternate; transform-origin: 12px 12px; }
  .body { animation: bob 1.2s ease-in-out infinite; transform-origin: bottom center; }
  .calming .body { animation-duration: 2.6s; }
  .motivating .body { animation-duration: 0.7s; }
  .quiet .body { animation: none; }
  .playful .body, .proud .body { animation-duration: 0.6s; }
  .sleepy .body { animation-duration: 3.4s; }
  .sleepy .pupil { transform: translate(4px, 4px); }
  .grumpy .body { animation-duration: 2s; }
  .dramatic .body { animation-duration: 0.9s; }
  .choices { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 12px; }
  select { font: inherit; padding: 2px 6px; border-radius: 6px; border: 1px solid color-mix(in srgb, CanvasText 30%, transparent); background: Canvas; color: inherit; cursor: pointer; text-transform: capitalize; }
  .eye { animation: blink 4s infinite; transform-origin: center; transform-box: fill-box; }
  .pupil { transform: translate(4px, 0); transition: transform 0.12s ease-out; }
  .heart { position: absolute; left: 50%; top: 0; color: #e8453c; font-size: 18px; animation: rise 0.9s ease-out forwards; pointer-events: none; }
  .speech { display: flex; align-items: flex-end; justify-content: center; height: calc(4 * 1.4em + 16px); margin-bottom: -8px; }
  .bubble { position: relative; box-sizing: border-box; min-width: 120px; max-width: 270px; padding: 6px 12px; border: 2px solid #222; border-radius: 16px; background: #fff; color: #222; font-weight: 600; text-align: center; animation: pop 0.25s ease-out; }
  .bubble::before, .bubble::after { content: ""; position: absolute; left: 50%; border-style: solid; border-color: transparent; }
  .bubble::before { top: 100%; margin-left: -9px; border-width: 10px 9px 0; border-top-color: #222; }
  .bubble::after { top: 100%; margin-left: -6px; margin-top: -1px; border-width: 7px 6px 0; border-top-color: #fff; }
  .bubble:empty { visibility: hidden; }
  .bubble > span { display: inline-block; animation: fade-in 0.2s ease-out; transition: opacity 0.18s ease-in, transform 0.18s ease-in; }
  .bubble.swapping > span { opacity: 0; transform: translateY(4px); }
  .dots i { display: inline-block; width: 6px; height: 6px; margin: 0 2px; border-radius: 50%; background: #222; animation: think 1s ease-in-out infinite; }
  .dots i:nth-child(2) { animation-delay: 0.15s; }
  .dots i:nth-child(3) { animation-delay: 0.3s; }
  .meta { opacity: 0.6; font-size: 12px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 6px; width: 100%; max-width: 340px; margin: 4px 0 0; }
  .stats div { padding: 6px 8px; border-radius: 8px; background: color-mix(in srgb, CanvasText 6%, transparent); text-align: center; }
  .stats dt { font-size: 11px; opacity: 0.65; }
  .stats dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .settings-open { position: absolute; top: 6px; right: 6px; z-index: 2; width: 26px; height: 26px; padding: 0; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.55); color: #222; cursor: pointer; }
  .settings-open:hover { background: #fff; }
  .model-dialog { width: min(300px, calc(100vw - 48px)); padding: 14px; border: 1px solid color-mix(in srgb, CanvasText 30%, transparent); border-radius: 12px; background: Canvas; color: CanvasText; }
  .model-dialog::backdrop { background: rgba(0, 0, 0, 0.35); }
  .model-dialog h3 { margin: 0 0 4px; font-size: 14px; }
  .model-dialog p { margin: 0 0 10px; font-size: 12px; opacity: 0.7; }
  .model-dialog label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 12px; }
  .model-dialog input:not([type="checkbox"]) { display: block; box-sizing: border-box; width: 100%; margin-top: 2px; padding: 4px 6px; font: inherit; font-weight: 400; border-radius: 6px; border: 1px solid color-mix(in srgb, CanvasText 30%, transparent); background: Canvas; color: inherit; }
  .model-dialog .remove-key { font-weight: 400; }
  .model-dialog .remove-key[hidden] { display: none; }
  .model-dialog .result { min-height: 1.4em; margin-bottom: 8px; font-size: 12px; overflow-wrap: anywhere; }
  .model-dialog .result.bad { color: #d6336c; }
  .model-dialog .actions { display: flex; gap: 6px; justify-content: flex-end; }
  .model-dialog button { padding: 3px 12px; font: inherit; border-radius: 6px; border: 1px solid color-mix(in srgb, CanvasText 30%, transparent); background: Canvas; color: inherit; cursor: pointer; }
  .model-dialog .save { font-weight: 600; background: color-mix(in srgb, CanvasText 12%, Canvas); }
  .model-dialog button:disabled { cursor: default; opacity: 0.5; }
  .naming { display: flex; justify-content: center; min-height: 24px; }
  .naming .name { display: inline-flex; align-items: center; gap: 5px; padding: 1px 4px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; cursor: pointer; }
  .naming .name:hover { background: color-mix(in srgb, CanvasText 8%, transparent); }
  .naming .name svg { opacity: 0.4; }
  .naming .name:hover svg, .naming .name:focus-visible svg { opacity: 0.9; }
  .naming .name[hidden], .name-field[hidden] { display: none; }
  .name-field { width: 170px; padding: 1px 6px; font: inherit; font-weight: 600; text-align: center; user-select: text; border-radius: 6px; border: 1px solid color-mix(in srgb, CanvasText 40%, transparent); background: Canvas; color: inherit; }
  .stat-group { width: 100%; max-width: 340px; margin-top: 4px; }
  .stat-group[hidden] { display: none; }
  .stat-group h4 { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; font-size: 11px; font-weight: 600; color: color-mix(in srgb, CanvasText 65%, transparent); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
  .stat-group h4::before, .stat-group h4::after { content: ""; flex: 1; height: 1px; background: color-mix(in srgb, CanvasText 20%, transparent); }
  .scene.raining { background: linear-gradient(#77838f, #a9b3bb); }
  .scene.dawn.raining, .scene.dusk.raining { background: linear-gradient(#6d6a80, #a39aa3); }
  .scene.night.raining { background: linear-gradient(#12172b, #232b47); }
  .raining .sun, .raining .moon { opacity: 0.25; box-shadow: none; }
  .raining .stars { display: none; }
  .raining .ground { filter: saturate(0.6) brightness(0.85); }
  .scene:not(.raining) .rain { display: none; }
  .rain i { position: absolute; top: -14px; width: 1.5px; height: 11px; border-radius: 1px; background: #dcebf7; opacity: 0.75; transform: rotate(10deg); animation: fall 0.8s linear infinite; }
  .night .rain i { background: #8fa6cf; }
  @keyframes fall { to { transform: translate(-46px, 300px) rotate(10deg); } }
  @keyframes wave { 0%, 100% { transform: rotate(0); } 25%, 75% { transform: rotate(-70deg); } 50% { transform: rotate(-45deg); } }
  @keyframes stretch-left { 0%, 100% { transform: rotate(0); } 35%, 70% { transform: rotate(60deg); } }
  @keyframes stretch-right { 0%, 100% { transform: rotate(0); } 35%, 70% { transform: rotate(-60deg); } }
  @keyframes shrug-left { 0%, 100% { transform: rotate(0); } 40%, 60% { transform: rotate(25deg); } }
  @keyframes shrug-right { 0%, 100% { transform: rotate(0); } 40%, 60% { transform: rotate(-25deg); } }
  @keyframes tap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.82); } }
  @keyframes hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes glow { from { opacity: 0.35; } to { opacity: 1; } }
  @keyframes throb { from { transform: scale(0.85); } to { transform: scale(1.1); } }
  @keyframes wobble { 0%, 86%, 100% { transform: rotate(0); } 89% { transform: rotate(-8deg); } 92% { transform: rotate(7deg); } 95% { transform: rotate(-4deg); } }
  @keyframes shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg) translateX(-2px); } 75% { transform: rotate(6deg) translateX(2px); } }
  @keyframes seam { to { opacity: 1; } }
  @keyframes glow-up { to { filter: drop-shadow(0 0 16px var(--rarity)); } }
  @keyframes lid-off { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(40px, -90px) rotate(50deg); opacity: 0; } }
  @keyframes bob { 0%, 100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-5px) scaleY(1.03); } }
  @keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
  @keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes fade-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
  @keyframes think { 0%, 70%, 100% { opacity: 0.3; transform: translateY(0); } 35% { opacity: 1; transform: translateY(-4px); } }
  @keyframes rise { from { transform: translate(-50%, 20px); opacity: 1; } to { transform: translate(-50%, -20px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .body, .eye, .bubble, .bubble > span, .dots i, .emote, .emote *, .boxes button, .ceremony, .ceremony * { animation: none !important; transition: none !important; } .rain i { animation: none !important; top: var(--still-top); } }
`;
document.head.append(style);

const root = document.createElement("div");
document.body.append(root);

const PET_SVG = `
  <svg class="body" width="112" height="136" viewBox="-8 -32 112 136">
    <g class="hands" stroke-width="3" stroke-linecap="round" fill="none">
      <path class="hand left" d="M17 62 L4 70 M4 70 L-3 66 M4 70 L-4 72 M4 70 L0 77"/>
      <path class="hand right" d="M79 62 L92 70 M92 70 L99 66 M92 70 L100 72 M92 70 L96 77"/>
    </g>
    <rect class="limb leg left" x="38" y="76" width="5" height="24" rx="2"/>
    <rect class="limb leg right" x="53" y="76" width="5" height="24" rx="2"/>
    <circle class="skin" cx="48" cy="52" r="34"/>
    <g class="eye"><circle class="white" cx="56" cy="46" r="15" fill="#fff"/><circle class="pupil" cx="56" cy="46" r="7" fill="#222"/></g>
    <g class="hat-art worn-hat"></g>
  </svg>`;

function heart(stage) {
  const element = document.createElement("span");
  element.className = "heart";
  element.textContent = "♥";
  stage.append(element);
  element.addEventListener("animationend", () => element.remove());
}

/** Where the stars sit at night, in percent of the scene; fixed, so the sky stays calm. */
const STARS = [[8, 12], [17, 34], [26, 8], [38, 22], [63, 10], [72, 30], [84, 14], [91, 40], [12, 52], [88, 58]];

const SUNRISE = 6;
const SUNSET = 20;

function phaseAt(hour) {
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 7) return "dawn";
  if (hour >= 18) return "dusk";
  return "day";
}

/** Places a body on an arc across the scene: rising at the left at 0, highest in the middle, setting at the right at 1. */
function placeOnArc(element, progress) {
  element.style.left = `${8 + progress * 84}%`;
  element.style.top = `${72 - Math.sin(Math.PI * progress) * 62}%`;
}

/** Steps of the R2 sequence: where a drop falls and when never line up, so rain has no visible pattern. */
const DROP_PLACE_STEP = 0.7548776662;
const DROP_PHASE_STEP = 0.569840291;

/** Rain falls while the agent's tool calls keep failing; each drop's left in percent of the scene, delay and how far down it rests without motion. */
const RAINDROPS = Array.from({ length: 34 }, (_, index) => {
  const place = (index * DROP_PLACE_STEP) % 1;
  const phase = (index * DROP_PHASE_STEP) % 1;
  return `<i style="left:${(4 + place * 112).toFixed(1)}%;animation-delay:-${(phase * 0.8).toFixed(2)}s;--still-top:${(phase * 90).toFixed(1)}%"></i>`;
}).join("");

let rainUntil = 0;

/** The sky follows the user's local time: the sun crosses it by day, the moon and stars by night. */
function drawSky(now = new Date()) {
  const hour = now.getHours() + now.getMinutes() / 60;
  part(".scene").className = `scene ${phaseAt(hour)}${rainUntil > now.getTime() ? " raining" : ""}`;
  const daylight = SUNSET - SUNRISE;
  if (hour >= SUNRISE && hour < SUNSET) placeOnArc(part(".sun"), (hour - SUNRISE) / daylight);
  placeOnArc(part(".moon"), ((hour - SUNSET + 24) % 24) / (24 - daylight));
}

/** A box, as it sits beside the pet and as it opens; the seam glows in the colour of what is inside before the lid comes off. */
const boxArt = (size, seam = "") => `
  <svg class="box-art" width="${size}" height="${size}" viewBox="0 0 60 60">
    <rect x="8" y="26" width="44" height="30" rx="3" fill="#c99a5b" stroke="#222" stroke-width="2"/>
    <rect x="26" y="26" width="8" height="30" fill="#e8453c"/>
    ${seam}
    <g class="lid">
      <rect x="5" y="16" width="50" height="11" rx="3" fill="#d8aa6a" stroke="#222" stroke-width="2"/>
      <rect x="26" y="16" width="8" height="11" fill="#e8453c"/>
      <path d="M30 16 C22 4 13 9 22 16 M30 16 C38 4 47 9 38 16" fill="none" stroke="#e8453c" stroke-width="3" stroke-linecap="round"/>
    </g>
  </svg>`;

const BIG_BOX = boxArt(120, `<rect class="seam" x="6" y="23" width="48" height="6" rx="3"/>`).replace("box-art", "box-art big-box");

/** How many boxes stand beside the pet; more show as a count. */
const BOXES_SHOWN = 3;

root.innerHTML = `
  ${SKIN_DEFS}
  <div class="pet">
    <div class="scene">
      <div class="stars">${STARS.map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join("")}</div>
      <div class="sun"></div><div class="moon"></div>
      <div class="ground"></div>
      <div class="rain">${RAINDROPS}</div>
      <div class="boxes"></div>
      <button class="settings-open" type="button" title="Where the pet's lines come from" aria-label="Model settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg></button>
      <div class="speech"><div class="bubble"></div></div>
      <div class="stage">${PET_SVG}</div>
    </div>
    <div class="naming">
      <button class="name" type="button" title="Rename"><strong class="name-text"></strong><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1-5L16 4l4 4L9 19z"/></svg></button>
      <input class="name-field" type="text" maxlength="24" hidden aria-label="The pet's name" autocomplete="off" spellcheck="false">
    </div>
    <div class="choices">
      <label>Mode <select class="mode">${options(Object.keys(LINES))}</select></label>
      <label>Alignment <select class="alignment">${options(ALIGNMENTS)}</select></label>
    </div>
    <div class="meta"></div>
    <details class="wardrobe">
      <summary>Wardrobe <span class="found-count"></span></summary>
      <h4>Hat</h4><div class="tiles hats"></div>
      <h4>Hat skin</h4><div class="tiles hat-skins"></div>
      <h4>Body skin</h4><div class="tiles body-skins"></div>
    </details>
    <section class="stat-group this-chat" hidden><h4>This chat</h4><dl class="stats here"></dl></section>
    <section class="stat-group all-chats" hidden><h4>All chats</h4><dl class="stats everywhere"></dl></section>
    <section class="stat-group usage" hidden><h4>Last 30 days</h4><dl class="stats month"></dl></section>
  </div>
  <dialog class="model-dialog" aria-labelledby="model-title">
    <form method="dialog">
      <h3 id="model-title">Model</h3>
      <p>Any OpenAI-compatible chat server. Leave the URL and model empty and the pet uses its built-in lines.</p>
      <label>Server URL <input class="model-url" type="url" placeholder="http://host:8080/v1" autocomplete="off" spellcheck="false"></label>
      <label>Model <input class="model-name" type="text" placeholder="active" autocomplete="off" spellcheck="false"></label>
      <label>API key <input class="model-key" type="password" autocomplete="new-password" spellcheck="false"></label>
      <label class="remove-key" hidden><input class="model-remove-key" type="checkbox"> Remove the saved key</label>
      <div class="result" role="status"></div>
      <div class="actions">
        <button class="close" type="button">Cancel</button>
        <button class="test" type="button">Test</button>
        <button class="save" type="submit">Save</button>
      </div>
    </form>
  </dialog>
  <div class="ceremony" hidden role="dialog" aria-label="Opening a box">
    <div>
      <div class="reveal"><div class="rays"></div>${BIG_BOX}<div class="prize"></div></div>
      <div class="verdict">
        <div class="rarity"></div><div class="prize-name"></div>
        <div class="buttons"><button class="wear-prize">Wear it</button><button class="keep-prize">Keep it</button></div>
      </div>
      <div class="hint">Opening…</div>
    </div>
  </div>`;
const part = (selector) => root.querySelector(selector);
/** Patting this many times within PATTING_WINDOW_MS annoys the pet. */
const PATS_TO_ANNOY = 6;
const PATTING_WINDOW_MS = 4000;
let patTimes = [];

part(".stage").addEventListener("click", () => {
  heart(part(".stage"));
  const now = Date.now();
  patTimes = [...patTimes.filter((at) => now - at < PATTING_WINDOW_MS), now];
  if (patTimes.length >= PATS_TO_ANNOY) {
    patTimes = [];
    emote("angry");
  }
  void window.mirador.send({ kind: "pat" });
});
const wear = (slot, id) => void window.mirador.send({ kind: "wear", slot, id });
if (matchMedia("(prefers-reduced-motion: reduce)").matches) part(".skin-defs").pauseAnimations();
part(".mode").addEventListener("change", (event) => void window.mirador.send({ kind: "mode", mode: event.target.value }));
part(".alignment").addEventListener("change", (event) => void window.mirador.send({ kind: "alignment", alignment: event.target.value }));

/** How far the pupil may move from the eye's centre, in the drawing's units: the white's radius less the pupil's, less a margin. */
const PUPIL_REACH = 15 - 7 - 1;

/** The pupil looks toward the pointer, closer to the white's edge the farther away the pointer is; it rests when the pointer leaves. */
function followPointer({ clientX, clientY }) {
  const white = part(".white").getBoundingClientRect();
  const pixelsPerUnit = white.width / 30;
  const dx = clientX - (white.left + white.width / 2);
  const dy = clientY - (white.top + white.height / 2);
  const distance = Math.hypot(dx, dy);
  const reach = Math.min(PUPIL_REACH, distance / pixelsPerUnit / 4);
  const [x, y] = distance === 0 ? [0, 0] : [(dx / distance) * reach, (dy / distance) * reach];
  part(".pupil").style.transform = `translate(${x}px, ${y}px)`;
}

document.addEventListener("pointermove", followPointer);
document.documentElement.addEventListener("pointerleave", () => (part(".pupil").style.transform = ""));

/** The little bubbles beside the pet's head: an idea, anger, being dazed, or a tool call that just failed. */
const EMOTES = {
  idea: `<svg width="24" height="24" viewBox="0 0 24 24" aria-label="Idea"><g class="rays" stroke="#f0b400" stroke-width="1.6" stroke-linecap="round"><path d="M12 1.5v2M3.5 5l1.5 1.4M20.5 5 19 6.4M2 12h2M20 12h2"/></g><path d="M12 5.5a5.5 5.5 0 0 0-3.2 10c.6.5.9 1.1.9 1.8h4.6c0-.7.3-1.3.9-1.8A5.5 5.5 0 0 0 12 5.5Z" fill="#ffd54a" stroke="#222" stroke-width="1.2"/><rect x="9.6" y="18.2" width="4.8" height="3.2" rx="1" fill="#9aa0a6" stroke="#222" stroke-width="1"/></svg>`,
  angry: `<svg width="24" height="24" viewBox="0 0 24 24" aria-label="Angry"><path class="vein" d="M4 10Q10 10 10 4M14 4Q14 10 20 10M20 14Q14 14 14 20M10 20Q10 14 4 14" fill="none" stroke="#e03131" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  dazed: `<svg width="24" height="24" viewBox="0 0 24 24" aria-label="Dazed"><path class="spiral" d="M12 12m-1 0a1 1 0 1 1 2 0a2.5 2.5 0 1 1-5 0a4 4 0 1 1 8 0a5.5 5.5 0 1 1-11 0a7 7 0 0 1 7-7" fill="none" stroke="#7b5cd6" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  oops: `<svg width="24" height="24" viewBox="0 0 24 24" aria-label="Something failed"><path class="vein" d="M12 3v11" fill="none" stroke="#e03131" stroke-width="4" stroke-linecap="round"/><circle cx="12" cy="20" r="2.4" fill="#e03131"/></svg>`,
};

/** The emotes the pet shows on its own; a failure's is only for a failure. */
const IDLE_EMOTES = ["idea", "angry", "dazed"];

const EMOTE_MS = 2600;
let emoteTimer = null;

function emote(kind) {
  part(".stage .emote")?.remove();
  clearTimeout(emoteTimer);
  const element = document.createElement("div");
  element.className = "emote";
  element.dataset.emote = kind;
  element.innerHTML = EMOTES[kind];
  part(".stage").append(element);
  emoteTimer = setTimeout(() => {
    element.classList.add("leaving");
    setTimeout(() => element.remove(), 400);
  }, EMOTE_MS);
}

/** The small things the pet does on its own while it stands there. */
const MOVES = ["wave", "stretch", "shrug", "tap", "shuffle", "hop"];

/** Which emote suits a mode when the pet shows one on its own; the others pick any. */
const MODE_EMOTES = { grumpy: "angry", sleepy: "dazed", calming: "dazed", quiet: "dazed", curious: "idea", wise: "idea", motivating: "idea" };

const IDLE_MIN_MS = 8000;
const IDLE_SPREAD_MS = 8000;
const IDLE_EMOTE_SHARE = 0.25;

function move(name) {
  const target = name === "hop" ? part(".stage") : part(".pet");
  const done = () => target.classList.remove(name);
  target.classList.remove(...MOVES);
  void target.getBoundingClientRect();
  target.classList.add(name);
  setTimeout(done, 2000);
}

function idle() {
  if (!document.hidden && part(".pet").className.includes(" ")) {
    const mode = part(".pet").classList[1];
    if (Math.random() < IDLE_EMOTE_SHARE) emote(MODE_EMOTES[mode] ?? IDLE_EMOTES[Math.floor(Math.random() * IDLE_EMOTES.length)]);
    else if (mode !== "quiet" || Math.random() < 0.3) move(MOVES[Math.floor(Math.random() * MOVES.length)]);
  }
  setTimeout(idle, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
}

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setTimeout(idle, IDLE_MIN_MS);

/** How long the old line takes to fade out of the bubble before the new one fades in. */
const SWAP_MS = 180;

let saying = null;
let swap = null;

function bubbleContent(text, thinking) {
  if (!thinking && !text) return [];
  const span = document.createElement("span");
  if (thinking) {
    span.className = "dots";
    span.setAttribute("aria-label", "Thinking");
    span.append(...[1, 2, 3].map(() => document.createElement("i")));
  } else span.textContent = text;
  return [span];
}

/** Puts the line, or dots while the pet thinks of one, in the speech bubble, fading the old content out and the new in. */
function say(text, thinking) {
  const key = thinking ? "\u0000thinking" : text;
  if (key === saying) return;
  const first = saying === null;
  if (saying === "\u0000thinking" && !thinking && text) emote("idea");
  saying = key;
  const bubble = part(".bubble");
  const put = () => {
    bubble.replaceChildren(...bubbleContent(text, thinking));
    bubble.classList.remove("swapping");
  };
  clearTimeout(swap);
  if (first || bubble.childElementCount === 0) return put();
  bubble.classList.add("swapping");
  swap = setTimeout(put, SWAP_MS);
}

const pad = (value) => String(value).padStart(2, "0");

/** Like the host's: "42m", or "3h 05m". */
function duration(ms) {
  const minutes = Math.floor(ms / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
}

/** The session's length counts up between messages, so the card stays live. */
const STATS_TICK_MS = 30 * 1000;

let shownStats = null;
let shownUsage = null;

const statTiles = (rows) =>
  rows.map(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    return row;
  });

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function drawUsage() {
  const usage = shownUsage;
  part(".usage").hidden = !usage;
  if (!usage) return;
  const percent = (value) => (value === null ? "–" : `${value}%`);
  part(".month").replaceChildren(
    ...statTiles([
      ["Tokens written", compact.format(usage.outputTokens)],
      ["Cache hits", percent(usage.cacheHitPercent)],
      ["Tools succeeded", percent(usage.toolSuccessPercent)],
      ["Favourite tool", usage.favouriteTool ?? "–"],
      ["You reply in", usage.medianReplySeconds === null ? "–" : usage.medianReplySeconds < 60 ? `${Math.round(usage.medianReplySeconds)}s` : duration(usage.medianReplySeconds * 1000)],
      ["Permission asks", String(usage.permissionPrompts)],
    ]),
  );
}

function drawStats() {
  const stats = shownStats;
  part(".this-chat").hidden = !stats;
  part(".all-chats").hidden = !stats;
  if (!stats) return;
  part(".here").replaceChildren(...statTiles([
    ["Messages", String(stats.messages)],
    ["Agent turns", String(stats.turns ?? 0)],
    ["Tool calls", String(stats.toolCalls ?? 0)],
    ["Failed tools", String(stats.failedTools ?? 0)],
    ["Session", stats.firstAt === null ? "–" : duration(Date.now() - stats.firstAt)],
    ["Active", duration(stats.activeMs)],
    ["Longest focus", duration(stats.longestStreakMs)],
  ]));
  part(".everywhere").replaceChildren(...statTiles([
    ["Day streak", `${stats.dayStreak} ${stats.dayStreak === 1 ? "day" : "days"}`],
    ["After midnight", String(stats.nightOwl)],
  ]));
}

setInterval(() => (drawStats(), drawSky()), STATS_TICK_MS);
drawSky();

const hatColors = (hat, skin) => `--hat-main:${skin ? SKINS[skin].fill : hat.colors[0]};--hat-accent:${hat.colors[1]}`;

function tile({ label, rarity, art, worn, locked, onPick }) {
  const button = document.createElement("button");
  button.className = "tile";
  if (rarity) button.dataset.rarity = rarity;
  button.setAttribute("aria-pressed", String(worn));
  button.disabled = locked;
  button.title = locked ? "Not found yet" : rarity ? `${label} · ${RARITIES[rarity]}` : label;
  button.innerHTML = locked ? "?" : art;
  button.addEventListener("click", onPick);
  return button;
}

const swatch = (fill) => `<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" style="fill:${fill}" stroke="rgba(0,0,0,.35)"/></svg>`;
const hatPicture = (hat, skin) => `<svg class="hat-picture" width="40" height="32" viewBox="8 -34 80 64"><g class="hat-art" style="${hatColors(hat, skin)}">${hat.svg}</g></svg>`;

/** Frames each hat's picture around the hat; only possible while the wardrobe is open, as closed it has no size. */
function frameHatPictures() {
  for (const picture of root.querySelectorAll(".hat-picture")) {
    const { x, y, width, height } = picture.firstElementChild.getBBox();
    if (width === 0) continue;
    const side = Math.max(width, height * 1.25) + 6;
    picture.setAttribute("viewBox", `${x + width / 2 - side / 2} ${y + height / 2 - (side / 1.25) / 2} ${side} ${side / 1.25}`);
  }
}

part(".wardrobe").addEventListener("toggle", frameHatPictures);

/** The tiles for hats and skins, found ones to pick, the rest as question marks; and what the pet wears. */
function drawWardrobe(wardrobe) {
  const hat = wardrobe.hat ? HATS[wardrobe.hat] : null;
  const skin = SKINS[wardrobe.bodySkin] ?? SKINS.ink;
  part(".pet").style.cssText = `--body-fill:${skin.fill};--limb:${skin.limb};${hat ? hatColors(hat, wardrobe.hatSkin) : ""}`;
  part(".worn-hat").innerHTML = hat?.svg ?? "";
  const total = Object.keys(HATS).length + Object.keys(SKINS).length;
  part(".found-count").textContent = `${wardrobe.hats.length + wardrobe.skins.length}/${total} found`;
  const skinTiles = (slot, current) =>
    Object.entries(SKINS).map(([id, { name, rarity, fill }]) =>
      tile({ label: name, rarity, art: swatch(fill), worn: current === id, locked: !wardrobe.skins.includes(id), onPick: () => wear(slot, id) }),
    );
  part(".hats").replaceChildren(
    tile({ label: "No hat", art: "None", worn: !hat, locked: false, onPick: () => wear("hat", null) }),
    ...Object.entries(HATS).map(([id, entry]) =>
      tile({ label: entry.name, rarity: entry.rarity, art: hatPicture(entry, wardrobe.hatSkin), worn: wardrobe.hat === id, locked: !wardrobe.hats.includes(id), onPick: () => wear("hat", id) }),
    ),
  );
  part(".hat-skins").replaceChildren(
    tile({ label: "The hat's own colours", art: "Own", worn: wardrobe.hatSkin === null, locked: false, onPick: () => wear("hatSkin", null) }),
    ...skinTiles("hatSkin", wardrobe.hatSkin),
  );
  part(".body-skins").replaceChildren(...skinTiles("bodySkin", wardrobe.bodySkin));
  frameHatPictures();
}

let boxes = [];

/** The unopened boxes on the ground beside the pet, oldest first, each opening the oldest. */
function drawBoxes(name) {
  const shown = boxes.slice(0, BOXES_SHOWN).map(() => {
    const button = document.createElement("button");
    button.title = `Open the box ${name} found`;
    button.innerHTML = boxArt(30);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openCeremony();
    });
    return button;
  });
  const more = boxes.length > BOXES_SHOWN ? [Object.assign(document.createElement("span"), { className: "more", textContent: `+${boxes.length - BOXES_SHOWN}` })] : [];
  part(".boxes").replaceChildren(...shown, ...more);
}

/** How long the box shakes before it opens: longer, the rarer what is inside. */
const SHAKE_MS = { common: 1200, rare: 1700, legendary: 2400 };

const skinPicture = (skin) => `
  <svg width="110" height="110" viewBox="0 0 80 80">
    <circle cx="40" cy="42" r="30" style="fill:${skin.fill}"/>
    <circle cx="47" cy="37" r="12" fill="#fff" stroke="#222" stroke-width="1.5"/><circle cx="50" cy="37" r="5.5" fill="#222"/>
  </svg>`;

let opening = null;

/** Opens the oldest box: it shakes and glows in its rarity's colour, the lid flies off, and what was inside rises out. */
function openCeremony() {
  const find = boxes[0];
  if (!find || opening) return;
  void window.mirador.send({ kind: "open" });
  const entry = find.kind === "hat" ? HATS[find.id] : SKINS[find.id];
  const ceremony = part(".ceremony");
  ceremony.dataset.rarity = entry.rarity;
  ceremony.style.setProperty("--shake-ms", `${SHAKE_MS[entry.rarity]}ms`);
  ceremony.className = "ceremony shaking";
  ceremony.hidden = false;
  part(".prize").innerHTML = find.kind === "hat" ? hatPicture(entry, null).replace('width="40" height="32"', 'width="130" height="104"') : skinPicture(entry);
  part(".verdict .rarity").textContent = RARITIES[entry.rarity];
  part(".verdict .prize-name").textContent = find.kind === "skin" ? `${entry.name} skin` : entry.name;
  const reveal = () => {
    ceremony.className = "ceremony opened";
    frameHatPictures();
    part(".wear-prize").focus();
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  opening = { find, timer: setTimeout(reveal, reducedMotion ? 0 : SHAKE_MS[entry.rarity]) };
  ceremony.onclick = (event) => {
    if (event.target.closest("button") || !ceremony.classList.contains("shaking")) return;
    clearTimeout(opening.timer);
    reveal();
  };
}

function closeCeremony() {
  if (!opening) return;
  clearTimeout(opening.timer);
  part(".ceremony").hidden = true;
  opening = null;
}

part(".wear-prize").addEventListener("click", () => {
  const { find } = opening ?? {};
  if (find) wear(find.kind === "hat" ? "hat" : "bodySkin", find.id);
  closeCeremony();
});
part(".keep-prize").addEventListener("click", closeCeremony);
document.addEventListener("keydown", (event) => event.key === "Escape" && part(".ceremony").classList.contains("opened") && closeCeremony());

let savedModel = { url: "", model: "", keySet: false };

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/** What the key field promises: a saved key stays only for the server it was saved for. */
function drawKeyField() {
  const savedKeyApplies = savedModel.keySet && originOf(part(".model-url").value.trim()) === originOf(savedModel.url);
  const removing = part(".model-remove-key").checked;
  part(".remove-key").hidden = !savedKeyApplies;
  part(".model-key").placeholder = !savedModel.keySet ? "None" : !savedKeyApplies ? "Enter the key for this server" : removing ? "None" : "Saved, leave empty to keep";
}

function showModelResult(text, bad = false) {
  part(".model-dialog .result").textContent = text;
  part(".model-dialog .result").classList.toggle("bad", bad);
}

const modelForm = () => ({
  url: part(".model-url").value,
  model: part(".model-name").value,
  key: part(".model-key").value,
  removeKey: part(".remove-key").hidden ? false : part(".model-remove-key").checked,
});

/** Runs a dialog action with its buttons off; what the host refuses shows in the dialog. */
async function modelAction(kind, waiting, done) {
  const buttons = [part(".model-dialog .test"), part(".model-dialog .save")];
  buttons.forEach((button) => (button.disabled = true));
  showModelResult(waiting);
  try {
    done(await window.mirador.send({ kind, ...modelForm() }));
  } catch (error) {
    showModelResult(error.message, true);
  } finally {
    buttons.forEach((button) => (button.disabled = false));
  }
}

part(".settings-open").addEventListener("click", async () => {
  savedModel = await window.mirador.send({ kind: "model-settings" });
  part(".model-url").value = savedModel.url;
  part(".model-name").value = savedModel.model;
  part(".model-key").value = "";
  part(".model-remove-key").checked = false;
  showModelResult("");
  drawKeyField();
  part(".model-dialog").showModal();
});
part(".model-url").addEventListener("input", drawKeyField);
part(".model-remove-key").addEventListener("change", drawKeyField);
part(".model-dialog .close").addEventListener("click", () => part(".model-dialog").close());
part(".model-dialog .test").addEventListener("click", () =>
  modelAction("model-test", "Testing…", (answer) => (answer.ok ? showModelResult(`It works: “${answer.line}”`) : showModelResult(answer.problem, true))),
);
part(".model-dialog form").addEventListener("submit", (event) => {
  event.preventDefault();
  void modelAction("model-save", "Saving…", (saved) => {
    savedModel = saved;
    part(".model-dialog").close();
  });
});

/** Renaming: click the name, then Enter or clicking away keeps it, and Escape or an empty field leaves the old one. */
function endRenaming(keep) {
  const field = part(".name-field");
  if (field.hidden) return;
  const name = field.value.trim();
  field.hidden = true;
  part(".naming .name").hidden = false;
  part(".naming .name").focus();
  if (keep && name && name !== part(".name-text").textContent) void window.mirador.send({ kind: "name", name });
}

part(".naming .name").addEventListener("click", () => {
  const field = part(".name-field");
  field.value = part(".name-text").textContent;
  part(".naming .name").hidden = true;
  field.hidden = false;
  field.focus();
  field.select();
});
part(".name-field").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== "Escape") return;
  event.preventDefault();
  endRenaming(event.key === "Enter");
});
part(".name-field").addEventListener("blur", () => endRenaming(true));

/** The newest failure seen: only a newer one makes the pet react, not the one it shows on opening. */
let seenFailureAt = null;

function reactToFailure(failedAt = 0) {
  if (seenFailureAt !== null && failedAt > seenFailureAt) emote("oops");
  seenFailureAt = failedAt;
}

function draw(pet) {
  part(".pet").className = `pet ${pet.mode}`;
  part(".stage").title = `Pat ${pet.name}`;
  part(".name-text").textContent = pet.name;
  say(pet.line ?? LINES[pet.mode] ?? "", pet.thinking === true);
  part(".mode").value = pet.mode;
  part(".alignment").value = pet.alignment;
  part(".meta").textContent = `Patted ${pet.pats} times`;
  shownStats = pet.stats ?? null;
  drawStats();
  shownUsage = pet.usage ?? null;
  drawUsage();
  reactToFailure(pet.lastFailureAt);
  rainUntil = pet.rainUntil ?? 0;
  drawSky();
  const wardrobe = pet.wardrobe ?? { hats: [], skins: ["ink"], hat: null, hatSkin: null, bodySkin: "ink", boxes: [] };
  drawWardrobe(wardrobe);
  boxes = wardrobe.boxes ?? [];
  drawBoxes(pet.name);
}

window.mirador.onItem((item) => draw(item.data));
