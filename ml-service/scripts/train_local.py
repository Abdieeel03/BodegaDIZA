"""Entrenar y guardar modelo a partir de los CSV del catálogo.

python -m scripts.train_local --ventas data/ventas.csv --productos data/productos.csv --proveedores data/proveedores.csv
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from app.ingestion import read_local
from app.storage import ModelStore
from app.training_engine import TrainingEngine


def main()->None:
    parser=argparse.ArgumentParser(description='Entrena y evalúa pronósticos a siete días')
    parser.add_argument('--ventas',required=True)
    parser.add_argument('--productos',required=True)
    parser.add_argument('--proveedores')
    parser.add_argument('--modelo-dir',default='data/models')
    args=parser.parse_args()
    output=TrainingEngine(ModelStore(args.modelo_dir)).train(
        read_local(args.ventas),read_local(args.productos),
        read_local(args.proveedores) if args.proveedores else None)
    print(json.dumps({
        'training':output['training'],
        'validationCandidates':output['validationCandidates'],
        'dataCoverage':output['dataCoverage'],
        'providersCount':output['providersCount'],
        'samplePredictions':output['predictions'][:3],
        'sampleReplenishments':output['replenishments'][:3],
    },ensure_ascii=False,indent=2))
    print('\nModelo guardado en',Path(args.modelo_dir).resolve()/output['training']['id'])

if __name__=='__main__':main()
