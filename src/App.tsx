import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines, ChevronDown, CircleHelp, Disc3, FileVideo, FolderOpen,
  Heart, ListMusic, Maximize, Minimize, MoreHorizontal, Music2, Pause, Play,
  Plus, Repeat, Search, SkipBack, SkipForward, Volume2,
  VolumeX, X, Shuffle, PanelLeftClose, PanelLeftOpen
} from "lucide-react";

type MediaFile = { name: string; path: string; url: string };
type Track = { id: string; name: string; url: string; path?: string; kind: "audio" | "video"; duration?: number };
type View = "home" | "library" | "playlist" | "favorites";

const audioExt = /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i;
const videoExt = /\.(mp4|mkv|avi|mov|webm|m4v)$/i;
const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
const makeTrack = (file: File | MediaFile): Track | null => {
  const name = file.name;
  const kind = audioExt.test(name) ? "audio" : videoExt.test(name) ? "video" : null;
  if (!kind) return null;
  const url = "url" in file ? file.url : URL.createObjectURL(file);
  return { id: crypto.randomUUID(), name, url, path: "path" in file ? file.path : undefined, kind };
};

export default function App() {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.82);
  const [muted, setMuted] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("home");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);

  const current = tracks.find((track) => track.id === currentId) ?? null;
  const visibleTracks = useMemo(() => {
    const base = view === "favorites" ? tracks.filter((t) => favorites.includes(t.id))
      : view === "playlist" ? tracks : tracks;
    return base.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  }, [tracks, favorites, view, query]);

  const addTracks = useCallback((incoming: (File | MediaFile)[]) => {
    const valid = incoming.map(makeTrack).filter((t): t is Track => Boolean(t));
    if (!valid.length) { setError("No supported media files found. Try MP4, MKV, MP3, WAV or FLAC."); return; }
    setError("");
    setTracks((old) => {
      const next = [...old, ...valid];
      if (!currentId && valid[0]) setCurrentId(valid[0].id);
      return next;
    });
    if (!currentId && valid[0]) setView("home");
  }, [currentId]);

  const openFiles = useCallback(async () => {
    if (window.merci) {
      const files = await window.merci.openFiles();
      if (files.length) addTracks(files);
    } else fileInputRef.current?.click();
  }, [addTracks]);

  const playTrack = useCallback((id: string) => {
    setCurrentId(id);
    setCurrentTime(0);
    setPlaying(true);
    setError("");
  }, []);

  const stepTrack = useCallback((direction: number) => {
    if (!tracks.length) return;
    const index = Math.max(0, tracks.findIndex((t) => t.id === currentId));
    const next = shuffle ? Math.floor(Math.random() * tracks.length) : (index + direction + tracks.length) % tracks.length;
    playTrack(tracks[next].id);
  }, [tracks, currentId, shuffle, playTrack]);

  const togglePlay = useCallback(() => {
    if (!current) { if (tracks[0]) playTrack(tracks[0].id); else openFiles(); return; }
    setPlaying((v) => !v);
  }, [current, tracks, playTrack, openFiles]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !current) return;
    el.volume = muted ? 0 : volume;
    el.playbackRate = playbackRate;
    if (playing) void el.play().catch(() => { setPlaying(false); setError("This media format may not be supported by your system."); });
    else el.pause();
  }, [playing, current, volume, muted, playbackRate]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onDuration = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onEnded = () => { if (repeat) { el.currentTime = 0; void el.play(); } else stepTrack(1); };
    const onError = () => setError("Unable to play this file. Try another media format.");
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDuration);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDuration);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, [currentId, repeat, stepTrack]);

  useEffect(() => {
    const unsubscribe = window.merci?.onMenu((action) => {
      if (action === "open" || action === "open-multiple") void openFiles();
      if (action === "play-pause") togglePlay();
      if (action === "stop") { setPlaying(false); if (mediaRef.current) mediaRef.current.currentTime = 0; }
      if (action === "fullscreen") void document.querySelector(".stage")?.requestFullscreen();
    });
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); togglePlay(); }
      if (event.code === "ArrowRight") { if (mediaRef.current) mediaRef.current.currentTime += 5; }
      if (event.code === "ArrowLeft") { if (mediaRef.current) mediaRef.current.currentTime -= 5; }
      if (event.code === "ArrowUp") setVolume((v) => Math.min(1, v + 0.05));
      if (event.code === "ArrowDown") setVolume((v) => Math.max(0, v - 0.05));
      if (event.key.toLowerCase() === "f") void document.querySelector(".stage")?.requestFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => { unsubscribe?.(); window.removeEventListener("keydown", onKey); };
  }, [openFiles, togglePlay]);

  const toggleFavorite = (id: string) => setFavorites((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id]);
  const seek = (value: number) => { if (mediaRef.current) mediaRef.current.currentTime = value; setCurrentTime(value); };
  const title = view === "favorites" ? "Your favorites" : view === "playlist" ? "Playing queue" : view === "library" ? "Your library" : "Your space";

  return (
    <div className="app-shell" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={(e) => {
      e.preventDefault(); setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      addTracks(files);
    }}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><AudioLines size={17} /></div><span>merci<span className="brand-light"> player</span></span></div>
        <div className="window-caption">A quieter way to listen</div>
        <div className="window-actions">
          <button className="window-btn" aria-label="Minimize" onClick={() => void window.merci?.minimize()}><Minimize size={13}/></button>
          <button className="window-btn" aria-label="Maximize" onClick={() => void window.merci?.maximize()}><Maximize size={12}/></button>
          <button className="window-btn close" aria-label="Close" onClick={() => void window.merci?.close()}><X size={14}/></button>
        </div>
      </header>

      <div className="workspace">
        {sidebarOpen && <aside className="sidebar">
          <div className="side-section">
            <div className="side-label">MENU</div>
            <button className={view === "home" ? "nav-item active" : "nav-item"} onClick={() => setView("home")}><Disc3 size={17}/> Overview</button>
            <button className={view === "library" ? "nav-item active" : "nav-item"} onClick={() => setView("library")}><ListMusic size={17}/> Library <span className="nav-count">{tracks.length}</span></button>
            <button className={view === "playlist" ? "nav-item active" : "nav-item"} onClick={() => setView("playlist")}><AudioLines size={17}/> Queue</button>
            <button className={view === "favorites" ? "nav-item active" : "nav-item"} onClick={() => setView("favorites")}><Heart size={17}/> Favorites</button>
          </div>
          <div className="sidebar-bottom">
            <div className="storage-card"><div className="storage-icon"><FolderOpen size={17}/></div><div><strong>Your collection</strong><span>{tracks.length} {tracks.length === 1 ? "file" : "files"} added</span></div></div>
            <button className="side-help"><CircleHelp size={15}/> Keyboard shortcuts <span>?</span></button>
            <div className="version">MERCI PLAYER <span>·</span> 1.0.0</div>
          </div>
        </aside>}

        <main className="main-content">
          <div className="content-toolbar">
            <button className="icon-btn sidebar-toggle" aria-label="Toggle sidebar" onClick={() => setSidebarOpen((v) => !v)}>{sidebarOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button>
            <div className="breadcrumb">Library <span>/</span> <strong>{title}</strong></div>
            <div className="toolbar-right">
              <label className="search-box"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your music..." /><kbd>⌘ K</kbd></label>
              <button className="add-button" onClick={() => void openFiles()}><Plus size={16}/> Add media</button>
            </div>
          </div>

          <div className="page-scroll">
            <section className="welcome-row">
              <div><div className="eyebrow"><span className="status-dot"/> YOUR PERSONAL MEDIA SPACE</div><h1>{title}<span className="heading-period">.</span></h1><p>A little less noise. A lot more listening.</p></div>
              <div className="welcome-actions"><span className="file-total">{tracks.length} ITEMS</span><button className="round-action" onClick={() => void openFiles()} aria-label="Add files"><Plus size={19}/></button></div>
            </section>

            <section className="player-layout">
              <div className="player-column">
                <div className={current?.kind === "video" ? "stage video-stage" : "stage"}>
                  {current?.kind === "video" ? (
                    <video ref={mediaRef as React.RefObject<HTMLVideoElement>} key={current.id} src={current.url} className="video-element" onClick={togglePlay} />
                  ) : (
                    <>
                      <div className="stage-glow"/>
                      <div className="album-art">
                        <div className="art-ring ring-one"/><div className="art-ring ring-two"/>
                        <div className="art-core"><AudioLines size={52} strokeWidth={1.1}/></div>
                        <span className="art-orbit orbit-a"/><span className="art-orbit orbit-b"/>
                      </div>
                      <div className={playing ? "sound-wave active" : "sound-wave"}>{Array.from({length: 36}, (_, i) => <i key={i} style={{height: `${12 + ((i * 17 + 13) % 43)}px`, animationDelay: `${i * 0.035}s`}}/>)}</div>
                      {!current && <div className="empty-stage-copy"><span>READY WHEN YOU ARE</span><strong>Your next favorite<br/>thing starts here.</strong><button onClick={() => void openFiles()}><Plus size={15}/> Open a media file</button></div>}
                    </>
                  )}
                  {current?.kind === "video" && <div className="video-tag"><FileVideo size={13}/> NOW PLAYING</div>}
                  <button className="stage-more" aria-label="More options"><MoreHorizontal size={19}/></button>
                </div>

                <div className="track-meta">
                  <div className="track-cover">{current?.kind === "video" ? <FileVideo size={20}/> : <Music2 size={21}/>}</div>
                  <div className="track-text"><strong title={current?.name}>{current?.name ?? "Nothing playing yet"}</strong><span>{current ? (current.kind === "video" ? "VIDEO FILE" : "AUDIO FILE") : "Choose something from your library"}</span></div>
                  {current && <button className={favorites.includes(current.id) ? "favorite-btn selected" : "favorite-btn"} onClick={() => toggleFavorite(current.id)} aria-label="Toggle favorite"><Heart size={18} fill={favorites.includes(current.id) ? "currentColor" : "none"}/></button>}
                </div>

                <div className="playback-panel">
                  <div className="progress-wrap"><span>{formatTime(currentTime)}</span><input aria-label="Seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(e) => seek(Number(e.target.value))} style={{"--progress": `${duration ? currentTime / duration * 100 : 0}%`} as React.CSSProperties}/><span>{formatTime(duration)}</span></div>
                  <div className="control-row">
                    <div className="control-side"><button className={shuffle ? "control-btn toggled" : "control-btn"} onClick={() => setShuffle((v) => !v)} aria-label="Shuffle"><Shuffle size={17}/></button></div>
                    <div className="transport">
                      <button className="control-btn skip" onClick={() => stepTrack(-1)} aria-label="Previous"><SkipBack size={19} fill="currentColor"/></button>
                      <button className="play-button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}</button>
                      <button className="control-btn skip" onClick={() => stepTrack(1)} aria-label="Next"><SkipForward size={19} fill="currentColor"/></button>
                    </div>
                    <div className="control-side right-controls">
                      <button className={repeat ? "control-btn toggled" : "control-btn"} onClick={() => setRepeat((v) => !v)} aria-label="Repeat"><Repeat size={17}/></button>
                      <button className="control-btn speed-btn" onClick={() => setPlaybackRate((v) => v >= 2 ? 0.5 : Math.round((v + 0.25) * 100) / 100)}>{playbackRate}×</button>
                      <div className="volume-control"><button className="control-btn" onClick={() => setMuted((v) => !v)} aria-label="Mute">{muted || volume === 0 ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={(e) => {setVolume(Number(e.target.value));setMuted(false);}}/></div>
                      <button className="control-btn" aria-label="Fullscreen" onClick={() => void document.querySelector(".stage")?.requestFullscreen()}><Maximize size={16}/></button>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="queue-panel">
                <div className="queue-heading"><div><span className="eyebrow">UP NEXT</span><h2>Playing queue</h2></div><button className="text-action" onClick={() => setView("playlist")}>View all <ChevronDown size={14}/></button></div>
                {tracks.length ? <div className="queue-list">{tracks.slice(0, 6).map((track, index) => (
                  <button key={track.id} className={track.id === currentId ? "queue-item current" : "queue-item"} onClick={() => playTrack(track.id)}>
                    <div className="queue-index">{track.id === currentId && playing ? <AudioLines size={15}/> : String(index + 1).padStart(2, "0")}</div>
                    <div className="queue-art">{track.kind === "video" ? <FileVideo size={16}/> : <Music2 size={16}/>}</div>
                    <div className="queue-info"><strong title={track.name}>{track.name}</strong><span>{track.kind === "video" ? "Video" : "Audio"}</span></div>
                    {track.id === currentId ? <span className="playing-pill">PLAYING</span> : <span className="queue-duration">{track.duration ? formatTime(track.duration) : "—"}</span>}
                  </button>
                ))}</div> : <div className="queue-empty"><div className="queue-empty-icon"><ListMusic size={22}/></div><strong>Your queue is clear</strong><span>Add a few files and<br/>they'll show up here.</span><button onClick={() => void openFiles()}><Plus size={14}/> Add media</button></div>}
                <div className="queue-footer"><span><span className="status-dot"/> LOCAL PLAYBACK</span><span>PRIVATE BY DESIGN</span></div>
              </aside>
            </section>

            <section className="library-section">
              <div className="section-heading"><div><span className="eyebrow">COLLECTION</span><h2>{view === "favorites" ? "Saved favorites" : "Recently added"}</h2></div><button className="text-action" onClick={() => setView("library")}>Browse library <ChevronDown size={14}/></button></div>
              {visibleTracks.length ? <div className="media-table">
                <div className="table-head"><span>#</span><span>TITLE</span><span>TYPE</span><span>STATUS</span><span/></div>
                {visibleTracks.slice(0, 8).map((track, index) => <div className={track.id === currentId ? "table-row selected-row" : "table-row"} key={track.id}>
                  <button className="row-number" onClick={() => playTrack(track.id)}>{track.id === currentId && playing ? <AudioLines size={15}/> : <span>{String(index + 1).padStart(2,"0")}</span>}</button>
                  <button className="row-title" onClick={() => playTrack(track.id)}><span className="mini-art">{track.kind === "video" ? <FileVideo size={15}/> : <Music2 size={15}/>}</span><strong>{track.name}</strong></button>
                  <span className="type-label">{track.kind.toUpperCase()}</span>
                  <span className="status-label">{track.id === currentId ? "Now playing" : "In library"}</span>
                  <button className={favorites.includes(track.id) ? "row-fav selected" : "row-fav"} onClick={() => toggleFavorite(track.id)} aria-label="Favorite"><Heart size={15} fill={favorites.includes(track.id) ? "currentColor" : "none"}/></button>
                </div>)}
              </div> : <div className="library-empty"><div className="empty-icon"><FolderOpen size={23}/></div><div><strong>{query ? "No matching media" : "Your library is waiting"}</strong><span>{query ? "Try another search term." : "Add audio or video files to start building your collection."}</span></div><button className="add-button" onClick={() => void openFiles()}><Plus size={15}/> Add media</button></div>}
            </section>
            <footer className="footer-note"><span>MADE FOR THE MOMENT.</span><span>MERCI PLAYER <span className="footer-dot">©</span> 2026</span></footer>
          </div>
        </main>
      </div>
      {error && <div className="toast"><span className="toast-dot"/> {error}<button onClick={() => setError("")}><X size={14}/></button></div>}
      {dragging && <div className="drop-overlay"><div><FolderOpen size={34}/><strong>Drop your media here</strong><span>Audio and video files are supported</span></div></div>}
      <input ref={fileInputRef} type="file" accept="audio/*,video/*,.mkv,.flac,.avi" multiple hidden onChange={(e) => {addTracks(Array.from(e.target.files ?? []));e.target.value="";}}/>
      {current?.kind === "audio" && <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} key={current.id} src={current.url} />}
    </div>
  );
}