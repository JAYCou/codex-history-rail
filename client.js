// Client half of @jaycou/codex-history-rail.
//
// A CODEX-style timeline in the empty gutter between the left sidebar and the
// conversation column. The rail itself is a column of short horizontal ticks.
// Hovering a tick enlarges it and opens a summary card on its right; the card
// carries the star and the jump action. Data comes from the current Session's
// whole-log `turnOutline` projection plus the retained chat window, so every
// started turn has a tick even before its row is loaded. Clicking a tick pages
// the chat window through that turn's `turn/start` seq (`ISession.loadThrough`)
// and then scrolls its anchor row into view. Stars live in localStorage, so
// they survive reloads and Session switches.
//
// Positioning: the component mounts in `conversation.session.header.utilities`,
// measures the real header bottom, and portals its rail into the conversation
// column root (the header utilities' ancestor with `position: relative`). That
// avoids the title row's inline-size containment and keeps the rail at the
// column's left edge without knowing the sidebar's current width.

window.__ModuleLoader__.load({
  id: '@jaycou/codex-history-rail',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;

    const PACKAGE_ID = '@jaycou/codex-history-rail';
    const NS = 'codexHistoryRail';
    const FAVORITES_KEY = 'dsh-codex-rail.favorites.v1';
    const PENDING_KEY = 'dsh-codex-rail.pendingJump.v1';
    const EMPTY = Object.freeze([]);

    const STRINGS = {
      zh: {
        title: '历史摘要',
        saved: '收藏',
        favorites: '收藏的摘要',
        empty: '暂无章节',
        noFavorites: '还没有收藏。悬停章节，点星标即可收藏。',
        favorite: '收藏',
        unfavorite: '取消收藏',
        jump: '跳到此处',
        jumpTo: '跳到第 {turn} 回合',
        turn: '第 {turn} 回合',
        chapter: '第 {turn} 回合摘要',
        you: '你',
        assistant: '助手',
        loading: '载入中…',
        jumpFailed: '跳转失败，请重试',
        cannotJump: '这一章还没载入',
        cannotOpen: '无法打开该会话',
        close: '关闭',
        remove: '移除收藏',
        untitled: '（无摘要）',
      },
      en: {
        title: 'History summaries',
        saved: 'Saved',
        favorites: 'Saved summaries',
        empty: 'No chapters yet',
        noFavorites: 'Nothing saved yet. Hover a chapter and press its star.',
        favorite: 'Save',
        unfavorite: 'Unsave',
        jump: 'Jump here',
        jumpTo: 'Jump to turn {turn}',
        turn: 'Turn {turn}',
        chapter: 'Turn {turn} summary',
        you: 'You',
        assistant: 'Assistant',
        loading: 'Loading…',
        jumpFailed: 'Could not jump. Try again.',
        cannotJump: 'That chapter is not loaded yet',
        cannotOpen: 'Could not open that session',
        close: 'Close',
        remove: 'Remove from saved',
        untitled: '(no summary)',
      },
    };

    const CSS = `
      .codex-rail-root {
        position: absolute;
        left: 0;
        width: 64px;
        z-index: 50;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 0 0 10px;
        pointer-events: none;
        color: var(--dsw-alias-label-secondary);
        font-family: inherit;
        font-size: 12px;
      }
      [data-codex-history-rail]:not(#codex-rail-v2) { display: none !important; }
      .codex-rail-root::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 1px;
        background: var(--dsw-alias-border-l1);
        opacity: .42;
        pointer-events: none;
      }
      .codex-rail-head {
        flex: none;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 8px 0 8px 10px;
        pointer-events: none;
      }
      .codex-rail-collect {
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        min-width: 42px;
        height: 24px;
        box-sizing: border-box;
        padding: 0 6px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        cursor: pointer;
      }
      .codex-rail-collect:hover,
      .codex-rail-collect[data-open='true'] {
        background: var(--dsw-alias-bg-layer-2);
        border-color: var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-primary);
      }
      .codex-rail-collect-icon {
        font-size: 12px;
        line-height: 1;
        color: var(--dsw-alias-brand-primary);
      }
      .codex-rail-collect-count {
        font-size: 10px;
        line-height: 1;
        opacity: .7;
        font-variant-numeric: tabular-nums;
      }
      .codex-rail-busy {
        font-size: 9px;
        line-height: 1.2;
        opacity: .75;
        pointer-events: none;
      }
      .codex-rail-scroll {
        pointer-events: auto;
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 7px;
        overflow-y: hidden;
        overflow-x: hidden;
        padding: 3px 0 4px 10px;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .codex-rail-scroll::-webkit-scrollbar { display: none; }
      .codex-rail-tick {
        position: relative;
        flex: none;
        width: 44px;
        height: 12px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        outline: none;
        pointer-events: auto;
      }
      .codex-rail-tick-line {
        display: block;
        width: 14px;
        height: 2px;
        border-radius: 1px;
        background: var(--dsw-alias-label-secondary);
        opacity: .36;
        transform-origin: left center;
        transition: width .15s ease, height .15s ease, opacity .15s ease, background .15s ease;
      }
      .codex-rail-tick:hover .codex-rail-tick-line,
      .codex-rail-tick:focus-visible .codex-rail-tick-line {
        width: 22px;
        height: 3px;
        opacity: 1;
        background: var(--dsw-alias-label-primary);
      }
      .codex-rail-tick[data-active='true'] .codex-rail-tick-line {
        width: 18px;
        height: 3px;
        opacity: 1;
        background: var(--dsw-alias-brand-primary);
      }
      .codex-rail-tick[data-saved='true']::after {
        content: '';
        position: absolute;
        left: 0;
        top: 3px;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--dsw-alias-brand-primary);
        pointer-events: none;
      }
      .codex-rail-empty {
        font-size: 9px;
        line-height: 1.35;
        opacity: .5;
        padding: 8px 2px;
      }
      .codex-rail-error {
        flex: none;
        pointer-events: auto;
        padding: 4px 6px 4px 10px;
        font-size: 9px;
        line-height: 1.3;
        color: var(--dsw-alias-state-error-primary);
      }
      .codex-rail-card {
        position: fixed;
        z-index: 60;
        width: 330px;
        max-height: min(360px, calc(100vh - 24px));
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-2);
        color: var(--dsw-alias-label-primary);
        box-shadow: 0 14px 38px rgba(0, 0, 0, .36);
        animation: codex-rail-card-in .14s ease-out;
      }
      .codex-rail-card::before {
        content: '';
        position: absolute;
        left: -10px;
        top: 14px;
        width: 10px;
        height: 1px;
        background: var(--dsw-alias-border-l1);
        pointer-events: none;
      }
      @keyframes codex-rail-card-in {
        from { opacity: 0; transform: translateX(-4px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .codex-rail-card-head {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px 6px;
      }
      .codex-rail-card-turn {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary);
        font-variant-numeric: tabular-nums;
      }
      .codex-rail-card-body {
        min-height: 0;
        overflow-y: auto;
        padding: 0 12px;
        scrollbar-width: thin;
      }
      .codex-rail-card-role {
        margin: 7px 0 3px;
        font-size: 9px;
        line-height: 1;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: var(--dsw-alias-label-secondary);
        opacity: .8;
      }
      .codex-rail-card-text {
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .codex-rail-card-response { color: var(--dsw-alias-label-secondary); -webkit-line-clamp: 5; }
      .codex-rail-card-foot {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        padding: 9px 12px 10px;
      }
      .codex-rail-fav-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 6px;
        padding: 4px 9px;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        font-size: 11px;
        line-height: 1.4;
        cursor: pointer;
      }
      .codex-rail-fav-btn:hover,
      .codex-rail-fav-btn[data-on='true'] {
        color: var(--dsw-alias-brand-primary);
        border-color: var(--dsw-alias-brand-primary);
      }
      .codex-rail-jump {
        border: 0;
        border-radius: 6px;
        padding: 4px 10px;
        background: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-bg-base);
        font: inherit;
        font-size: 11px;
        line-height: 1.4;
        cursor: pointer;
      }
      .codex-rail-panel {
        position: absolute;
        left: 66px;
        top: 40px;
        width: 300px;
        max-height: min(60vh, 480px);
        box-sizing: border-box;
        z-index: 61;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-2);
        color: var(--dsw-alias-label-primary);
        box-shadow: 0 12px 32px rgba(0, 0, 0, .32);
        padding: 10px 12px;
      }
      .codex-rail-panel-head {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 600;
      }
      .codex-rail-icon-btn {
        flex: none;
        border: 0;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        font-size: 16px;
        line-height: 1;
        padding: 2px 4px;
        cursor: pointer;
      }
      .codex-rail-panel-list {
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .codex-rail-panel-empty {
        padding: 10px 2px;
        font-size: 11px;
        line-height: 1.4;
        color: var(--dsw-alias-label-secondary);
      }
      .codex-rail-fav {
        display: flex;
        align-items: stretch;
        border-radius: 8px;
      }
      .codex-rail-fav:hover { background: var(--dsw-alias-bg-layer-1); }
      .codex-rail-fav-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .codex-rail-fav-title {
        font-size: 10px;
        color: var(--dsw-alias-label-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .codex-rail-fav-preview {
        font-size: 11px;
        line-height: 1.3;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .codex-rail-fav-meta {
        font-size: 9px;
        opacity: .5;
        font-variant-numeric: tabular-nums;
      }
      .codex-rail-fav-remove {
        flex: none;
        border: 0;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        font-size: 14px;
        line-height: 1;
        padding: 0 6px;
        cursor: pointer;
      }
      @media (max-width: 1080px) {
        .codex-rail-root { display: none; }
      }
    `;

    let pluginCtx = null;

    function ensureStyles() {
      const existing = document.querySelector(`style[data-plugin="${PACKAGE_ID}"]`);
      if (existing !== null) {
        existing.textContent = CSS;
        return;
      }
      const tag = document.createElement('style');
      tag.setAttribute('data-plugin', PACKAGE_ID);
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    function currentLang() {
      try {
        const locale = pluginCtx === null ? undefined : pluginCtx.get('locale');
        const active = locale === undefined ? undefined : locale.getLocale().active;
        if (typeof active === 'string' && active.toLowerCase().startsWith('zh')) return 'zh';
      } catch (error) {
        console.error('[codex-rail] locale unavailable', error);
      }
      return 'en';
    }

    function t(key, params) {
      const lang = currentLang();
      const template = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
      if (params === undefined) return template;
      return String(template).replace(/\{(\w+)\}/g, (match, name) => (
        params[name] === undefined ? match : String(params[name])
      ));
    }

    function readStorage(storage, key) {
      try {
        const raw = storage.getItem(key);
        if (raw === null) return undefined;
        return JSON.parse(raw);
      } catch (error) {
        console.error('[codex-rail] could not read local state', error);
        return undefined;
      }
    }

    function writeStorage(storage, key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('[codex-rail] could not persist local state', error);
        return false;
      }
    }

    function isFavorite(value) {
      return value !== null
        && typeof value === 'object'
        && typeof value.sessionId === 'string'
        && typeof value.id === 'string'
        && Number.isSafeInteger(value.turn)
        && Number.isSafeInteger(value.seq);
    }

    function readFavorites() {
      const parsed = readStorage(window.localStorage, FAVORITES_KEY);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isFavorite);
    }

    function writeFavorites(favorites) {
      writeStorage(window.localStorage, FAVORITES_KEY, favorites);
    }

    /** Merge the whole-log outline with the loaded chat window; loaded wins anchors. */
    function mergeChapters(outline, loaded) {
      const byTurn = new Map();
      if (Array.isArray(outline)) {
        for (const entry of outline) {
          if (entry === null || typeof entry !== 'object') continue;
          if (!Number.isSafeInteger(entry.turn) || !Number.isSafeInteger(entry.seq)) continue;
          byTurn.set(entry.turn, {
            turn: entry.turn,
            seq: entry.seq,
            prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
            response: typeof entry.response === 'string' ? entry.response : '',
            anchorKey: undefined,
          });
        }
      }
      if (Array.isArray(loaded)) {
        for (const item of loaded) {
          if (item === null || typeof item !== 'object' || !Number.isSafeInteger(item.turn)) continue;
          const previous = byTurn.get(item.turn);
          const prompt = typeof item.prompt === 'string' && item.prompt !== '' ? item.prompt : (previous ? previous.prompt : '');
          const response = typeof item.response === 'string' && item.response !== '' ? item.response : (previous ? previous.response : '');
          byTurn.set(item.turn, {
            turn: item.turn,
            seq: previous ? previous.seq : undefined,
            prompt,
            response,
            anchorKey: typeof item.anchorKey === 'string' ? item.anchorKey : undefined,
          });
        }
      }
      return [...byTurn.values()].sort((a, b) => a.turn - b.turn);
    }

    function formatSavedAt(value) {
      try {
        return new Date(value).toLocaleDateString(currentLang() === 'zh' ? 'zh-CN' : 'en-US', {
          month: 'short',
          day: 'numeric',
        });
      } catch (error) {
        return '';
      }
    }

    function Rail(props) {
      const { sessionId, useChat, useProjection, useSessions } = props;
      const outline = useProjection('turnOutline');
      const loaded = useChat((snapshot) => (
        snapshot && snapshot.navigation && typeof snapshot.navigation.items === 'function'
          ? snapshot.navigation.items()
          : EMPTY
      ));
      const sessionTitle = useSessions((state) => {
        const entry = state && state.byId ? state.byId[sessionId] : undefined;
        if (entry === undefined || entry === null) return '';
        return entry.displayTitle || entry.title || '';
      });

      const [favorites, setFavorites] = React.useState(readFavorites);
      const [activeTurn, setActiveTurn] = React.useState(null);
      const [hover, setHover] = React.useState(null);
      const [panelOpen, setPanelOpen] = React.useState(false);
      const [jumping, setJumping] = React.useState(null);
      const [error, setError] = React.useState('');
      const [host, setHost] = React.useState(null);
      const [top, setTop] = React.useState(0);
      const [viewportH, setViewportH] = React.useState(() => (
        typeof window === 'undefined' ? 900 : window.innerHeight
      ));
      const [, setLocaleTick] = React.useState(0);

      const anchorRef = React.useRef(null);
      const rootRef = React.useRef(null);
      const pendingJumpRef = React.useRef(undefined);
      const jumpRef = React.useRef(null);

      const chapters = React.useMemo(() => mergeChapters(outline, loaded), [outline, loaded]);
      const chaptersRef = React.useRef(chapters);
      chaptersRef.current = chapters;

      const favoriteIds = React.useMemo(
        () => new Set(favorites.map((favorite) => favorite.id)),
        [favorites],
      );

      // Re-render when the active language changes. The dictionary above is
      // resolved per render, so no state has to hold the text itself.
      React.useEffect(() => {
        let locale;
        try {
          locale = pluginCtx === null ? undefined : pluginCtx.get('locale');
        } catch (err) {
          locale = undefined;
        }
        if (locale === undefined || typeof locale.subscribe !== 'function') return undefined;
        return locale.subscribe(() => setLocaleTick((value) => value + 1));
      }, []);

      // The slot is rendered inside the real <header>; portal the rail into the
      // conversation column root (the header's parent) and start it just below
      // the header. The root, not the title row, is the positioning context:
      // .titleRow has inline-size containment and would become the rail's
      // containing block if the rail stayed nested in it.
      React.useLayoutEffect(() => {
        const anchor = anchorRef.current;
        const header = anchor === null ? null : anchor.closest('header');
        const root = header === null ? null : header.parentElement;
        if (header === null || root === null) return undefined;
        setHost(root);
        const update = () => {
          const headerRect = header.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          setTop(Math.max(0, Math.round(headerRect.bottom - rootRect.top)));
          setViewportH(window.innerHeight);
        };
        update();
        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(update);
          observer.observe(header);
          observer.observe(root);
        }
        window.addEventListener('resize', update);
        return () => {
          if (observer !== null) observer.disconnect();
          window.removeEventListener('resize', update);
        };
      }, []);

      // Favorites are shared by every open rail (and every browser tab).
      React.useEffect(() => {
        const onStorage = (event) => {
          if (event.key === FAVORITES_KEY) setFavorites(readFavorites());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      }, []);

      // Chapter state belongs to one Session: reset local navigation when the
      // rail is reused for another Session by the same slot.
      React.useEffect(() => {
        pendingJumpRef.current = undefined;
        setActiveTurn(null);
        setHover(null);
        setPanelOpen(false);
        setJumping(null);
        setError('');
      }, [sessionId]);

      // A favorite from another Session is opened through uiWorkspace; the
      // target rail picks the request up here once its turn appears in the
      // outline. The request is only cleared once it can actually be consumed.
      React.useEffect(() => {
        if (pendingJumpRef.current !== undefined) return;
        const pending = readStorage(window.sessionStorage, PENDING_KEY);
        if (pending === undefined || pending === null || typeof pending !== 'object') return;
        if (pending.sessionId !== sessionId || !Number.isSafeInteger(pending.turn)) return;
        pendingJumpRef.current = pending;
      }, [sessionId]);

      React.useEffect(() => {
        if (pendingJumpRef.current === undefined) return;
        const pending = pendingJumpRef.current;
        const target = chapters.find((chapter) => chapter.turn === pending.turn);
        if (target === undefined) return;
        pendingJumpRef.current = undefined;
        setPanelOpen(false);
        if (jumpRef.current !== null) jumpRef.current(target);
      }, [chapters]);

      // Dismiss the floating card or the saved panel on an outside press.
      React.useEffect(() => {
        if (!panelOpen && hover === null) return undefined;
        const onPointerDown = (event) => {
          const root = rootRef.current;
          if (root !== null && !root.contains(event.target)) {
            setPanelOpen(false);
            setHover(null);
          }
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            setPanelOpen(false);
            setHover(null);
          }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [panelOpen, hover]);

      const toggleFavorite = React.useCallback((chapter) => {
        const owner = typeof chapter.sessionId === 'string' ? chapter.sessionId : sessionId;
        if (!Number.isSafeInteger(chapter.turn)) return;
        const id = `${owner}::${chapter.turn}`;
        const entry = {
          id,
          sessionId: owner,
          turn: chapter.turn,
          seq: Number.isSafeInteger(chapter.seq) ? chapter.seq : -1,
          prompt: typeof chapter.prompt === 'string' ? chapter.prompt : '',
          response: typeof chapter.response === 'string' ? chapter.response : '',
          savedAt: Date.now(),
          sessionTitle: owner === sessionId
            ? (sessionTitle || owner)
            : (chapter.sessionTitle || owner),
        };
        setFavorites((previous) => {
          const exists = previous.some((favorite) => favorite.id === id);
          const next = exists
            ? previous.filter((favorite) => favorite.id !== id)
            : [entry, ...previous];
          writeFavorites(next);
          return next;
        });
      }, [sessionId, sessionTitle]);

      const scrollToAnchor = React.useCallback((anchorKey) => {
        if (typeof anchorKey !== 'string' || anchorKey === '') return false;
        const rows = document.querySelectorAll('[data-chat-anchor-key]');
        for (const row of rows) {
          if (row.dataset === undefined || row.dataset.chatAnchorKey !== anchorKey) continue;
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return true;
        }
        return false;
      }, []);

      const jumpTo = React.useCallback(async (chapter) => {
        setError('');
        setHover(null);
        setActiveTurn(chapter.turn);
        const current = chaptersRef.current.find((item) => item.turn === chapter.turn);
        if (scrollToAnchor(current ? current.anchorKey : chapter.anchorKey)) return;
        if (!Number.isSafeInteger(chapter.seq) || chapter.seq < 0) {
          setError(t('cannotJump'));
          return;
        }
        let binding;
        try {
          const sessions = pluginCtx === null ? undefined : pluginCtx.get('sessions');
          binding = sessions === undefined ? undefined : sessions.binding(sessionId);
        } catch (err) {
          binding = undefined;
        }
        if (binding === undefined) {
          setError(t('cannotJump'));
          return;
        }
        setJumping(chapter.turn);
        let landed = false;
        try {
          await binding.session.loadThrough(chapter.seq);
          // loadThrough publishes one history prepend; a frame or two lets the
          // chat rows mount before the anchor lookup runs.
          for (let attempt = 0; attempt < 10; attempt += 1) {
            await new Promise((resolve) => { window.requestAnimationFrame(resolve); });
            const latest = chaptersRef.current.find((item) => item.turn === chapter.turn);
            if (scrollToAnchor(latest ? latest.anchorKey : chapter.anchorKey)) {
              landed = true;
              break;
            }
          }
        } catch (err) {
          console.error('[codex-rail] turn jump failed', err);
          setError(t('jumpFailed'));
        } finally {
          setJumping(null);
        }
        if (!landed) {
          // A soft stop (exhausted/superseded) still resolves loadThrough; the
          // chapter simply is not in the DOM. Keep the clicked state so the
          // reader can see where they aimed, and say what happened.
          setError(t('jumpFailed'));
        }
      }, [sessionId, scrollToAnchor]);

      jumpRef.current = jumpTo;

      const openFavorite = React.useCallback((item) => {
        setPanelOpen(false);
        if (item.sessionId === sessionId) {
          void jumpTo(item);
          return;
        }
        if (!writeStorage(window.sessionStorage, PENDING_KEY, {
          sessionId: item.sessionId,
          turn: item.turn,
          seq: item.seq,
        })) {
          setError(t('cannotOpen'));
          return;
        }
        let uiWorkspace;
        try {
          uiWorkspace = pluginCtx === null ? undefined : pluginCtx.get('uiWorkspace');
        } catch (err) {
          uiWorkspace = undefined;
        }
        if (uiWorkspace === undefined || typeof uiWorkspace.openSession !== 'function') {
          setError(t('cannotOpen'));
          return;
        }
        uiWorkspace.openSession(item.sessionId);
      }, [sessionId, jumpTo]);

      const openCard = React.useCallback((chapter, element) => {
        if (panelOpen || element === null) return;
        const rect = element.getBoundingClientRect();
        const width = 330;
        const maxTop = Math.max(12, window.innerHeight - 360 - 12);
        setHover({
          turn: chapter.turn,
          top: Math.min(Math.max(12, rect.top - 6), maxTop),
          left: Math.min(Math.max(80, rect.right + 10), window.innerWidth - width - 12),
        });
      }, [panelOpen]);

      const hoveredChapter = hover === null
        ? undefined
        : chapters.find((chapter) => chapter.turn === hover.turn);
      const hoveredFavorite = hoveredChapter !== undefined
        && favoriteIds.has(`${sessionId}::${hoveredChapter.turn}`);

      function renderCard(chapter, isFavorite) {
        return h('div', {
          className: 'codex-rail-card',
          style: { top: `${hover.top}px`, left: `${hover.left}px` },
          role: 'dialog',
          'aria-label': t('chapter', { turn: chapter.turn }),
          onMouseDown: (event) => event.stopPropagation(),
        },
          h('div', { className: 'codex-rail-card-head' },
            h('span', { className: 'codex-rail-card-turn' }, t('turn', { turn: chapter.turn })),
            h('button', {
              type: 'button',
              className: 'codex-rail-fav-btn',
              'data-on': isFavorite ? 'true' : undefined,
              'aria-pressed': isFavorite,
              title: isFavorite ? t('unfavorite') : t('favorite'),
              onClick: () => toggleFavorite(chapter),
            }, isFavorite ? '★' : '☆', h('span', null, isFavorite ? t('unfavorite') : t('favorite')))),
          h('div', { className: 'codex-rail-card-body' },
            h('div', { className: 'codex-rail-card-role' }, t('you')),
            h('div', { className: 'codex-rail-card-text' }, chapter.prompt || t('untitled')),
            chapter.response === ''
              ? null
              : h(React.Fragment, null,
                  h('div', { className: 'codex-rail-card-role' }, t('assistant')),
                  h('div', { className: 'codex-rail-card-text codex-rail-card-response' }, chapter.response))),
          h('div', { className: 'codex-rail-card-foot' },
            h('button', {
              type: 'button',
              className: 'codex-rail-jump',
              onClick: () => { void jumpTo(chapter); },
            }, t('jump'))));
      }

      function renderPanel() {
        return h('div', {
          className: 'codex-rail-panel',
          role: 'dialog',
          'aria-label': t('favorites'),
          onMouseDown: (event) => event.stopPropagation(),
        },
          h('div', { className: 'codex-rail-panel-head' },
            h('span', null, t('favorites')),
            h('button', {
              type: 'button',
              className: 'codex-rail-icon-btn',
              'aria-label': t('close'),
              onClick: () => setPanelOpen(false),
            }, '×')),
          favorites.length === 0
            ? h('div', { className: 'codex-rail-panel-empty' }, t('noFavorites'))
            : h('div', { className: 'codex-rail-panel-list' },
                favorites.map((item) => h('div', { key: item.id, className: 'codex-rail-fav' },
                  h('button', {
                    type: 'button',
                    className: 'codex-rail-fav-main',
                    onClick: () => openFavorite(item),
                  },
                    h('span', { className: 'codex-rail-fav-title' },
                      item.sessionId === sessionId
                        ? (sessionTitle || item.sessionId)
                        : (item.sessionTitle || item.sessionId)),
                    h('span', { className: 'codex-rail-fav-preview' }, item.prompt || item.response || t('untitled')),
                    h('span', { className: 'codex-rail-fav-meta' },
                      `${t('turn', { turn: item.turn })} · ${formatSavedAt(item.savedAt)}`)),
                  h('button', {
                    type: 'button',
                    className: 'codex-rail-fav-remove',
                    title: t('remove'),
                    'aria-label': t('remove'),
                    onClick: (event) => {
                      event.stopPropagation();
                      toggleFavorite(item);
                    },
                  }, '×')))));
      }

      // Keep the rail's bottom at 80% of the whole viewport. The top sits below
      // the session header, so its height is the space from there down to that
      // boundary. As turns accumulate, the space between ticks is what shrinks;
      // only for very dense logs do the (invisible) hit areas compress as well,
      // so every tick still fits without scrolling.
      const railHeight = Math.max(200, Math.min(
        Math.round(viewportH * 0.8) - (top + 8),
        viewportH - top - 12,
      ));
      const railChrome = 40 + 10 + 7 + (error === '' ? 0 : 24);
      const listHeight = Math.max(0, railHeight - railChrome);
      const chapterCount = chapters.length;
      const minGap = 1;
      const maxGap = 7;
      let tickHeight = 12;
      let tickGap = 7;
      if (chapterCount > 1) {
        const naturalGap = (listHeight - chapterCount * tickHeight) / (chapterCount - 1);
        if (naturalGap >= minGap) {
          tickGap = Math.min(maxGap, naturalGap);
        } else {
          tickGap = minGap;
          tickHeight = Math.max(2, Math.floor(
            (listHeight - tickGap * (chapterCount - 1)) / chapterCount,
          ));
        }
      }
      const tickStep = chapterCount > 1
        ? (listHeight - tickHeight) / (chapterCount - 1)
        : 0;

      const rail = h('div', {
        ref: rootRef,
        className: 'codex-rail-root',
        style: { top: `${top + 8}px`, height: `${railHeight}px` },
        'aria-label': t('title'),
        id: 'codex-rail-v2',
        'data-codex-history-rail': '',
        'data-rail-version': '2',
        onMouseLeave: () => setHover(null),
      },
        h('div', { className: 'codex-rail-head' },
          h('button', {
            type: 'button',
            className: 'codex-rail-collect',
            'data-open': panelOpen ? 'true' : undefined,
            'aria-haspopup': 'dialog',
            'aria-expanded': panelOpen,
            title: t('favorites'),
            onClick: () => {
              setPanelOpen((value) => !value);
              setHover(null);
            },
          },
            h('span', { className: 'codex-rail-collect-icon' }, favorites.length === 0 ? '☆' : '★'),
            h('span', { className: 'codex-rail-collect-count' }, String(favorites.length))),
          jumping === null
            ? null
            : h('div', { className: 'codex-rail-busy', role: 'status' }, t('loading'))),
        h('div', {
          className: 'codex-rail-scroll',
          style: {
            position: 'relative',
            display: 'block',
            height: `${listHeight}px`,
            maxHeight: `${listHeight}px`,
            overflow: 'hidden',
          },
        },
          chapters.length === 0
            ? h('div', { className: 'codex-rail-empty' }, t('empty'))
            : chapters.map((chapter, index) => {
                const isFavorite = favoriteIds.has(`${sessionId}::${chapter.turn}`);
                return h('button', {
                  key: chapter.turn,
                  type: 'button',
                  className: 'codex-rail-tick',
                  style: {
                    position: 'absolute',
                    left: '10px',
                    top: `${index * tickStep}px`,
                    height: `${tickHeight}px`,
                  },
                  'data-active': activeTurn === chapter.turn ? 'true' : undefined,
                  'data-saved': isFavorite ? 'true' : undefined,
                  'aria-label': t('chapter', { turn: chapter.turn }),
                  onClick: () => { void jumpTo(chapter); },
                  onMouseEnter: (event) => openCard(chapter, event.currentTarget),
                  onFocus: (event) => openCard(chapter, event.currentTarget),
                }, h('span', { className: 'codex-rail-tick-line' }));
              })),
        error === '' ? null : h('div', { className: 'codex-rail-error', role: 'status' }, error),
        hoveredChapter === undefined ? null : renderCard(hoveredChapter, hoveredFavorite),
        panelOpen ? renderPanel() : null);

      return h(React.Fragment, null,
        h('span', { ref: anchorRef, className: 'codex-rail-anchor', 'aria-hidden': 'true' }),
        host === null ? null : createPortal(rail, host));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        pluginCtx = ctx;
        try {
          ensureStyles();
        } catch (error) {
          console.error('[codex-rail] styles could not be installed', error);
        }
        try {
          ctx.effect(() => {
            const locale = ctx.get('locale');
            if (locale === undefined || typeof locale.register !== 'function') return () => {};
            return locale.register(NS, { zh: STRINGS.zh, en: STRINGS.en });
          }, 'codex-history-rail: dictionaries');
        } catch (error) {
          console.error('[codex-rail] dictionaries could not be registered', error);
        }
        try {
          ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
            name: 'conversation.session.header.utilities',
            id: 'codex-history-rail',
            order: 10,
          }, Rail));
        } catch (error) {
          console.error('[codex-rail] the conversation header seat could not be registered', error);
        }
      },
    };
  },
});
