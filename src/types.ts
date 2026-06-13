import type { CursorData, DbId } from "./orca.js"

export type ActionSource = "command" | "keydown"

export type DecisionDetails = {
  readonly blockId?: DbId
  readonly blockText?: string
  readonly domText?: string | null
  readonly indent?: string
}

export type PassDecision = DecisionDetails & {
  readonly kind: "pass"
  readonly reason: string
}

export type OutdentDecision = DecisionDetails & {
  readonly kind: "outdent"
  readonly source: ActionSource
  readonly commandId: string
  readonly blockId: DbId
  readonly blockText: string
  readonly cursor: CursorData | null
}

export type EnterDecision = PassDecision | OutdentDecision
