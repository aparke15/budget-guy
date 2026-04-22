import type { DeleteImpact } from "../shared/management-helpers";

type DeleteImpactBannerProps = {
  deleteImpact: DeleteImpact;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteImpactBanner(props: DeleteImpactBannerProps) {
  const { deleteImpact, onConfirm, onCancel } = props;

  return (
    <div className="section status-message--warning">
      <div className="section-heading">
        <h2 className="section-title text-negative">{deleteImpact.title}</h2>
        <p className="section-subtitle danger-copy">
          {deleteImpact.description}
        </p>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onConfirm} className="button button--danger">
          confirm delete
        </button>

        <button type="button" onClick={onCancel} className="button button--secondary">
          cancel
        </button>
      </div>
    </div>
  );
}
