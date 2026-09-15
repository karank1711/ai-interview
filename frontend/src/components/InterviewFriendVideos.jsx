export default function InterviewFriendVideos({
  videos,
  loading = false,
  exhausted = false,
  activeVideoId = '',
  onSelect,
  compact = false,
  showPlayer = true,
}) {
  const list = Array.isArray(videos)
    ? videos.filter((item) => (item?.videoId || item?.playlistId) && item?.title).slice(0, 3)
    : [];

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
        Finding matching resources…
      </div>
    );
  }

  if (!list.length) {
    if (!exhausted) return null;
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
        No more matching YouTube resources for this topic. Try a different topic or language.
      </div>
    );
  }

  const active = list.find((item) => item.videoId === activeVideoId) || null;

  return (
    <div className="space-y-3">
      {!compact ? (
      <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
        {list[0]?.kind === 'playlist' ? 'Recommended playlist' : list[0]?.kind === 'channel' ? 'Recommended channels' : 'Recommended resources'}
      </h3>
      ) : null}
      <div className={compact ? 'space-y-2' : `grid grid-cols-1 gap-3 ${list.length > 1 ? 'sm:grid-cols-3' : ''}`}>
        {list.map((video) => (
          compact ? (
            <div
              key={video.videoId || video.playlistId}
              className={`flex items-center gap-3 rounded-xl border bg-white/80 p-2 dark:bg-slate-900/80 ${
                active?.videoId === video.videoId
                  ? 'border-violet-500 dark:border-violet-400'
                  : 'border-slate-200 dark:border-slate-600'
              }`}
            >
              <button type="button" onClick={() => onSelect?.(video)} className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black">
                {video.thumbnail ? <img src={video.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{video.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {[video.channel, video.itemCount ? `${video.itemCount} videos` : ''].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelect?.(video)}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 text-xs font-semibold text-white"
              >
                Play
              </button>
            </div>
          ) : (
          <button
            key={video.videoId || video.playlistId}
            type="button"
            onClick={() => onSelect?.(video)}
            className={`overflow-hidden rounded-xl border bg-slate-50 text-left transition hover:border-violet-300 dark:bg-slate-900 ${
              active?.videoId === video.videoId
                ? 'border-violet-500 dark:border-violet-400'
                : 'border-slate-200 dark:border-slate-600'
            }`}
          >
            <div className="relative aspect-video bg-black">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : null}
              <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                ▶
              </span>
            </div>
            <div className="p-2">
              <p className="line-clamp-2 text-xs font-semibold text-slate-900 dark:text-white">{video.title}</p>
              {video.channel ? (
                <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{video.channel}</p>
              ) : null}
              {video.kind === 'playlist' && video.itemCount ? (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{video.itemCount} videos</p>
              ) : null}
              {video.description ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{video.description}</p>
              ) : video.reason ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{video.reason}</p>
              ) : null}
            </div>
          </button>
          )
        ))}
      </div>
      {showPlayer && active?.kind === 'channel' && active.url ? (
        <a
          href={active.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-slate-200 px-3 py-2 text-sm text-violet-700 dark:border-slate-600 dark:text-violet-300"
        >
          Open {active.channel || active.title} on YouTube
        </a>
      ) : null}
      {showPlayer && active?.embedUrl ? (
        <div className="flex min-w-0 max-w-full justify-start">
          <div className="w-full max-w-[min(100%,18rem)] overflow-hidden rounded-xl border border-slate-200 bg-black dark:border-slate-600 sm:max-w-[20rem]">
            <div className="relative aspect-video w-full">
            <iframe
              key={active.videoId || active.playlistId}
              title={active.title}
              src={active.embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
