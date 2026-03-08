import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import { sanitizeDigitsInput } from '../../domain/validation'

interface DisplaySettingsFieldsProps {
  optionWrapChars: string
  titleSpacingPx: string
  titleWrapChars: string
  idPrefix?: string
  onChangeOptionWrapChars: (value: string) => void
  onChangeTitleSpacingPx: (value: string) => void
  onChangeTitleWrapChars: (value: string) => void
  onCommit: () => void
}

function onlyNumericKeyboard(event: ReactKeyboardEvent<HTMLInputElement>) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(event.key)) return

  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault()
  }
}

function buildId(prefix: string | undefined, suffix: string) {
  return prefix ? `${prefix}-${suffix}` : suffix
}

export function DisplaySettingsFields({
  optionWrapChars,
  titleSpacingPx,
  titleWrapChars,
  idPrefix,
  onChangeOptionWrapChars,
  onChangeTitleSpacingPx,
  onChangeTitleWrapChars,
  onCommit,
}: DisplaySettingsFieldsProps) {
  return (
    <>
      <div className="setting-group">
        <label className="setting-label" htmlFor={buildId(idPrefix, 'option-wrap-chars')}>
          选项换行字符数
        </label>
        <input
          className="setting-input"
          id={buildId(idPrefix, 'option-wrap-chars')}
          inputMode="numeric"
          max="40"
          min="1"
          pattern="[0-9]*"
          placeholder="16"
          step="1"
          type="text"
          value={optionWrapChars}
          onBlur={onCommit}
          onChange={(event) => onChangeOptionWrapChars(sanitizeDigitsInput(event.target.value))}
          onKeyDown={(event) => {
            onlyNumericKeyboard(event)
            if (event.key === 'Enter') {
              onCommit()
            }
          }}
        />
        <div className="setting-description">默认 16</div>
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor={buildId(idPrefix, 'title-spacing-px')}>
          标题间距（像素）
        </label>
        <input
          className="setting-input"
          id={buildId(idPrefix, 'title-spacing-px')}
          inputMode="numeric"
          max="120"
          min="0"
          pattern="[0-9]*"
          placeholder="30"
          step="1"
          type="text"
          value={titleSpacingPx}
          onBlur={onCommit}
          onChange={(event) => onChangeTitleSpacingPx(sanitizeDigitsInput(event.target.value))}
          onKeyDown={(event) => {
            onlyNumericKeyboard(event)
            if (event.key === 'Enter') {
              onCommit()
            }
          }}
        />
        <div className="setting-description">默认 30</div>
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor={buildId(idPrefix, 'title-wrap-chars')}>
          标题换行字符数
        </label>
        <input
          className="setting-input"
          id={buildId(idPrefix, 'title-wrap-chars')}
          inputMode="numeric"
          max="80"
          min="0"
          pattern="[0-9]*"
          placeholder="0"
          step="1"
          type="text"
          value={titleWrapChars}
          onBlur={onCommit}
          onChange={(event) => onChangeTitleWrapChars(sanitizeDigitsInput(event.target.value))}
          onKeyDown={(event) => {
            onlyNumericKeyboard(event)
            if (event.key === 'Enter') {
              onCommit()
            }
          }}
        />
        <div className="setting-description">0 表示按容器宽度自动换行</div>
      </div>
    </>
  )
}
