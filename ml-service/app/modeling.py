"""Candidatos a modelo y evaluación con MAE, RMSE, R² y WAPE."""
from __future__ import annotations
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder,StandardScaler
from .features import FEATURES,CAT_FEATURES,NUM_FEATURES


CANDIDATES = ('media_reciente','ridge','decision_tree','random_forest','hist_gradient_boosting')


def train_model(name: str, dataset):
    if name == 'media_reciente':
        return None
    methods = {
        'ridge': Ridge(alpha=25.0),
        'decision_tree': DecisionTreeRegressor(
            max_depth=7, min_samples_leaf=5, random_state=42),
        'random_forest': RandomForestRegressor(n_estimators=100,max_depth=11,min_samples_leaf=3,
                                              random_state=42,n_jobs=-1),
        'hist_gradient_boosting': HistGradientBoostingRegressor(
            loss='poisson',learning_rate=.055,max_iter=130,max_leaf_nodes=15,
            min_samples_leaf=16,l2_regularization=5.0,early_stopping=False,random_state=42),
    }
    if name not in methods:
        raise ValueError('Algoritmo desconocido')
    numeric = Pipeline([('scale',StandardScaler())]) if name == 'ridge' else 'passthrough'
    mapper = ColumnTransformer([
        ('categorias',OneHotEncoder(handle_unknown='ignore',sparse_output=False),CAT_FEATURES),
        ('numeros',numeric,NUM_FEATURES),
    ],sparse_threshold=0.0)
    pipe = Pipeline([('preprocesamiento',mapper),('algoritmo',methods[name])])
    pipe.fit(dataset[FEATURES],dataset['cantidad_vendida'].astype(float))
    return pipe


def predict_one(model,name: str,row) -> float:
    if name == 'media_reciente':
        return max(0.,float(row['mean_7'].iloc[0]))
    return max(0.,float(model.predict(row[FEATURES])[0]))


def metrics(actual,forecast) -> dict[str,float|None]:
    a=np.asarray(actual,dtype=float);p=np.maximum(np.asarray(forecast,dtype=float),0)
    if len(a)==0:
        raise ValueError('No hay ventas observadas en la ventana de evaluación')
    return {
        'mae':round(float(mean_absolute_error(a,p)),4),
        'rmse':round(float(np.sqrt(mean_squared_error(a,p))),4),
        'r2':round(float(r2_score(a,p)),4) if len(a)>=2 and len(set(a.tolist()))>1 else None,
        'wape':round(float(np.abs(a-p).sum()/a.sum()*100),2) if a.sum()>0 else None,
        'mape':round(float(np.mean(np.abs((a[a>0]-p[a>0])/a[a>0]))*100),2) if (a>0).any() else None,
    }
