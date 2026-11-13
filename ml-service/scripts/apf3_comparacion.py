"""Comparación local APF3, sin modificar modelos guardados en el servicio ML.

Uso: python -m scripts.apf3_comparacion
Opcional: --productos data/sync/productos_para_ml.csv
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from app.ingestion import read_local
from app.storage import ModelStore
from app.training_engine import TrainingEngine


def main() -> None:
    parser = argparse.ArgumentParser(description='Evaluación comparativa APF3 de cinco candidatos')
    parser.add_argument('--ventas', default='data/catalogo/ventas.csv')
    parser.add_argument('--productos', default='data/catalogo/productos.csv')
    parser.add_argument('--proveedores', default='data/catalogo/proveedores.csv')
    parser.add_argument('--salida', help='Archivo .json de evidencia (opcional)')
    args = parser.parse_args()
    with TemporaryDirectory(prefix='apf3_arbol_') as temp:
        result = TrainingEngine(ModelStore(Path(temp)/'models')).train(
            read_local(args.ventas),read_local(args.productos),read_local(args.proveedores))
    training = result['training']
    print(f"Algoritmo seleccionado: {training['modelName']}")
    print('Comparación por MAE de validación (más bajo es mejor):')
    for name, payload in sorted(result['validationCandidates'].items(),
                                key=lambda item:item[1]['metrics']['mae']):
        m=payload['metrics']
        print(f"  {name:24s} MAE={m['mae']:.4f} RMSE={m['rmse']:.4f} R2={m['r2']}")
    print('Evaluación final, con fechas posteriores a las usadas para elegir el modelo:')
    print(json.dumps(training['metrics'],ensure_ascii=False,indent=2))
    print('Cobertura: fechas con ventas registradas, no calendario diario completo.')
    if args.salida:
        output=Path(args.salida)
        output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps({
            'training':training,
            'validationCandidates':result['validationCandidates'],
            'dataCoverage':result['dataCoverage'],
        },ensure_ascii=False,indent=2),encoding='utf-8')
        print(f'Evidencia guardada: {output.resolve()}')

if __name__=='__main__':
    main()
