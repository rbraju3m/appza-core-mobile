// P1b: the tutorial video an APPZA admin sets in Core, drawn on the opening modal's first page.

export function VideoFrame({ url, title }: { url: string; title: string }) {
  return (
    <div className="appza-video-frame">
      <iframe
        src={url}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
