import type { PropsWithChildren, ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title?: ReactNode
  contentClassName?: string
  onClose: () => void
}

export function Modal({
  open,
  title,
  contentClassName,
  onClose,
  children,
}: PropsWithChildren<ModalProps>) {
  if (!open) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="modal-overlay show"
      role="dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={`modal-content ${contentClassName ?? ''}`.trim()}>
        <div className="modal-header">
          {title ? <h3>{title}</h3> : <span />}
          <button className="modal-close" type="button" onClick={onClose}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
