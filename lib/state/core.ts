import { logInvalidTransition } from "./devLog";

export interface TransitionResult<TModel, TEffect> {
  nextStateId: string;
  modelPatch: Partial<TModel>;
  effects: TEffect[];
}

export interface IState<TModel, TEvent, TEffect> {
  id: string;
  enter(model: TModel): TEffect[];
  exit(model: TModel): TEffect[];
  handle(
    model: TModel,
    event: TEvent,
  ): TransitionResult<TModel, TEffect> | null;
}

export interface StateContext<TModel, TEvent, TEffect> {
  currentStateId: string;
  model: TModel;
  dispatch(event: TEvent): void;
  can(event: TEvent): boolean;
  subscribe(listener: StateListener<TModel, TEffect>): () => void;
}

export type StateListener<TModel, TEffect> = (snapshot: {
  stateId: string;
  model: TModel;
  effects: TEffect[];
}) => void;

export function createMachine<TModel, TEvent extends { type: string }, TEffect>(
  machineName: string,
  states: Record<string, IState<TModel, TEvent, TEffect>>,
  initialStateId: string,
  initialModel: TModel,
  effectRunner?: (effect: TEffect, dispatch: (event: TEvent) => void) => void,
): StateContext<TModel, TEvent, TEffect> {
  let currentStateId = initialStateId;
  let model = { ...initialModel };
  const listeners: Set<StateListener<TModel, TEffect>> = new Set();

  let isProcessing = false;
  const eventQueue: TEvent[] = [];

  function getState(id: string): IState<TModel, TEvent, TEffect> {
    const state = states[id];
    if (!state) {
      throw new Error(
        `[${machineName}] State "${id}" not found in state registry.`,
      );
    }
    return state;
  }

  function notify(effects: TEffect[]): void {
    const snapshot = { stateId: currentStateId, model: { ...model }, effects };
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function processEvent(event: TEvent): void {
    const state = getState(currentStateId);
    const result = state.handle(model, event);

    if (result === null) {
      logInvalidTransition(machineName, currentStateId, event.type);
      return;
    }

    const allEffects: TEffect[] = [];

    const exitEffects = state.exit(model);
    allEffects.push(...exitEffects);

    model = { ...model, ...result.modelPatch };
    currentStateId = result.nextStateId;

    allEffects.push(...result.effects);

    const nextState = getState(currentStateId);
    const enterEffects = nextState.enter(model);
    allEffects.push(...enterEffects);

    notify(allEffects);

    if (effectRunner) {
      for (const effect of allEffects) {
        effectRunner(effect, dispatch);
      }
    }
  }

  function drainQueue(): void {
    if (isProcessing) return;
    isProcessing = true;
    try {
      while (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        processEvent(event);
      }
    } finally {
      isProcessing = false;
    }
  }

  function dispatch(event: TEvent): void {
    eventQueue.push(event);
    drainQueue();
  }

  function can(event: TEvent): boolean {
    const state = getState(currentStateId);
    const result = state.handle({ ...model }, event);
    return result !== null;
  }

  function subscribe(
    listener: StateListener<TModel, TEffect>,
  ): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  const initialState = getState(initialStateId);
  const enterEffects = initialState.enter(model);
  if (enterEffects.length > 0) {
    notify(enterEffects);
    if (effectRunner) {
      for (const effect of enterEffects) {
        effectRunner(effect, dispatch);
      }
    }
  }

  return {
    get currentStateId() {
      return currentStateId;
    },
    get model() {
      return { ...model };
    },
    dispatch,
    can,
    subscribe,
  };
}
