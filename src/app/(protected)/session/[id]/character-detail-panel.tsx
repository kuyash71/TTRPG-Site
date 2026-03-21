"use client";

interface CharacterInfo {
  id: string;
  userId: string;
  name: string;
  username: string;
  className: string | null;
  raceName: string | null;
  level: number;
  publicData: Record<string, unknown>;
  privateData: Record<string, unknown>;
  stats: { name: string; baseValue: number; currentValue: number; maxValue: number | null; isPublic: boolean }[];
}

interface Props {
  character: CharacterInfo;
  isGm: boolean;
  isOwn: boolean;
  onClose: () => void;
}

interface CustomFieldEntry {
  id: string;
  title: string;
  content: string;
  isPrivate: boolean;
}

function getCustomFields(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>,
  canSeeAll: boolean
): CustomFieldEntry[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toEntries = (raw: unknown, isPrivate: boolean): CustomFieldEntry[] => {
    if (!Array.isArray(raw)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((f: any) => ({
      id: String(f.id ?? ""),
      title: String(f.title ?? ""),
      content: String(f.content ?? ""),
      isPrivate,
    }));
  };
  return [
    ...toEntries(publicData?.customFields, false),
    ...(canSeeAll ? toEntries(privateData?.customFields, true) : []),
  ];
}

export function CharacterDetailPanel({ character, isGm, isOwn, onClose }: Props) {
  const canSeeAll = isGm || isOwn;
  const visibleStats = canSeeAll
    ? character.stats
    : character.stats.filter((s) => s.isPublic);

  const resourceStats = visibleStats.filter((s) => s.maxValue !== null);
  const attributeStats = visibleStats.filter((s) => s.maxValue === null);

  const customFields: CustomFieldEntry[] = getCustomFields(character.publicData, character.privateData, canSeeAll);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="heading-gothic text-sm font-semibold text-zinc-100">
            {character.name}
          </h3>
          <p className="text-xs text-zinc-500">
            {character.username}
            {isOwn && (
              <span className="ml-1 rounded bg-lavender-900/50 px-1 py-0.5 text-[9px] text-lavender-400">
                Senin
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300"
          title="Kapat"
        >
          &times;
        </button>
      </div>

      {/* Temel bilgiler */}
      <div className="mb-4 flex flex-wrap gap-2">
        {character.raceName && (
          <span className="rounded bg-surface-raised px-2 py-1 text-xs text-zinc-300">
            {character.raceName}
          </span>
        )}
        {character.className && (
          <span className="rounded bg-surface-raised px-2 py-1 text-xs text-zinc-300">
            {character.className}
          </span>
        )}
        <span className="rounded bg-surface-raised px-2 py-1 text-xs text-zinc-400">
          Lv {character.level}
        </span>
      </div>

      {/* Resources */}
      {resourceStats.length > 0 && (
        <div className="mb-4 space-y-2">
          <h4 className="text-[10px] font-semibold text-zinc-500">Kaynaklar</h4>
          {resourceStats.map((stat) => {
            const percentage = stat.maxValue
              ? (stat.currentValue / stat.maxValue) * 100
              : 100;
            const barColor =
              stat.name === "HP"
                ? "bg-green-500"
                : stat.name === "Mana"
                  ? "bg-blue-500"
                  : "bg-lavender-400";

            return (
              <div key={stat.name}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">{stat.name}</span>
                  <span className="font-mono text-[10px] text-zinc-300">
                    {stat.currentValue}/{stat.maxValue}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-void">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Attributes */}
      {attributeStats.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-[10px] font-semibold text-zinc-500">Nitelikler</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {attributeStats.map((stat) => (
              <div
                key={stat.name}
                className="flex items-center justify-between rounded border border-border bg-void px-2 py-1"
              >
                <span className="text-[10px] text-zinc-400">{stat.name}</span>
                <span className="font-mono text-xs font-bold text-zinc-100">
                  {stat.currentValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backstory (sadece GM ve sahip) */}
      {canSeeAll && !!character.publicData?.backstory && (
        <div className="mb-4">
          <h4 className="mb-1 text-[10px] font-semibold text-zinc-500">Hikaye</h4>
          <p className="text-xs leading-relaxed text-zinc-400">
            {String(character.publicData.backstory)}
          </p>
        </div>
      )}

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <div className="mb-4 space-y-2">
          <h4 className="text-[10px] font-semibold text-zinc-500">Ek Bilgiler</h4>
          {customFields.map((field) => (
            <div key={field.id} className="rounded border border-border bg-void p-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-zinc-300">
                  {field.title || "Başlıksız"}
                </span>
                {field.isPrivate && (
                  <span className="rounded bg-red-900/30 px-1 py-0.5 text-[9px] text-red-400">
                    Gizli
                  </span>
                )}
              </div>
              {field.content && (
                <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">
                  {field.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!canSeeAll && visibleStats.length === 0 && (
        <p className="py-4 text-center text-xs text-zinc-600">
          Bu karakter hakkında görüntülenecek bilgi yok.
        </p>
      )}
    </div>
  );
}
