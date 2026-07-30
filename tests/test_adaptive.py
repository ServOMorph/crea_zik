import pytest

from crea_zik.adaptive import GameplayEvent, simulate_adaptive_graph, validate_adaptive_graph
from crea_zik.models import AdaptiveGraph, AdaptiveState, AdaptiveTransition


def test_adaptive_simulator_quantizes_reproducibly() -> None:
    exploration = AdaptiveState(name="exploration")
    tension = AdaptiveState(name="tension")
    combat = AdaptiveState(name="combat")
    graph = AdaptiveGraph(
        name="gameplay",
        seed=1,
        initial_state_id=exploration.id,
        states=[exploration, tension, combat],
        transitions=[
            AdaptiveTransition(source_state_id=exploration.id, target_state_id=tension.id, condition="intensity >= 0.4", quantization="beat"),
            AdaptiveTransition(source_state_id=tension.id, target_state_id=combat.id, condition="intensity >= 0.8", quantization="bar"),
        ],
    )

    decisions = simulate_adaptive_graph(graph, [GameplayEvent(at_beats=1.2, values={"intensity": .5}), GameplayEvent(at_beats=3.1, values={"intensity": .9})])

    assert [decision.scheduled_beats for decision in decisions] == [2, 4]
    assert decisions[1].target_state_id == combat.id


def test_adaptive_graph_rejects_unsafe_conditions_and_unreachable_states() -> None:
    initial = AdaptiveState(name="initial")
    unreachable = AdaptiveState(name="unreachable")
    graph = AdaptiveGraph(name="invalid", seed=1, initial_state_id=initial.id, states=[initial, unreachable])
    with pytest.raises(ValueError, match="unreachable"):
        validate_adaptive_graph(graph)

    invalid = AdaptiveGraph(
        name="invalid condition",
        seed=2,
        initial_state_id=initial.id,
        states=[initial],
        transitions=[AdaptiveTransition(source_state_id=initial.id, target_state_id=initial.id, condition="__import__('os')", quantization="beat")],
    )
    with pytest.raises(ValueError, match="condition"):
        validate_adaptive_graph(invalid)
