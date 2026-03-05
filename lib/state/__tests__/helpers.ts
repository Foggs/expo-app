import { createMachine, type StateContext } from "../core";
import { matchFlowStates, INITIAL_MATCH_FLOW_MODEL } from "../matchFlow";
import type { MatchFlowModel, MatchFlowEvent, MatchFlowEffect } from "../matchFlow";
import { turnFlowStates, INITIAL_TURN_FLOW_MODEL } from "../turnFlow";
import type { TurnFlowModel, TurnFlowEvent, TurnFlowEffect } from "../turnFlow";
import type { FlowError } from "../errors";

export function createMatchMachine(
  modelOverrides?: Partial<MatchFlowModel>,
  initialState?: string,
): StateContext<MatchFlowModel, MatchFlowEvent, MatchFlowEffect> {
  return createMachine<MatchFlowModel, MatchFlowEvent, MatchFlowEffect>(
    "MatchFlow",
    matchFlowStates,
    initialState ?? "idle",
    { ...INITIAL_MATCH_FLOW_MODEL, ...modelOverrides },
  );
}

export function createTurnMachine(
  modelOverrides?: Partial<TurnFlowModel>,
  initialState?: string,
): StateContext<TurnFlowModel, TurnFlowEvent, TurnFlowEffect> {
  return createMachine<TurnFlowModel, TurnFlowEvent, TurnFlowEffect>(
    "TurnFlow",
    turnFlowStates,
    initialState ?? "waiting_for_turn",
    { ...INITIAL_TURN_FLOW_MODEL, ...modelOverrides },
  );
}

export function makeFlowError(overrides?: Partial<FlowError>): FlowError {
  return {
    code: "TEST_ERROR",
    source: "runtime",
    retryable: true,
    fatal: false,
    message: "Test error",
    stateVersion: 0,
    occurredAt: Date.now(),
    ...overrides,
  };
}

export function collectEffects<TModel, TEvent extends { type: string }, TEffect>(
  machine: StateContext<TModel, TEvent, TEffect>,
  event: TEvent,
): { effects: TEffect[]; stateId: string; model: TModel } {
  let captured: { stateId: string; model: TModel; effects: TEffect[] } | null = null;
  const unsub = machine.subscribe((snapshot) => {
    captured = snapshot;
  });
  machine.dispatch(event);
  unsub();
  if (captured) {
    return captured;
  }
  return { effects: [], stateId: machine.currentStateId, model: machine.model };
}
