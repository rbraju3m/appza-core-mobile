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

type Props = {
  primitive: PrimitiveRow;
};

/**
 * Maps a Primitive row's `ionic_component` value to the corresponding
 * Ionic React component. Renders with placeholder content so the
 * simulator shows recognizable widgets even though the catalog doesn't
 * yet carry per-instance props (those land via default_props_override
 * + the DC#09 token cascade in a later slice).
 *
 * Unknown Ionic components fall through to a labeled placeholder so
 * additions to appza_primitives don't crash the renderer — we surface
 * them visually and ship a real mapping in the next sweep.
 */
export function PrimitiveRenderer({ primitive }: Props) {
  const label = primitive.name ?? primitive.slug;

  switch (primitive.ionic_component) {
    case 'IonButton':
      return (
        <IonButton size="small" fill="solid">
          {label}
        </IonButton>
      );

    case 'IonAvatar':
      return (
        <IonAvatar style={{ width: 40, height: 40 }}>
          <div className="appza-renderer-avatar-fallback">A</div>
        </IonAvatar>
      );

    case 'IonImg':
      return (
        <div className="appza-renderer-img-placeholder">
          <span>{label}</span>
        </div>
      );

    case 'IonInput':
      return <IonInput placeholder={label} fill="outline" />;

    case 'IonTextarea':
      return <IonTextarea placeholder={label} fill="outline" rows={2} />;

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
