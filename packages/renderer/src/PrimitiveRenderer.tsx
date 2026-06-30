import {
  IonAvatar,
  IonButton,
  IonCheckbox,
  IonImg,
  IonInput,
  IonLabel,
  IonText,
  IonTextarea,
} from '@ionic/react';
import type { PrimitiveRow } from './catalogIndex';

type PrimitiveOverrides = Record<string, unknown>;

type Props = {
  primitive: PrimitiveRow;
  overrides?: PrimitiveOverrides;
};

/**
 * Maps a Primitive row's `ionic_component` value to the corresponding
 * Ionic React component. Renders with placeholder content (slug as label)
 * when no overrides are provided; when DC#16 prop binding routes overrides
 * here, the rendered widget picks up the bound props instead.
 *
 * Per-component allowed-prop list is intentionally narrow at v1: text-ish
 * content, color, fill, src. New props get added as catalog use cases
 * surface them — denying unknown overrides keeps the renderer from
 * forwarding arbitrary JSON to Ionic, which catches typos at the seam.
 *
 * Unknown Ionic components fall through to a labeled placeholder so
 * additions to appza_primitives don't crash the renderer.
 */
export function PrimitiveRenderer({ primitive, overrides }: Props) {
  const label = readString(overrides, 'text') ?? primitive.name ?? primitive.slug;

  switch (primitive.ionic_component) {
    case 'IonButton':
      return (
        <IonButton
          size="small"
          fill={normalizeIonButtonFill(readString(overrides, 'fill'))}
          color={readString(overrides, 'color')}
        >
          {label}
        </IonButton>
      );

    case 'IonAvatar':
      return (
        <IonAvatar style={{ width: 40, height: 40 }}>
          <div className="appza-renderer-avatar-fallback">A</div>
        </IonAvatar>
      );

    case 'IonImg': {
      const src = readString(overrides, 'src');
      if (src) return <IonImg src={src} alt={label} />;
      return (
        <div className="appza-renderer-img-placeholder">
          <span>{label}</span>
        </div>
      );
    }

    case 'IonInput':
      return (
        <IonInput
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill="outline"
        />
      );

    case 'IonTextarea':
      return (
        <IonTextarea
          placeholder={readString(overrides, 'placeholder') ?? label}
          fill="outline"
          rows={2}
        />
      );

    case 'IonLabel':
      return <IonLabel>{label}</IonLabel>;

    case 'IonText':
      return (
        <IonText>
          <p style={{ margin: 0 }}>{label}</p>
        </IonText>
      );

    case 'IonCheckbox':
      return <IonCheckbox aria-label={label} />;

    default:
      return (
        <div className="appza-renderer-unknown">
          <code>{primitive.slug}</code>
          {primitive.ionic_component && (
            <span className="appza-renderer-unknown-hint">({primitive.ionic_component})</span>
          )}
        </div>
      );
  }
}

function readString(overrides: PrimitiveOverrides | undefined, key: string): string | undefined {
  if (!overrides) return undefined;
  const v = overrides[key];
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

type IonButtonFill = 'default' | 'solid' | 'clear' | 'outline';
const ION_BUTTON_FILLS: readonly IonButtonFill[] = ['default', 'solid', 'clear', 'outline'];

function normalizeIonButtonFill(raw: string | undefined): IonButtonFill {
  if (raw && (ION_BUTTON_FILLS as readonly string[]).includes(raw)) {
    return raw as IonButtonFill;
  }
  return 'solid';
}
