from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from math import ceil
from re import fullmatch
from uuid import UUID

from .models import AdaptiveGraph, AdaptiveTransition


@dataclass(frozen=True)
class GameplayEvent:
    at_beats: float
    values: dict[str, float]


@dataclass(frozen=True)
class TransitionDecision:
    source_state_id: UUID
    target_state_id: UUID
    scheduled_beats: float
    condition: str


def validate_adaptive_graph(graph: AdaptiveGraph) -> None:
    if graph.initial_state_id is None:
        raise ValueError("adaptive graph requires an initial state")
    transitions_by_source: dict[UUID, list[AdaptiveTransition]] = {}
    for transition in graph.transitions:
        _parse_condition(transition.condition)
        transitions_by_source.setdefault(transition.source_state_id, []).append(transition)
    for transitions in transitions_by_source.values():
        if len({transition.condition for transition in transitions}) != len(transitions):
            raise ValueError("adaptive graph contains ambiguous transitions")
    reachable = {graph.initial_state_id}
    frontier = [graph.initial_state_id]
    while frontier:
        source = frontier.pop()
        for transition in transitions_by_source.get(source, []):
            if transition.target_state_id not in reachable:
                reachable.add(transition.target_state_id)
                frontier.append(transition.target_state_id)
    if {state.id for state in graph.states} - reachable:
        raise ValueError("adaptive graph contains unreachable states")


def simulate_adaptive_graph(graph: AdaptiveGraph, events: list[GameplayEvent], beats_per_bar: int = 4) -> list[TransitionDecision]:
    validate_adaptive_graph(graph)
    assert graph.initial_state_id is not None
    current_state = graph.initial_state_id
    decisions: list[TransitionDecision] = []
    for event in sorted(events, key=lambda item: item.at_beats):
        candidates = [
            transition
            for transition in graph.transitions
            if transition.source_state_id == current_state and _condition_matches(transition.condition, event.values)
        ]
        if not candidates:
            continue
        transition = candidates[0]
        scheduled = _quantize(event.at_beats, transition.quantization, beats_per_bar)
        decisions.append(
            TransitionDecision(
                source_state_id=current_state,
                target_state_id=transition.target_state_id,
                scheduled_beats=scheduled,
                condition=transition.condition,
            )
        )
        current_state = transition.target_state_id
    return decisions


def _parse_condition(condition: str) -> tuple[str, str, float]:
    match = fullmatch(r"\s*([a-z][a-z0-9_]*)\s*(<=|>=|==|<|>)\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*", condition)
    if match is None:
        raise ValueError("adaptive condition must compare one gameplay parameter to a number")
    return match.group(1), match.group(2), float(match.group(3))


def _condition_matches(condition: str, values: dict[str, float]) -> bool:
    name, operator, expected = _parse_condition(condition)
    actual = values.get(name)
    if actual is None:
        return False
    operators: dict[str, Callable[[float, float], bool]] = {
        "<": lambda left, right: left < right,
        "<=": lambda left, right: left <= right,
        "==": lambda left, right: left == right,
        ">=": lambda left, right: left >= right,
        ">": lambda left, right: left > right,
    }
    return operators[operator](actual, expected)


def _quantize(at_beats: float, quantization: str, beats_per_bar: int) -> float:
    if quantization == "immediate":
        return at_beats
    if quantization == "beat":
        return ceil(at_beats)
    if quantization == "bar":
        return ceil(at_beats / beats_per_bar) * beats_per_bar
    return ceil(at_beats)
