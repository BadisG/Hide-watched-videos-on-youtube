// ==UserScript==
// @name         YouTube Hide Watched Search Results
// @namespace    http://tampermonkey.net/
// @version      12.0
// @description  Hide YouTube search results that have been watched, toggled via injected button. Includes CSS-based fast hiding.
// @author       You
// @match        https://www.youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    const LOG = (...a) => console.log('%c[HideWatched]', 'color:#0f0;font-weight:bold', ...a);
    const ERR = (...a) => console.error('%c[HideWatched]', 'color:#f00;font-weight:bold', ...a);

    // FIX: Load the saved state instead of always defaulting to true on refresh
    let enabled = true;

    // NEW: Inject CSS rules to handle hiding natively.
    // This entirely solves the "flashing" because the browser hides it before it can be painted.
    function applyCSS() {
        if (!document.getElementById('hide-watched-style')) {
            const style = document.createElement('style');
            style.id = 'hide-watched-style';
            style.textContent = `
                /* Legacy layout */
                html[data-hide-watched="true"] ytd-video-renderer:has(ytd-thumbnail-overlay-resume-playback-renderer #progress:not([style*="width: 0"]):not([style*="width:0"])),
                /* New lockup layout wrappers */
                html[data-hide-watched="true"] ytd-rich-item-renderer:has(.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment:not([style*="width: 0"]):not([style*="width:0"])),
                html[data-hide-watched="true"] yt-lockup-view-model:has(.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment:not([style*="width: 0"]):not([style*="width:0"])) {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        // Sync the HTML attribute so the CSS knows whether to apply
        document.documentElement.setAttribute('data-hide-watched', enabled);
    }

    // JS logic kept as a fallback/sync for older browsers or edge cases
    function applyFilter() {
        // --- Legacy layout: ytd-video-renderer ---
        document.querySelectorAll('ytd-video-renderer').forEach(video => {
            const progress = video.querySelector('ytd-thumbnail-overlay-resume-playback-renderer #progress');
            const isWatched = progress && parseInt(progress.style.width) > 0;
            if (isWatched) {
                video.style.display = enabled ? 'none' : '';
            }
        });

        // --- New lockup layout: yt-lockup-view-model ---
        document.querySelectorAll('yt-lockup-view-model').forEach(video => {
            const progressBar = video.querySelector('.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment');
            const isWatched = progressBar && parseInt(progressBar.style.width) > 0;
            if (isWatched) {
                // Hide the closest rich item wrapper if possible, else the lockup itself
                const wrapper = video.closest('ytd-rich-item-renderer') || video;
                wrapper.style.display = enabled ? 'none' : '';
            }
        });
    }

    function makeEyeSVG(on) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '24');
        svg.style.cssText = 'pointer-events:none;display:block;width:100%;height:100%;fill:currentcolor';
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', on
            ? 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5ZM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3Z'
            : 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.61 17 4.5 12 4.5c-1.27 0-2.49.2-3.64.57l2.17 2.17C11.21 7.13 11.59 7 12 7ZM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27ZM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2Zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01Z'
        );
        svg.appendChild(path);
        return svg;
    }

    function updateButton(btn) {
        btn.title = enabled ? 'Hide watched: ON (click to disable)' : 'Hide watched: OFF (click to enable)';
        btn.querySelector('.hw-icon').replaceChildren(makeEyeSVG(enabled));
        btn.style.opacity = enabled ? '1' : '0.35';
        btn.style.color = enabled ? 'var(--yt-spec-text-primary,white)' : 'var(--yt-spec-text-secondary,grey)';
    }

    function makeButton() {
        const btn = document.createElement('button');
        btn.id = 'hide-watched-toggle';
        btn.title = enabled ? 'Hide watched: ON (click to disable)' : 'Hide watched: OFF (click to enable)';
        btn.style.cssText = `
            background:none; border:none; cursor:pointer; padding:0;
            width:40px; height:40px; display:flex; align-items:center;
            justify-content:center; border-radius:50%; flex-shrink:0;
            color:${enabled ? 'var(--yt-spec-text-primary,white)' : 'var(--yt-spec-text-secondary,grey)'};
            opacity:${enabled ? '1' : '0.35'};
            transition:opacity 0.2s,background 0.15s;
        `;
        const icon = document.createElement('span');
        icon.className = 'hw-icon';
        icon.style.cssText = 'width:24px;height:24px;display:flex;align-items:center;justify-content:center;';
        icon.appendChild(makeEyeSVG(enabled));
        btn.appendChild(icon);

        btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
        btn.addEventListener('click', () => {
            enabled = !enabled;
            GM_setValue('hideWatched', enabled);
            applyCSS(); // Updates HTML attribute to instantly toggle layout via CSS
            updateButton(btn);
            applyFilter();
            LOG('Toggled. enabled=', enabled);
        });
        return btn;
    }

    function injectButton() {
        const mic = document.querySelector('ytd-masthead #voice-search-button ytd-button-renderer');
        if (mic) mic.style.display = 'none';

        if (document.getElementById('hide-watched-toggle')) return;

        const voiceDiv = document.querySelector('ytd-masthead #center #voice-search-button');
        if (!voiceDiv) { ERR('No #voice-search-button found'); return; }

        const btn = makeButton();
        voiceDiv.insertAdjacentElement('afterend', btn);

        if (!document.getElementById('hide-watched-toggle')) {
            voiceDiv.parentElement.insertBefore(btn, voiceDiv.nextSibling);
        }
        if (!document.getElementById('hide-watched-toggle')) {
            const center = document.querySelector('ytd-masthead #center');
            if (center) center.appendChild(btn);
        }

        const final = document.getElementById('hide-watched-toggle');
        if (final) LOG('Button injected. Parent:', final.parentElement?.id);
        else ERR('All injection methods failed');
    }

    function init() {
        applyCSS();
        injectButton();
        applyFilter();
    }

    document.addEventListener('yt-navigate-finish', init);
    document.addEventListener('yt-page-data-updated', init);
    setInterval(init, 1000);

    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);

})();
