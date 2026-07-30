from crea_zik.gallery import examples
from crea_zik.models import PatchKind
from crea_zik.variants import DEFAULT_RANGES, vary_patch


def test_gallery_contains_the_seven_required_sfx_examples() -> None:
    items = examples()
    assert len(items) == 7
    assert len({item.id for item in items}) == 7
    assert {item.kind for item in items} == {
        PatchKind.UI_CLICK,
        PatchKind.MODAL_IMPACT,
        PatchKind.WHOOSH,
        PatchKind.ENGINE,
        PatchKind.MECHANICAL_AMBIENCE,
    }


def test_each_gallery_example_has_ten_deterministic_variants() -> None:
    for patch in examples():
        variants = [vary_patch(patch, patch.seed + offset, set(), DEFAULT_RANGES) for offset in range(1, 11)]
        assert len({item.seed for item in variants}) == 10
        assert variants == [vary_patch(patch, patch.seed + offset, set(), DEFAULT_RANGES) for offset in range(1, 11)]
