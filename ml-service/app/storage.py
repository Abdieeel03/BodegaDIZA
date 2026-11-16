"""Persistencia atómica de artefactos del modelo; nunca carga archivos ajenos."""
from __future__ import annotations
import json
import os
from pathlib import Path
from uuid import UUID
import joblib


class ModelStore:
    def __init__(self, directory: str | Path):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True,exist_ok=True)

    def save(self, training_id: str, model: object, payload: dict) -> None:
        # UUID evita rutas elegidas por el usuario.
        training_id = str(UUID(training_id))
        base=self.directory/training_id
        base.mkdir(exist_ok=False)
        temporary=base/'modelo.joblib.tmp'
        joblib.dump(model,temporary)
        os.replace(temporary,base/'modelo.joblib')
        data=json.dumps(payload,ensure_ascii=False,allow_nan=False,indent=2)
        self._atomic_write(base/'resultado.json',data)
        self._atomic_write(self.directory/'latest.json',data)

    def _atomic_write(self,path:Path, data:str)->None:
        tmp=path.with_name(path.name+'.tmp')
        tmp.write_text(data,encoding='utf-8')
        os.replace(tmp,path)

    def get(self,training_id:str)->dict:
        training_id=str(UUID(training_id))
        path=self.directory/training_id/'resultado.json'
        if not path.exists():raise FileNotFoundError(training_id)
        return json.loads(path.read_text(encoding='utf-8'))

    def latest(self)->dict:
        path=self.directory/'latest.json'
        if not path.exists():raise FileNotFoundError('No hay entrenamiento almacenado')
        return json.loads(path.read_text(encoding='utf-8'))

    def trusted_model(self, training_id: str):
        """Solo utilizable para artefactos creados localmente por el servicio."""
        training_id=str(UUID(training_id))
        path=self.directory/training_id/'modelo.joblib'
        if not path.is_file():raise FileNotFoundError(training_id)
        return joblib.load(path)
