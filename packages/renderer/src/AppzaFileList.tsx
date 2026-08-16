import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * Read-only list of attached files with a download affordance.
 *
 * Used by the feed card for a document post ("Publish as a post" on),
 * where the files are one field on the item rather than a repeated row —
 * fc-post-card is a CSS grid with named areas, so a variadic child would
 * have no area to land in. Taking the array as a single prop keeps the
 * card's child indices stable too, which every field_mapping and saved
 * customization on it depends on.
 *
 * Same row language as the DOCUMENTS tab's card on purpose: a file should
 * look like a file wherever it appears.
 */

export type FileListEntry = {
  id?: number;
  title?: string;
  type?: string;
  kind?: string;
  url?: string;
};

function readString(o: Record<string, unknown> | undefined, k: string): string | undefined {
  if (!o) return undefined;
  const v = o[k];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function readFiles(o: Record<string, unknown> | undefined): FileListEntry[] {
  const raw = o?.files;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is FileListEntry => !!f && typeof f === 'object' && !Array.isArray(f),
  );
}

export function AppzaFileList({ overrides }: { overrides?: Record<string, unknown> }) {
  const files = readFiles(overrides);
  if (files.length === 0) return null;

  const fileIcon = readString(overrides, 'file_icon') ?? 'document-outline';
  const imageIcon = readString(overrides, 'image_icon') ?? 'image-outline';
  const downloadIcon = readString(overrides, 'download_icon') ?? 'download-outline';

  return (
    <ul className="appza-file-list">
      {files.map((file, idx) => {
        const glyph = file.kind === 'image' ? imageIcon : fileIcon;
        const resolvedGlyph = resolveIcon(glyph);
        const resolvedDownload = resolveIcon(downloadIcon);
        const name = file.title ?? '';
        return (
          <li className="appza-file-list-row" key={file.id ?? `${name}-${idx}`}>
            {resolvedGlyph && (
              <IonIcon className="appza-file-list-icon" icon={resolvedGlyph} />
            )}
            {file.url ? (
              <a
                className="appza-file-list-link"
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                // Save under the shown name, not FC's storage filename.
                download={name}
                title={name}
              >
                {name}
              </a>
            ) : (
              <span className="appza-file-list-name">{name}</span>
            )}
            {file.url && resolvedDownload && (
              <a
                className="appza-file-list-download"
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                download={name}
                aria-label={`Download ${name}`}
              >
                <IonIcon icon={resolvedDownload} />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
