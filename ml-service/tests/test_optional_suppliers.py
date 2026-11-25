from pathlib import Path

from app.ingestion import read_local
from app.storage import ModelStore
from app.training_engine import TrainingEngine


BASE = Path(__file__).parents[1]


def test_training_accepts_catalog_without_suppliers(tmp_path):
    products = read_local(BASE / "data/productos.csv").drop(columns=["proveedor"])
    output = TrainingEngine(ModelStore(tmp_path / "models")).train(
        read_local(BASE / "data/ventas.csv"),
        products,
    )

    assert output["providersCount"] == 0
    assert len(output["predictions"]) == 20
    assert len(output["replenishments"]) == 20
