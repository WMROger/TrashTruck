# TensorFlow Waste Forecast Prototype

This experiment trains a small LSTM on 46 monthly observations from the cleaned Danao City historical workbook's Block A series. Source volumes are converted to estimated metric tons using the documented planning density of `0.16 t/m3`. It is not an official budget model.

## Run

From the repository root on Windows:

```powershell
.\.venv-ml\Scripts\python.exe ml\train_lstm.py
.\.venv-ml\Scripts\python.exe ml\evaluate_stability.py
```

Generated files are written to `output/ml/`:

- `metrics.json` contains the time split, test metrics, baseline comparison, three-month forecast, and data limitations.
- `danao_block_a_lstm.keras` is the saved TensorFlow model.
- `scaler.json` contains training-only normalization parameters.
- `test_predictions.csv` contains held-out actual and predicted values.
- `training_history.csv` contains per-epoch loss values.
- `stability_report.json` compares five random seeds and their ensemble with the fixed baselines.
- `data/lstmForecastArtifact.json` is the versioned, presentation-safe candidate summary consumed by the analytics dashboard.

The split is chronological. The final six months are never used for training or early stopping. The preceding six months are validation data. The LSTM should only replace the application baseline if its held-out MAE is lower and the result is stable across repeated runs or rolling-origin evaluation.
