export type AvatarStackEntry = {
  user_id?: number;
  avatar?: string;
  display_name?: string;
};

function readAvatars(o: Record<string, unknown> | undefined): AvatarStackEntry[] {
  const raw = o?.avatars;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is AvatarStackEntry => !!a && typeof a === 'object' && !Array.isArray(a),
  );
}

function count(o: Record<string, unknown> | undefined, k: string, dflt: number): number {
  const raw = o?.[k];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}

export function AppzaAvatarStack({ overrides }: { overrides?: Record<string, unknown> }) {
  const all = readAvatars(overrides);
  if (all.length === 0) return null;
  const avatars = all.slice(0, count(overrides, 'max_faces', 3));

  return (
    <span className="appza-avatar-stack">
      {avatars.map((a, i) => (
        <img
          key={a.user_id ?? i}
          className="appza-avatar-stack-face"
          src={a.avatar}
          alt={a.display_name ?? ''}
          title={a.display_name ?? ''}
        />
      ))}
    </span>
  );
}
